import { applyCors, verifyUser, cleanField, checkRateLimit } from './_auth.js'

// Only these models may be requested through this proxy.
const ALLOWED_MODELS = ['claude-sonnet-5', 'claude-haiku-4-5-20251001']

export default async function handler(req, res) {
  applyCors(req, res)

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Gate: only signed-in Supabase users may spend our Anthropic quota.
  const user = await verifyUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  // Cost guard. High enough to clear a full "Fill all missing" burst (~62).
  if (!(await checkRateLimit(req, { limit: 120, windowSeconds: 60 }))) {
    return res.status(429).json({ error: 'Too many requests. Wait a moment and try again.' })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not set on the server.' })
  }

  const body = req.body || {}
  const songName = cleanField(body.songName)
  const artist = cleanField(body.artist)
  const key = cleanField(body.key, 20)

  // Chord-fill only. Caller-controlled model/tokens are clamped to safe bounds.
  const safeModel = ALLOWED_MODELS.includes(body.model) ? body.model : 'claude-sonnet-5'
  const safeMaxTokens = Math.min(Math.max(parseInt(body.max_tokens, 10) || 1500, 256), 2000)

  let payload
  {
    if (!songName) return res.status(400).json({ error: 'songName required' })
    const prompt = `You are an expert accompanist for Jewish and Israeli music — niggunim, Shabbos/Yom Tov zemiros, chassidic, and Israeli pop. Give the chords and lyrics for the song "${songName}"${artist ? ` by ${artist}` : ''}${key ? ` (often played in ${key})` : ''}.

Return your answer in EXACTLY this format and nothing else — no preamble, no commentary, no markdown fences:

TEMPO: [feel, e.g. Slow ballad, Upbeat hora, Medium waltz]
NOTES: [one practical tip for a keyboardist playing this song]
KEY: [original key, e.g. Am, D, G]
CHORDS_LYRICS:
[Section name]:
[lyric line with inline chords in square brackets placed right before the syllable where the chord changes]

Example of the exact format:
Verse:
[Am]Od yishama [F]b'arei [C]yehuda [E7]
[Am]Uvechutzos [Dm]Yerushalayim [E7]

Chorus:
[F]Kol sasson [C]v'kol [G]simcha [Am]

Rules:
- Use the [chord] inline notation on every lyric line, chord in square brackets immediately before the syllable it lands on.
- Transliterate Hebrew lyrics into Latin letters.
- Only give chords you are genuinely confident are correct for THIS specific song. Never invent, guess, or approximate a song you do not actually know.
- If you do not truly know this exact song, reply with exactly one word: UNKNOWN`

    // Note: claude-sonnet-5 rejects non-default sampling params (temperature/top_p/top_k)
    // with a 400, so we omit them. Thinking is disabled — this is a deterministic
    // extraction, and adaptive thinking (the default when omitted) would spend the
    // token budget and can truncate the chart.
    payload = {
      model: safeModel,
      max_tokens: safeMaxTokens,
      thinking: { type: 'disabled' },
      messages: [{ role: 'user', content: prompt }],
    }
  }

  let response
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    console.error('[claude] fetch error:', err)
    return res.status(502).json({ error: 'Failed to reach Anthropic API', detail: err.message })
  }

  const data = await response.json()

  if (!response.ok) {
    const msg = data.error?.message || 'Anthropic API error'
    const type = data.error?.type || ''
    const isRate = response.status === 429 || response.status === 529 ||
      type === 'rate_limit_error' || type === 'overloaded_error'
    console.error('[claude] error:', response.status, JSON.stringify(data))
    return res.status(isRate ? 429 : (response.status || 500)).json({
      error: isRate
        ? 'Claude is rate-limited or overloaded right now. Wait a moment and try again.'
        : msg,
    })
  }

  const text = (data.content || []).map(b => b.text).filter(Boolean).join('\n').trim() || 'UNKNOWN'
  return res.status(200).json({ text })
}
