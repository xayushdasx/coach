import { getSettings } from './store'
import { durationSec, toWavChunks } from './audio'

// All requests go through the Vite dev-server proxy (vite.config.ts), which adds the API keys.
const GEMINI = '/api/gemini/v1beta/models'
const SARVAM = '/api/sarvam'

type Msg = { role: 'system' | 'user' | 'assistant'; content: string }

async function failure(res: Response, service: string): Promise<Error> {
  let detail = ''
  try {
    const body = await res.json()
    detail = body?.error?.message ?? body?.message ?? JSON.stringify(body)
  } catch {
    detail = res.statusText
  }
  if (res.status === 429) return new Error(`${service} rate limit reached (free tier). Wait a minute and try again. ${detail}`)
  if (res.status === 401 || res.status === 403) return new Error(`${service} rejected the API key. Check .env.local. ${detail}`)
  return new Error(`${service} error ${res.status}: ${detail}`)
}

export async function chat(messages: Msg[], opts: { temperature?: number; maxTokens?: number; json?: boolean } = {}): Promise<string> {
  const { thinkingModel } = getSettings()
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n')
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
  const body = JSON.stringify({
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    contents,
    generationConfig: {
      temperature: opts.temperature,
      maxOutputTokens: opts.maxTokens,
      ...(opts.json ? { responseMimeType: 'application/json' } : {}),
    },
  })
  // Gemini's free tier often answers 503 "high demand" or 429 for a few seconds. Wait and retry,
  // and if the chosen model stays overloaded, try the other Flash-Lite model.
  const fallback = thinkingModel === 'gemini-3.1-flash-lite' ? 'gemini-3.5-flash-lite' : 'gemini-3.1-flash-lite'
  const attempts = [
    { model: thinkingModel, wait: 0 },
    { model: thinkingModel, wait: 2000 },
    { model: fallback, wait: 3000 },
    { model: fallback, wait: 8000 },
  ]
  let res!: Response
  for (const a of attempts) {
    if (a.wait) await new Promise((r) => setTimeout(r, a.wait))
    res = await fetch(`${GEMINI}/${a.model}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
    if (![429, 500, 502, 503, 504].includes(res.status)) break
  }
  if (!res.ok) throw await failure(res, 'Gemini')
  const data = await res.json()
  const cand = data?.candidates?.[0]
  const text = (cand?.content?.parts ?? []).map((p: any) => p.text ?? '').join('')
  if (!text) {
    const why = cand?.finishReason ?? data?.promptFeedback?.blockReason ?? 'empty response'
    throw new Error(`Gemini returned no text (${why}).`)
  }
  return text
}

export function parseJSON<T>(raw: string): T {
  let s = raw.trim()
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) s = fence[1].trim()
  const first = s.search(/[\[{]/)
  const last = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'))
  if (first === -1 || last === -1) throw new Error('The model did not return JSON.')
  return JSON.parse(s.slice(first, last + 1)) as T
}

// Ask for JSON; on a parse failure, show the model its own output and ask once for a fix.
export async function chatJSON<T>(system: string, user: string, opts: { temperature?: number; maxTokens?: number } = {}): Promise<T> {
  const messages: Msg[] = [
    { role: 'system', content: system + '\n\nRespond with a single valid JSON value only. No prose, no markdown fences.' },
    { role: 'user', content: user },
  ]
  const raw = await chat(messages, { ...opts, json: true })
  try {
    return parseJSON<T>(raw)
  } catch (e) {
    const retry = await chat(
      [
        ...messages,
        { role: 'assistant', content: raw },
        { role: 'user', content: `That was not valid JSON (${(e as Error).message}). Return the same content as one valid JSON value only.` },
      ],
      { ...opts, json: true },
    )
    return parseJSON<T>(retry)
  }
}

// Sarvam text-to-speech. Returns a ready-to-play audio element.
export async function speak(text: string, voice: string, _style?: string): Promise<HTMLAudioElement> {
  const { ttsModel } = getSettings()
  const speaker = ALL_VOICES.includes(voice) ? voice : SARVAM_VOICES.female[0]
  const res = await fetch(`${SARVAM}/text-to-speech`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: text.slice(0, 2500),
      language_code: speaker.includes('_enhi_') ? 'hi-IN' : 'en-IN',
      speaker,
      model: ttsModel,
      output_audio_codec: 'mp3',
    }),
  })
  if (!res.ok) throw await failure(res, 'Sarvam voice')
  const data = await res.json()
  const b64: string | undefined = data?.audios?.[0]
  if (!b64) throw new Error('Sarvam returned no audio.')
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }))
  const audio = new Audio(url)
  audio.addEventListener('ended', () => URL.revokeObjectURL(url), { once: true })
  return audio
}

// Sarvam speech-to-text. Audio over its 30 s limit is split at quiet points and transcribed in parts.
export async function transcribe(blob: Blob, language = 'unknown'): Promise<string> {
  let seconds = 0
  try {
    seconds = await durationSec(blob)
  } catch {
    // The browser can't decode it; send it as-is and let Sarvam decide.
  }
  if (seconds <= 29) return transcribeOne(blob, language)

  const chunks = await toWavChunks(blob)
  const parts: string[] = new Array(chunks.length)
  // A few at a time, to stay inside the free tier's rate limit.
  for (let i = 0; i < chunks.length; i += 3) {
    const batch = chunks.slice(i, i + 3)
    const texts = await Promise.all(batch.map((c) => transcribeOne(c, language)))
    texts.forEach((t, k) => (parts[i + k] = t))
  }
  return parts.filter(Boolean).join(' ').trim()
}

async function transcribeOne(blob: Blob, language: string): Promise<string> {
  const { sttModel } = getSettings()
  // Sarvam rejects MIME parameters ("audio/webm;codecs=opus") and video/mp4, so send a bare audio type.
  let type = (blob.type || 'audio/webm').split(';')[0].trim()
  if (type === 'video/mp4' || type === 'video/quicktime') type = 'audio/mp4'
  const name = blob instanceof File ? blob.name : type === 'audio/wav' ? 'part.wav' : 'turn.webm'
  const file = new File([blob], name, { type })
  const form = new FormData()
  form.append('file', file)
  form.append('model', sttModel)
  form.append('language_code', language)
  const res = await fetch(`${SARVAM}/speech-to-text`, { method: 'POST', body: form })
  if (!res.ok) throw await failure(res, 'Sarvam speech-to-text')
  const data = await res.json()
  return String(data?.transcript ?? '').trim()
}

// bulbul:v4-flash speakers suited to a buyer on a call. "_enhi_" voices speak Hindi-English code-mix.
export const SARVAM_VOICES = {
  female: ['neha_en_customer', 'ishita_en_customer', 'shalini_en_customer', 'simran_en_conversation', 'roopa_en_conversational', 'zarina_en_conversation', 'aparna_en_companion', 'sanchita_en_companion', 'ishita_enhi_customer', 'shalini_enhi_customer', 'simran_enhi_customer'],
  male: ['dev_en_conversational', 'deven_en_conversation', 'ojas_en_social', 'sunny_en_social', 'kalpit_en_edtech', 'varun_en_ads', 'shubh_en_narration', 'sunny_enhi_customer', 'shubh_enhi_companion'],
}
const ALL_VOICES = [...SARVAM_VOICES.female, ...SARVAM_VOICES.male]
