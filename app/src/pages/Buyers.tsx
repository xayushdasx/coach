import { useState } from 'react'
import { Link } from 'react-router-dom'
import { setState, useStore } from '../lib/store'
import { runPersonas } from '../prompts/p3-personas'
import type { Difficulty, Persona } from '../lib/types'
import { Busy, DiffBadge, Empty, ErrorNote, PageHead } from '../components/ui'

const LEVELS: Difficulty[] = ['easy', 'medium', 'hard', 'expert']

function PersonaCard({ p }: { p: Persona }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="card">
      <div className="card-pad stack" style={{ gap: 8 }}>
        <div className="row-between">
          <div>
            <b>{p.visible.name}</b>
            <div className="small muted">{p.visible.title}, {p.visible.company} · {p.visible.companySize}</div>
          </div>
          <DiffBadge d={p.difficulty} />
        </div>
        <div className="small"><span className="faint">Lead source:</span> {p.visible.leadSource}</div>
        <div className="small muted">{p.visible.context}</div>
        <div className="small"><span className="faint">Personality:</span> {p.personality}</div>
        <div className="row-between">
          <span className="small faint">Voice: {p.voice.name} · {p.objectionScript.length} objections · {p.hiddenFacts.length} hidden facts</span>
          <button className="btn ghost sm" onClick={() => setOpen(!open)}>{open ? 'Hide hidden truth' : 'Show hidden truth'}</button>
        </div>
        {open && (
          <div className="stack small" style={{ background: 'var(--sunken)', borderRadius: 8, padding: 12, gap: 8 }}>
            <div><b>Real goal:</b> {p.hidden.realGoal}</div>
            <div><b>Real pain:</b> {p.hidden.realPain}</div>
            <div><b>Budget:</b> {p.hidden.budget}</div>
            <div><b>Decision process:</b> {p.hidden.decisionProcess}</div>
            <div><b>Hidden objection:</b> {p.hidden.hiddenObjection}</div>
            <div><b>Urgency:</b> {p.hidden.urgency} · <b>Past experience:</b> {p.hidden.pastExperience}</div>
            <div><b>Buys if:</b> {p.winCondition}</div>
            <div>
              <b>Objections</b>
              <ul className="ticks">{p.objectionScript.map((o, i) => <li key={i}>“{o.says}” <span className="faint">— resolved if {o.resolvedIf}</span></li>)}</ul>
            </div>
          </div>
        )}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn ghost sm" onClick={() => setState((s) => ({ personas: s.personas.filter((x) => x.id !== p.id) }))}>Remove</button>
        </div>
      </div>
    </div>
  )
}

export default function Buyers() {
  const editorial = useStore((s) => s.editorial)
  const personas = useStore((s) => s.personas)
  const [mix, setMix] = useState<Record<Difficulty, number>>({ easy: 1, medium: 2, hard: 2, expert: 1 })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!editorial?.approved) {
    return (
      <div className="page">
        <Empty title="Approve the sales brief first" body="Buyers are generated from the approved brief: its target customers, discovery checklist and objections." action={<Link className="btn primary" to="/brief">Go to Sales brief</Link>} />
      </div>
    )
  }

  async function generate() {
    setBusy(true)
    setError(null)
    try {
      const list = LEVELS.flatMap((l) => Array(mix[l]).fill(l)) as Difficulty[]
      const made = await runPersonas(editorial!, list)
      setState((s) => ({ personas: [...s.personas, ...made] }))
    } catch (e) {
      setError(`Generating buyers failed: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const total = LEVELS.reduce((a, l) => a + mix[l], 0)
  const stale = personas.filter((p) => p.editorialVersion !== editorial.version).length

  return (
    <div className="page">
      <PageHead title="Buyers" sub="AI buyers your reps sell to. Each has a lead card the rep sees, and a hidden truth they have to uncover through good discovery." />

      <section className="card" style={{ marginBottom: 20 }}>
        <div className="card-pad row wrap" style={{ gap: 18 }}>
          {LEVELS.map((l) => (
            <label key={l} className="row small">
              <DiffBadge d={l} />
              <input type="number" min={0} max={6} value={mix[l]} onChange={(e) => setMix({ ...mix, [l]: Math.max(0, Math.min(6, Number(e.target.value) || 0)) })} style={{ width: 56, padding: '4px 6px' }} className="mono" />
            </label>
          ))}
          <button className="btn primary" disabled={busy || total === 0} onClick={generate} style={{ marginLeft: 'auto' }}>
            <Busy on={busy}>{busy ? `Creating ${total} buyers…` : `Create ${total} buyers`}</Busy>
          </button>
        </div>
        {(error || stale > 0) && (
          <div className="card-pad stack" style={{ paddingTop: 0 }}>
            <ErrorNote error={error} />
            {stale > 0 && <div className="notice warn">{stale} buyer(s) were made from an older version of the brief. They still work, but may miss recent changes.</div>}
          </div>
        )}
      </section>

      {personas.length === 0 ? (
        <Empty title="No buyers yet" body="Pick how many of each difficulty you want and create them. A mix works best: reps start easy and work up." />
      ) : (
        <div className="grid g2">{personas.map((p) => <PersonaCard key={p.id} p={p} />)}</div>
      )}
    </div>
  )
}
