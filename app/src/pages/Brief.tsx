import { useState } from 'react'
import { Link } from 'react-router-dom'
import { setState, useStore } from '../lib/store'
import { normalise, reviseEditorial } from '../prompts/p2-editorial'
import type { Editorial } from '../lib/types'
import { Busy, Empty, ErrorNote, PageHead } from '../components/ui'

function List({ items }: { items: string[] }) {
  if (!items?.length) return <p className="faint small">Not provided</p>
  return <ul className="ticks">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
}

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="card">
      <div className="card-head"><h2>{title}</h2>{aside}</div>
      <div className="card-pad">{children}</div>
    </section>
  )
}

export default function Brief() {
  const editorial = useStore((s) => s.editorial)
  const [request, setRequest] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!editorial) {
    return (
      <div className="page">
        <Empty title="No sales brief yet" body="Extract your company knowledge first; the brief is written from it." action={<Link className="btn primary" to="/company">Go to Company</Link>} />
      </div>
    )
  }
  const e = editorial

  const save = (next: Editorial) => setState((s) => ({ editorial: next, editorialHistory: s.editorialHistory.map((h) => (h.version === next.version ? next : h)) }))

  function setWeight(id: string, w: number) {
    save({ ...e, approved: false, stages: e.stages.map((s) => (s.id === id ? { ...s, weight: w, active: w > 0 } : s)) })
  }

  async function revise() {
    setBusy(true)
    setError(null)
    try {
      const next = await reviseEditorial(e, request)
      setState((s) => ({ editorial: next, editorialHistory: [...s.editorialHistory, next] }))
      setRequest('')
    } catch (err) {
      setError(`Revision failed: ${(err as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const weightSum = e.stages.reduce((a, s) => a + s.weight, 0)

  return (
    <div className="page">
      <PageHead
        title="Sales brief"
        sub="The single source of truth for this coach. The AI buyers, the lessons and the judge all work from it. Check it, adjust the scorecard, then approve it."
        actions={
          <>
            <span className={`badge ${e.approved ? 'good' : 'warn'}`}>Version {e.version} · {e.approved ? 'Approved' : 'Not approved'}</span>
            {!e.approved && (
              <button className="btn primary" disabled={weightSum !== 100} onClick={() => save({ ...e, approved: true })}>
                Approve brief
              </button>
            )}
          </>
        }
      />

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) 340px', alignItems: 'start' }}>
        <div className="stack" style={{ gap: 16 }}>
          <Section title="Company & product">
            <div className="stack">
              <p>{e.companySummary}</p>
              <div className="grid g2">
                <div><div className="kicker">Product</div><b>{e.product.name}</b><p className="small muted">{e.product.description}</p></div>
                <div><div className="kicker">Pricing</div><p className="small">{e.product.pricing}</p>{e.product.financing && <p className="small muted">{e.product.financing}</p>}</div>
              </div>
              <div className="grid g2">
                <div><div className="kicker">Key features</div><List items={e.product.keyFeatures} /></div>
                <div><div className="kicker">Outcomes</div><List items={e.product.outcomes} /></div>
              </div>
            </div>
          </Section>

          <Section title="Target customer">
            <p style={{ marginBottom: 12 }}>{e.targetCustomer.icp}</p>
            <div className="grid g2">
              {e.targetCustomer.segments.map((s, i) => (
                <div key={i} className="card card-pad" style={{ boxShadow: 'none' }}>
                  <b>{s.name}</b> <span className="faint small">· {s.role}</span>
                  <div className="kicker" style={{ marginTop: 8 }}>Pains</div><List items={s.pains} />
                  <div className="kicker" style={{ marginTop: 8 }}>Goals</div><List items={s.goals} />
                </div>
              ))}
            </div>
          </Section>

          <Section title="Sales motion">
            <div className="grid g2">
              <div><div className="kicker">Type & channel</div><p>{e.salesMotion.type} · {e.salesMotion.channel} · ~{e.salesMotion.typicalCallMinutes} min</p></div>
              <div><div className="kicker">Methodology</div><p className="small">{e.methodology}</p></div>
              <div><div className="kicker">Call objective</div><p>{e.salesMotion.callObjective}</p></div>
              <div><div className="kicker">A successful call ends with</div><p>{e.salesMotion.successOutcome}</p></div>
            </div>
          </Section>

          <Section title="Discovery checklist" aside={<span className="small faint">What reps must uncover</span>}>
            <table className="t">
              <tbody>
                {e.discoveryChecklist.map((d) => (
                  <tr key={d.id}><td className="mono faint" style={{ width: 40 }}>{d.id}</td><td><b>{d.item}</b><div className="small muted">{d.why}</div></td></tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title="Objection library">
            <div className="stack">
              {e.objections.map((o) => (
                <div key={o.id} className="stack" style={{ gap: 4 }}>
                  <div className="row"><span className="mono faint small">{o.id}</span><b>“{o.objection}”</b></div>
                  <div className="small muted">Usually means: {o.realCauses.join('; ')}</div>
                  <div className="small">{o.responsePattern}</div>
                </div>
              ))}
            </div>
          </Section>

          <div className="grid g2">
            <Section title="Value & proof">
              <div className="kicker">Value propositions</div><List items={e.valueProps} />
              <div className="kicker" style={{ marginTop: 10 }}>Approved proof points</div><List items={e.proofPoints} />
            </Section>
            <Section title="Pricing rules">
              <p className="small"><b>List price:</b> {e.pricingRules.listPrice}</p>
              <div className="kicker" style={{ marginTop: 10 }}>Discounts</div><List items={e.pricingRules.discountRules} />
              <div className="kicker" style={{ marginTop: 10 }}>Negotiation</div><List items={e.pricingRules.negotiationGuidance} />
            </Section>
          </div>

          <Section title="Compliance">
            <div className="grid g2">
              <div><div className="kicker" style={{ color: 'var(--bad)' }}>Never say</div><List items={e.compliance.neverSay} /></div>
              <div><div className="kicker" style={{ color: 'var(--good)' }}>Always say</div><List items={e.compliance.mustSay} /></div>
            </div>
          </Section>

          <Section title="Competitors">
            <table className="t"><tbody>{e.competitors.map((c, i) => <tr key={i}><td style={{ width: 180 }}><b>{c.name}</b></td><td className="small">{c.howWeWin}</td></tr>)}</tbody></table>
          </Section>

          <Section title="Product facts" aside={<span className="small faint">The judge checks rep claims against these</span>}>
            <List items={e.facts} />
          </Section>

          <Section title="What good looks like, by stage">
            <div className="stack" style={{ gap: 16 }}>
              {e.stages.filter((s) => s.active).map((s) => (
                <div key={s.id}>
                  <div className="row-between"><b>{s.name}</b><span className="mono small faint">{s.weight}%</span></div>
                  <p className="small muted">{s.goal}</p>
                  <div className="grid g2" style={{ marginTop: 6 }}>
                    <div><div className="kicker">Look for</div><List items={s.lookFors} /></div>
                    <div className="small stack" style={{ gap: 4 }}>
                      <div><span className="badge bad mono">1</span> {s.anchors['1']}</div>
                      <div><span className="badge warn mono">3</span> {s.anchors['3']}</div>
                      <div><span className="badge good mono">5</span> {s.anchors['5']}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </div>

        <div className="stack" style={{ gap: 16, position: 'sticky', top: 72, maxHeight: 'calc(100vh - 88px)', overflowY: 'auto' }}>
          <section className="card">
            <div className="card-head"><h2>Scorecard</h2><span className={`badge mono ${weightSum === 100 ? '' : 'bad'}`}>{weightSum}/100</span></div>
            <div className="card-pad stack" style={{ gap: 8 }}>
              {e.stages.map((s) => (
                <div key={s.id} className="row-between small">
                  <span className={s.weight ? '' : 'faint'}>{s.name}</span>
                  <input type="number" min={0} max={100} value={s.weight} onChange={(ev) => setWeight(s.id, Math.max(0, Number(ev.target.value) || 0))} style={{ width: 64, padding: '4px 6px' }} className="mono" />
                </div>
              ))}
              <div className="row-between small" style={{ marginTop: 6 }}>
                <span>Pass mark</span>
                <input type="number" min={0} max={100} value={e.passMark} onChange={(ev) => save({ ...e, approved: false, passMark: Number(ev.target.value) || 0 })} style={{ width: 64, padding: '4px 6px' }} className="mono" />
              </div>
              <p className="small faint">Weights must total 100. 0 turns a stage off. Any critical compliance issue fails the call regardless of score.</p>
              {weightSum !== 100 && <button className="btn sm" onClick={() => save(normalise({ ...e, approved: false }))}>Scale to 100</button>}
            </div>
          </section>

          <section className="card">
            <div className="card-pad stack">
              <h3>Ask for changes</h3>
              <textarea rows={4} value={request} placeholder="e.g. Add the objection 'we signed with a competitor last year'. Weight closing higher." onChange={(ev) => setRequest(ev.target.value)} />
              <button className="btn" disabled={busy || !request.trim()} onClick={revise}>
                <Busy on={busy}>{busy ? 'Revising…' : 'Revise brief'}</Busy>
              </button>
              <ErrorNote error={error} />
              <p className="small faint">Each revision creates a new version. Reports keep a link to the version they were scored against.</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
