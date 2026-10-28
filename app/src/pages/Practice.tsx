import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { setState, uid, useStore } from '../lib/store'
import { MODE_LABEL } from '../lib/format'
import type { Mode, Session } from '../lib/types'
import { DiffBadge, Empty, PageHead } from '../components/ui'

const MODES: { id: Mode; body: string }[] = [
  { id: 'full', body: 'A whole call, from hello to the next step.' },
  { id: 'opening', body: 'The first minute: who you are, why you called, the agenda.' },
  { id: 'discovery', body: 'Uncover the buyer’s situation, pain, process and budget.' },
  { id: 'objections', body: 'The buyer fires objections one after another.' },
  { id: 'closing', body: 'The buyer likes it. Handle the last hesitation and get a commitment.' },
]

export default function Practice() {
  const nav = useNavigate()
  const editorial = useStore((s) => s.editorial)
  const personas = useStore((s) => s.personas)
  const trainee = useStore((s) => s.trainee)
  const [mode, setMode] = useState<Mode>('full')
  const [personaId, setPersonaId] = useState<string | null>(null)
  const [plan, setPlan] = useState('')

  if (!editorial?.approved || personas.length === 0) {
    return (
      <div className="page">
        <Empty
          title="Setup isn’t finished"
          body="Practice calls need an approved sales brief and at least one buyer."
          action={<Link className="btn primary" to={editorial?.approved ? '/buyers' : '/brief'}>{editorial?.approved ? 'Create buyers' : 'Review the sales brief'}</Link>}
        />
      </div>
    )
  }

  const persona = personas.find((p) => p.id === personaId)

  function start() {
    if (!persona || !trainee.trim()) return
    const s: Session = {
      id: uid('c_'),
      trainee: trainee.trim(),
      personaId: persona.id,
      persona,
      editorialVersion: editorial!.version,
      mode,
      startedAt: Date.now(),
      prepPlan: plan,
      crmNotes: '',
      followUp: '',
      turns: [],
      states: [],
    }
    setState((st) => ({ sessions: [...st.sessions, s] }))
    nav(`/call/${s.id}`)
  }

  return (
    <div className="page">
      <PageHead title="Practice calls" sub="Pick what to practise and who to call. It’s a live voice call: use headphones and a quiet room." />

      <h2 style={{ marginBottom: 10 }}>What to practise</h2>
      <div className="grid g3" style={{ marginBottom: 26, gridTemplateColumns: 'repeat(5, minmax(0,1fr))' }}>
        {MODES.map((m) => (
          <button
            key={m.id}
            className="card card-pad"
            onClick={() => setMode(m.id)}
            style={{ textAlign: 'left', cursor: 'pointer', font: 'inherit', borderColor: mode === m.id ? 'var(--accent)' : undefined, boxShadow: mode === m.id ? '0 0 0 3px var(--accent-soft)' : undefined }}
          >
            <b>{MODE_LABEL[m.id]}</b>
            <p className="small muted" style={{ marginTop: 4 }}>{m.body}</p>
          </button>
        ))}
      </div>

      <h2 style={{ marginBottom: 10 }}>Who to call</h2>
      <div className="card" style={{ marginBottom: 26 }}>
        <table className="t">
          <thead><tr><th></th><th>Buyer</th><th>Company</th><th>Lead source</th><th>Difficulty</th></tr></thead>
          <tbody>
            {personas.map((p) => (
              <tr key={p.id} className="click" onClick={() => setPersonaId(p.id)}>
                <td style={{ width: 36 }}><input type="radio" name="persona" checked={personaId === p.id} onChange={() => setPersonaId(p.id)} aria-label={p.visible.name} /></td>
                <td><b>{p.visible.name}</b><div className="small muted">{p.visible.title}</div></td>
                <td>{p.visible.company}<div className="small faint">{p.visible.companySize}</div></td>
                <td className="small">{p.visible.leadSource}</td>
                <td><DiffBadge d={p.difficulty} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {persona && (
        <div className="grid g2" style={{ alignItems: 'start' }}>
          <section className="card card-pad stack lead-card">
            <div className="kicker">Lead card</div>
            <dl>
              <dt>Name</dt><dd>{persona.visible.name}</dd>
              <dt>Role</dt><dd>{persona.visible.title}</dd>
              <dt>Company</dt><dd>{persona.visible.company} · {persona.visible.companySize}</dd>
              <dt>Source</dt><dd>{persona.visible.leadSource}</dd>
              <dt>CRM notes</dt><dd>{persona.visible.context}</dd>
              <dt>Your goal</dt><dd>{mode === 'full' ? editorial.salesMotion.callObjective : MODES.find((m) => m.id === mode)!.body}</dd>
            </dl>
          </section>
          <section className="card card-pad stack">
            <label className="field">
              <span className="field-label">Your plan for this call</span>
              <span className="field-hint">Optional, but scored: what you want to learn, the questions you’ll ask, the next step you’ll aim for.</span>
              <textarea rows={6} value={plan} onChange={(e) => setPlan(e.target.value)} />
            </label>
            {!trainee.trim() && <div className="notice warn">Enter your name in the Trainee box at the top so the report is saved under you.</div>}
            <button className="btn live lg" disabled={!trainee.trim()} onClick={start}>Start call with {persona.visible.name.split(' ')[0]}</button>
          </section>
        </div>
      )}
    </div>
  )
}
