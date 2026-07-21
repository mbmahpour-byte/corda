export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not set on the server.' })
  }

  const { songName, artist, key, model, max_tokens, messages } = req.body || {}

  // Build the request body: either a raw passthrough ({messages}) or chord-fill mode.
  let payload
  if (messages) {
    // Generic proxy passthrough (backward compatible).
    payload = { model: model || 'claude-sonnet-5', max_tokens: max_tokens || 1024, messages }
  } else {
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
      model: model || 'claude-sonnet-5',
      max_tokens: max_tokens || 1500,
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

  // Passthrough callers want the raw Anthropic body; chord-fill callers want { text }.
  if (messages) return res.status(200).json(data)

  const text = (data.content || []).map(b => b.text).filter(Boolean).join('\n').trim() || 'UNKNOWN'
  return res.status(200).json({ text })
}
