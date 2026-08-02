// Shared helpers for the AI proxy endpoints: CORS lock + Supabase JWT verification.
// Prefixed with "_" so Vercel does not expose it as its own serverless route.

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

// Comma-separated allowlist of cross-origin callers (e.g. preview domains).
// Same-origin requests need no ACAO header, so this can stay empty in production.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(o => o.trim()).filter(Boolean)

// Reflects the request origin only when it is explicitly allowlisted — no wildcard.
export function applyCors(req, res) {
  const origin = req.headers.origin
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

// Coerces a caller-supplied field to a trimmed string capped at `max` chars,
// collapsing control chars and whitespace. Guards against oversized/garbage
// input inflating token cost or smuggling newlines into the prompt.
// Returns '' for non-strings.
export function cleanField(v, max = 200) {
  if (typeof v !== 'string') return ''
  return v.replace(/\p{Cc}/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
}

// Pulls the raw bearer token out of the Authorization header ('' if absent).
function bearer(req) {
  const auth = req.headers.authorization || ''
  return auth.startsWith('Bearer ') ? auth.slice(7) : ''
}

// Per-user fixed-window rate limit backed by the check_rate_limit RPC (see
// sql/phase2_rate_limits.sql). The RPC scopes to the caller via auth.uid(), so
// we call it with the user's own token. `scope` isolates each endpoint's counter
// so, e.g., /api/claude and /api/chords don't share (and drain) one bucket.
// Fails OPEN (returns true) if the RPC is unreachable or not yet installed —
// availability over strictness for a best-effort cost guard. Returns false only
// when the limit is genuinely hit.
export async function checkRateLimit(req, { scope, limit, windowSeconds = 60 }) {
  const token = bearer(req)
  if (!token || !SUPABASE_URL || !SUPABASE_ANON_KEY) return true
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/check_rate_limit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ p_scope: scope, p_limit: limit, p_window: windowSeconds }),
    })
    if (!r.ok) return true  // RPC missing/misconfigured — don't block legit users
    return (await r.json()) === true
  } catch {
    return true
  }
}

// Verifies the Supabase access token from the Authorization header against
// Supabase's /auth/v1/user endpoint. Returns the user object, or null if the
// token is missing/invalid or the server is misconfigured.
export async function verifyUser(req) {
  const token = bearer(req)
  if (!token || !SUPABASE_URL || !SUPABASE_ANON_KEY) return null
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    })
    if (!r.ok) return null
    const user = await r.json()
    return user?.id ? user : null
  } catch {
    return null
  }
}
