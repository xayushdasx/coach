// Coach API: holds the Gemini and Sarvam keys and forwards only the calls the app makes.
// The frontend (Vercel) rewrites /api/* to this server, so keys never reach the browser.
import http from 'node:http'

const PORT = Number(process.env.PORT) || 8080
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? ''
const SARVAM_API_KEY = process.env.SARVAM_API_KEY ?? ''
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
const GEMINI_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite']
const MAX_BODY = 20 * 1024 * 1024

// Simple per-IP limit so a leaked URL can't drain the free tiers.
const WINDOW_MS = 10 * 60 * 1000
const MAX_REQUESTS = Number(process.env.RATE_LIMIT ?? 300)
const hits = new Map()

function rateLimited(ip) {
  const now = Date.now()
  const h = hits.get(ip)
  if (!h || now - h.start > WINDOW_MS) {
    hits.set(ip, { start: now, n: 1 })
    return false
  }
  h.n += 1
  return h.n > MAX_REQUESTS
}

function route(method, path) {
  if (method !== 'POST') return null
  const g = path.match(/^\/api\/gemini\/v1beta\/models\/([a-z0-9.-]+):generateContent$/)
  if (g && GEMINI_MODELS.includes(g[1])) {
    return { url: `https://generativelanguage.googleapis.com/v1beta/models/${g[1]}:generateContent`, headers: { 'x-goog-api-key': GEMINI_API_KEY } }
  }
  if (path === '/api/sarvam/text-to-speech' || path === '/api/sarvam/speech-to-text') {
    return { url: `https://api.sarvam.ai${path.replace('/api/sarvam', '')}`, headers: { 'api-subscription-key': SARVAM_API_KEY } }
  }
  return null
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > MAX_BODY) {
        reject(new Error('too_large'))
        req.destroy()
      } else chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  }
  if (req.method === 'OPTIONS') return res.writeHead(204).end()

  const path = (req.url ?? '/').split('?')[0]
  if (path === '/health') return send(res, 200, { ok: true, gemini: !!GEMINI_API_KEY, sarvam: !!SARVAM_API_KEY })

  const target = route(req.method, path)
  if (!target) return send(res, 404, { error: { message: 'Not found' } })

  const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').split(',')[0].trim()
  if (rateLimited(ip)) return send(res, 429, { error: { message: 'Too many requests. Try again in a few minutes.' } })

  let body
  try {
    body = await readBody(req)
  } catch {
    return send(res, 413, { error: { message: 'Request too large.' } })
  }

  try {
    const upstream = await fetch(target.url, {
      method: 'POST',
      headers: { ...target.headers, 'Content-Type': req.headers['content-type'] ?? 'application/json' },
      body,
    })
    res.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' })
    res.end(Buffer.from(await upstream.arrayBuffer()))
  } catch (e) {
    send(res, 502, { error: { message: `Upstream request failed: ${e.message}` } })
  }
})

server.listen(PORT, () => console.log(`coach-api listening on ${PORT}`))
