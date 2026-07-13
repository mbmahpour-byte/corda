export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { songName, artist, key } = req.body
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

  // The web_search server tool runs a server-side loop that can pause after a
  // fixed number of iterations (stop_reason: "pause_turn"). When that happens
  // we re-send the accumulated conversation so the model resumes and finishes.
  async function callClaude(messages) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-8',
        max_tokens: 4096,
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5 }],
        messages,
      }),
    })
    const data = await response.json()
    return { response, data }
  }

  try {
    let messages = [{ role: 'user', content: prompt }]
    let data
    let response

    // Resume on pause_turn up to a few times before giving up.
    for (let i = 0; i < 4; i++) {
      ;({ response, data } = await callClaude(messages))

      if (!response.ok) {
        const msg = data.error?.message || 'Anthropic API error'
        const isQuota = response.status === 429 || /rate|quota/i.test(msg)
        console.error('[claude] Anthropic error:', response.status, msg)
        return res.status(isQuota ? 429 : 500).json({
          error: isQuota
            ? 'Chord search rate limit reached. Please try again in a moment.'
            : msg,
        })
      }

      if (data.stop_reason === 'pause_turn') {
        // Re-send with the assistant's partial turn appended so the server-tool
        // loop continues. Do NOT add a user "continue" message.
        messages = [...messages, { role: 'assistant', content: data.content }]
        continue
      }
      break
    }

    // Concatenate every text block; web-search responses interleave
    // server_tool_use / web_search_tool_result / text blocks.
    const text = (data.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim() || 'UNKNOWN'

    console.log('[claude] extracted text (first 300):', text.slice(0, 300))
    return res.status(200).json({ text })
  } catch (e) {
    console.error('[claude] error:', e)
    return res.status(500).json({ error: e.message })
  }
}
