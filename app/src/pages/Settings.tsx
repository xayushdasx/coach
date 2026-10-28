import { useState } from 'react'
import { defaultSettings, resetWorkspace, setState, useStore } from '../lib/store'
import { chat, SARVAM_VOICES, speak } from '../lib/ai'
import { Busy, ErrorNote, PageHead } from '../components/ui'

const THINKING = [
  { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite (cheapest, free tier)' },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite (newer, slower)' },
]
const TTS = [{ id: 'bulbul:v4-flash', label: 'Bulbul v4 Flash (₹10 / 10K chars)' }, { id: 'bulbul:v3', label: 'Bulbul v3 (₹30 / 10K chars)' }]
const STT = [{ id: 'saaras:v4', label: 'Saaras v4' }, { id: 'saaras:v3', label: 'Saaras v3' }]

export default function SettingsPage() {
  const settings = useStore((s) => s.settings)
  const [testing, setTesting] = useState<'text' | 'voice' | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<typeof settings>) => setState((s) => ({ settings: { ...s.settings, ...patch } }))

  async function test(kind: 'text' | 'voice') {
    setTesting(kind)
    setError(null)
    setResult(null)
    try {
      if (kind === 'text') {
        const reply = await chat([{ role: 'user', content: 'Reply with exactly: Gemini is connected.' }], { maxTokens: 20 })
        setResult(reply.trim())
      } else {
        const a = await speak('Hi, this is Priya. I have about ten minutes. What did you want to discuss?', SARVAM_VOICES.female[0])
        await a.play()
        setResult('Sarvam voice is playing.')
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setTesting(null)
    }
  }

  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <PageHead title="Settings" sub="Thinking runs on Google Gemini, voice on Sarvam. The API keys are held by the server and never reach the browser." />
      <section className="card card-pad stack" style={{ gap: 16 }}>
        <label className="field">
          <span className="field-label">Thinking model (Gemini)</span>
          <span className="field-hint">Used for extraction, the brief, buyers, lessons, the live buyer and scoring.</span>
          <select value={settings.thinkingModel} onChange={(e) => set({ thinkingModel: e.target.value })}>
            {THINKING.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Buyer voice (Sarvam)</span>
          <select value={settings.ttsModel} onChange={(e) => set({ ttsModel: e.target.value })}>
            {TTS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Speech-to-text (Sarvam)</span>
          <select value={settings.sttModel} onChange={(e) => set({ sttModel: e.target.value })}>
            {STT.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>
        <div className="row wrap">
          <button className="btn" disabled={!!testing} onClick={() => test('text')}><Busy on={testing === 'text'}>Test Gemini</Busy></button>
          <button className="btn" disabled={!!testing} onClick={() => test('voice')}><Busy on={testing === 'voice'}>Test buyer voice</Busy></button>
          <button className="btn ghost" onClick={() => set(defaultSettings)}>Restore defaults</button>
        </div>
        {result && <div className="notice info">{result}</div>}
        <ErrorNote error={error} />
      </section>

      <section className="card card-pad stack" style={{ marginTop: 16 }}>
        <h3>Workspace data</h3>
        <p className="small muted">Everything is stored in this browser. Clearing it removes the company info, brief, buyers, lessons and all reports.</p>
        <div>
          <button className="btn" style={{ color: 'var(--bad)' }} onClick={() => confirm('Delete all workspace data in this browser?') && resetWorkspace()}>Clear workspace</button>
        </div>
      </section>
    </div>
  )
}
