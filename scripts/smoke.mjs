// End-to-end check of a deployed Coach app: site, backend, Gemini, Sarvam voice and speech-to-text.
// Usage: node scripts/smoke.mjs [base-url]   (default: the live Vercel site)
// Uses a few seconds of real API calls; run it after a deploy, not on a schedule.

const BASE = (process.argv[2] ?? 'https://salescoach-ai-app.vercel.app').replace(/\/$/, '')
let failed = 0

async function check(name, fn) {
  const t0 = Date.now()
  try {
    const detail = await fn()
    console.log(`PASS  ${name} (${Date.now() - t0} ms)${detail ? ` — ${detail}` : ''}`)
    return true
  } catch (e) {
    failed++
    console.log(`FAIL  ${name} (${Date.now() - t0} ms) — ${e.message}`)
    return false
  }
}

async function post(path, body, headers = { 'Content-Type': 'application/json' }) {
  const res = await fetch(BASE + path, { method: 'POST', headers, body, signal: AbortSignal.timeout(90_000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.json()
}

console.log(`Smoke test against ${BASE}\n`)

await check('Site loads', async () => {
  const res = await fetch(BASE + '/', { signal: AbortSignal.timeout(30_000) })
  const html = await res.text()
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  if (!html.includes('<div id="root">')) throw new Error('page has no app root')
})

await check('Backend health (wakes it if asleep)', async () => {
  const res = await fetch(BASE + '/api/health', { signal: AbortSignal.timeout(90_000) })
  const data = await res.json()
  if (!data.ok) throw new Error(JSON.stringify(data))
  if (!data.gemini || !data.sarvam) throw new Error(`missing keys: ${JSON.stringify(data)}`)
  return 'both API keys present'
})

await check('Gemini answers', async () => {
  const data = await post(
    '/api/gemini/v1beta/models/gemini-3.1-flash-lite:generateContent',
    JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Reply with exactly: ok' }] }], generationConfig: { maxOutputTokens: 10 } }),
  )
  const text = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('').trim()
  if (!text) throw new Error('no text in response')
  return `"${text}"`
})

const sentence = 'Which board is your son in, and how did his last maths test go?'
let audio = null
await check('Sarvam voice (text-to-speech)', async () => {
  const data = await post(
    '/api/sarvam/text-to-speech',
    JSON.stringify({ text: sentence, language_code: 'en-IN', speaker: 'neha_en_customer', model: 'bulbul:v4-flash', output_audio_codec: 'mp3' }),
  )
  if (!data.audios?.[0]) throw new Error('no audio in response')
  audio = Buffer.from(data.audios[0], 'base64')
  return `${audio.length} bytes of audio`
})

await check('Sarvam speech-to-text (round trip)', async () => {
  if (!audio) throw new Error('skipped: no audio from the previous step')
  const form = new FormData()
  form.append('file', new Blob([audio], { type: 'audio/mpeg' }), 'smoke.mp3')
  form.append('model', 'saaras:v4')
  form.append('language_code', 'unknown')
  const data = await post('/api/sarvam/speech-to-text', form, {})
  const got = String(data.transcript ?? '')
  const words = (s) => s.toLowerCase().replace(/[^a-z ]/g, '').split(/\s+/).filter(Boolean)
  const want = new Set(words(sentence))
  const overlap = words(got).filter((w) => want.has(w)).length / want.size
  if (overlap < 0.7) throw new Error(`transcript doesn't match: "${got}"`)
  return `"${got}"`
})

await check('Unknown API routes are refused', async () => {
  const res = await fetch(BASE + '/api/gemini/v1beta/models/not-allowed:generateContent', { method: 'POST', body: '{}', signal: AbortSignal.timeout(30_000) })
  if (res.status !== 404) throw new Error(`expected 404, got ${res.status}`)
})

console.log(failed ? `\n${failed} check(s) failed.` : '\nAll checks passed.')
process.exit(failed ? 1 : 0)
