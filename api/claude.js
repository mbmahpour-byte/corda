export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { model, max_tokens, messages } = req.body

  let response
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model, max_tokens, messages }),
    })
  } catch (err) {
    console.error('[claude proxy] fetch error:', err)
    return res.status(502).json({ error: 'Failed to reach Anthropic API', detail: err.message })
  }

  const data = await response.json()

  if (!response.ok) {
    console.error('[claude proxy] Anthropic error:', response.status, JSON.stringify(data))
  }

  return res.status(response.status).json(data)
}
