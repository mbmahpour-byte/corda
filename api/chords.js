import { applyCors, verifyUser, cleanField, checkRateLimit } from './_auth.js'

export default async function handler(req, res) {
  applyCors(req, res)

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Gate: only signed-in Supabase users may spend our Gemini quota.
  const user = await verifyUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  // Cost guard — Gemini web search is pricier and only used for single fills.
  if (!(await checkRateLimit(req, { limit: 30, windowSeconds: 60 }))) {
    return res.status(429).json({ error: 'Too many requests. Wait a moment and try again.' })
  }

  const body = req.body || {}
  const songName = cleanField(body.songName)
  const artist = cleanField(body.artist)
  if (!songName) return res.status(400).json({ error: 'songName required' })

  const prompt = `Search the web and find the real chord chart AND lyrics for the Jewish/Israeli song "${songName}"${artist ? ` by ${artist}` : ''}. Look on sites like Chordify, Ultimate Guitar, Shironet, or any Jewish/Israeli music site.

Return your response in EXACTLY this format, nothing else:

TEMPO: [tempo feel e.g. Slow ballad, Upbeat dance, Medium waltz]
NOTES: [one practical tip for a keyboardist playing this song]
KEY: [original key the song is in, e.g. Am, D, G]
CHORDS_LYRICS:
[Section name]:
[lyrics with inline chords in square brackets placed immediately before the syllable where they change]

Example of the correct format:
Verse:
[Am]Od yishama [F]b'arei [C]yehuda [E7]
[Am]Uvechutzos [Dm]Yerushalayim [E7]

Chorus:
[F]Kol sasson [C]v'kol [G]simcha [Am]

Use this [chord] inline notation for every lyric line. Place the chord in square brackets right before the syllable it lands on. Do not use any other format.

If you cannot find the actual chords and lyrics for this song online, respond with exactly:
UNKNOWN`

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          tools: [{ googleSearch: {} }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
        }),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      const msg = data.error?.message || 'Gemini API error'
      const isQuota = msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')
      console.error('[chords] Gemini error:', msg)
      return res.status(isQuota ? 429 : 500).json({
        error: isQuota ? 'Chord search quota exceeded for today. Try again tomorrow or enable billing on your Gemini API key.' : msg
      })
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'UNKNOWN'
    return res.status(200).json({ text })
  } catch (e) {
    console.error('[chords] error:', e)
    return res.status(500).json({ error: e.message })
  }
}
