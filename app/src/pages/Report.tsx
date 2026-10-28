import { Fragment, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getState, setState, uid, useStore } from '../lib/store'
import { generateAndSave } from '../lib/report'
import { normaliseJudgement } from '../prompts/p6-judge'
import { normaliseNarrative } from '../prompts/p7-report'
import { TARGETS } from '../lib/metrics'
import { fmtClock, fmtDate, MODE_LABEL, scoreTone } from '../lib/format'
import type { Metrics, Session } from '../lib/types'
import { TraceLegend, TrustTrace } from '../components/TrustTrace'
import { Busy, DiffBadge, Empty, ErrorNote, Pips, Quote } from '../components/ui'

const STATUS_BADGE = { found: 'good', partial: 'warn', missed: 'bad' } as const
const HANDLING_BADGE = { strong: 'good', adequate: 'accent', weak: 'warn', unaddressed: 'bad' } as const
const VERDICT_BADGE = { correct: 'good', incorrect: 'bad', unverifiable: 'warn' } as const

function Card({ title, aside, children, pad = true }: { title: string; aside?: React.ReactNode; children: React.ReactNode; pad?: boolean }) {
  return (
    <section className="card">
      <div className="card-head"><h2>{title}</h2>{aside}</div>
      {pad ? <div className="card-pad">{children}</div> : children}
    </section>
  )
}

function inRange(v: number, t: { lo?: number; hi?: number }) {
  return (t.lo == null || v >= t.lo) && (t.hi == null || v <= t.hi)
}

function MetricsGrid({ m }: { m: Metrics }) {
  const cells: { l: string; v: string; target?: string; ok?: boolean }[] = [
    { l: 'Call length', v: fmtClock(m.durationSec * 1000) },
    { l: 'You talked', v: `${m.talkRatio}%`, target: TARGETS.talkRatio.label, ok: inRange(m.talkRatio, TARGETS.talkRatio) },
    { l: 'Longest monologue', v: `${m.longestMonologueSec}s`, target: TARGETS.longestMonologueSec.label, ok: inRange(m.longestMonologueSec, TARGETS.longestMonologueSec) },
    { l: 'Speaking pace', v: `${m.wpm} wpm`, target: TARGETS.wpm.label, ok: m.wpm === 0 || inRange(m.wpm, TARGETS.wpm) },
    { l: 'Questions asked', v: `${m.questionsAsked}`, target: `${m.openQuestions} open` },
    { l: 'Interruptions', v: `${m.interruptions}`, target: TARGETS.interruptions.label, ok: inRange(m.interruptions, TARGETS.interruptions) },
    { l: 'Filler words', v: `${m.fillersPerMin}/min`, target: `${m.fillerCount} total, as transcribed`, ok: inRange(m.fillersPerMin, TARGETS.fillersPerMin) },
    { l: 'Avg. response gap', v: `${m.avgResponseLatencySec}s` },
    { l: 'First question at', v: m.timeToFirstQuestionSec == null ? 'Never' : fmtClock(m.timeToFirstQuestionSec * 1000) },
    { l: 'Price first mentioned', v: m.timeToPriceSec == null ? 'Never' : fmtClock(m.timeToPriceSec * 1000) },
    { l: 'Your talk time', v: fmtClock(m.repTalkSec * 1000), target: `buyer ${fmtClock(m.buyerTalkSec * 1000)}` },
    { l: 'Buyer trust', v: `${m.finalTrust}/10`, target: `peak ${m.peakTrust}, low ${m.lowestTrust}` },
  ]
  return (
    <div className="metrics">
      {cells.map((c) => (
        <div key={c.l} className="metric">
          <div className="metric-l">{c.l}</div>
          <div className="metric-v">{c.v}</div>
          {c.target && (
            <div className="metric-t" style={{ color: c.ok == null ? 'var(--ink-3)' : c.ok ? 'var(--good)' : 'var(--bad)' }}>
              {c.ok == null ? c.target : `${c.ok ? 'On target' : 'Off target'} · ${c.target}`}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default function ReportPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const session = useStore((s) => s.sessions.find((x) => x.id === id))
  const editorialHistory = useStore((s) => s.editorialHistory)
  const [openStage, setOpenStage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!session) return <div className="page"><Empty title="Report not found" body="This call doesn’t exist in this browser." action={<Link className="btn" to="/reports">All reports</Link>} /></div>
  const ed = editorialHistory.find((e) => e.version === session.editorialVersion)
  const r = session.report
  if (!r) {
    return (
      <div className="page">
        <Empty
          title="No report yet"
          body={session.reportError ? `Scoring failed: ${session.reportError}` : session.endedAt ? 'Scoring hasn’t finished for this call.' : 'This call is still in progress.'}
          action={
            session.endedAt ? (
              <button className="btn primary" disabled={busy} onClick={async () => { setBusy(true); await generateAndSave(session.id); setBusy(false) }}>
                <Busy on={busy}>{busy ? 'Scoring…' : 'Score this call'}</Busy>
              </button>
            ) : <Link className="btn primary" to={`/call/${session.id}`}>Back to call</Link>
          }
        />
      </div>
    )
  }

  const j = normaliseJudgement(r.judgement)
  const narrative = normaliseNarrative(r.narrative)
  const p = session.persona
  const factLabel = (fid: string) => {
    const f = p.hiddenFacts.find((x) => x.id === fid)
    const item = ed?.discoveryChecklist.find((d) => d.id === f?.checklistId)?.item
    return { item: item ?? f?.checklistId ?? fid, fact: f?.fact ?? '' }
  }
  const start = p.difficulty === 'easy' ? 5 : p.difficulty === 'medium' ? 4 : 3
  const found = j.discovery.filter((d) => d.status === 'found').length

  function startNext() {
    const nd = narrative.nextDrill
    const pool = getState().personas
    const pick = pool.find((x) => x.difficulty === nd.difficulty && x.id !== session!.personaId) ?? pool.find((x) => x.difficulty === nd.difficulty) ?? pool[0]
    if (!pick) return nav('/practice')
    const s: Session = { id: uid('c_'), trainee: session!.trainee, personaId: pick.id, persona: pick, editorialVersion: getState().editorial!.version, mode: nd.mode, startedAt: Date.now(), prepPlan: '', crmNotes: '', followUp: '', turns: [], states: [] }
    setState((st) => ({ sessions: [...st.sessions, s] }))
    nav(`/call/${s.id}`)
  }

  return (
    <div className="page" style={{ maxWidth: 1240 }}>
      <div className="row small muted" style={{ marginBottom: 10 }}>
        <Link to="/reports">Reports</Link><span>/</span><span>{session.trainee}</span><span>·</span><span>{fmtDate(session.startedAt)}</span>
      </div>

      {/* Verdict */}
      <section className="card" style={{ marginBottom: 16 }}>
        <div className="card-pad grid" style={{ gridTemplateColumns: '220px minmax(0,1fr)', gap: 28, alignItems: 'start' }}>
          <div className="stack" style={{ gap: 8 }}>
            <span className="kicker">Overall</span>
            <div className="row" style={{ alignItems: 'baseline' }}>
              <span className="score-big" style={{ color: r.passed ? 'var(--good)' : 'var(--bad)' }}>{r.overall}</span>
              <span className="faint mono">/100</span>
            </div>
            <div className="row wrap">
              <span className={`badge ${r.passed ? 'good' : 'bad'}`}>{r.passed ? 'Passed' : r.failedOnCompliance ? 'Failed: compliance' : 'Below pass mark'}</span>
              <span className="badge mono">pass {ed?.passMark ?? 70}</span>
            </div>
            <div className="small muted">{MODE_LABEL[session.mode]} · {p.visible.name} <DiffBadge d={p.difficulty} /></div>
          </div>
          <div className="stack" style={{ gap: 10 }}>
            <h1 style={{ fontSize: 24 }}>{narrative.headline}</h1>
            <p className="muted">{narrative.summary}</p>
            <div className="row wrap small">
              <span className="badge">{j.outcome.result}</span>
              <span className={`badge ${j.outcome.deserved ? 'good' : 'warn'}`}>{j.outcome.deserved ? 'Outcome earned' : 'Outcome not earned'}</span>
              <span className={`badge ${j.nextStep.agreed && j.nextStep.specific ? 'good' : j.nextStep.agreed ? 'warn' : 'bad'}`}>
                {j.nextStep.agreed ? (j.nextStep.specific ? 'Specific next step' : 'Vague next step') : 'No next step'}
              </span>
              <span className="badge">{found}/{j.discovery.length} facts uncovered</span>
            </div>
            <p className="small faint">{j.outcome.why}</p>
          </div>
        </div>
      </section>

      {r.failedOnCompliance && (
        <div className="notice bad" style={{ marginBottom: 16 }}>
          <b>This call fails on compliance.</b> A critical rule was broken; the call can’t pass regardless of its score. Details are in the Compliance section below.
        </div>
      )}

      {/* Trust trace */}
      <Card title="How the buyer’s trust moved" aside={<TraceLegend />}>
        <TrustTrace turns={session.turns} states={session.states} start={start} height={190} />
      </Card>

      <div className="grid g2" style={{ marginTop: 16, alignItems: 'start' }}>
        {/* Stage scores */}
        <Card title="Scorecard" aside={<span className="small faint">weighted from the sales brief</span>} pad={false}>
          <table className="t">
            <thead><tr><th>Stage</th><th>Weight</th><th>Score</th></tr></thead>
            <tbody>
              {r.stageWeighted.map((s) => {
                const js = j.stageScores.find((x) => x.stageId === s.stageId)
                const open = openStage === s.stageId
                return (
                  <Fragment key={s.stageId}>
                    <tr className="click" onClick={() => setOpenStage(open ? null : s.stageId)}>
                      <td><b>{s.name}</b>{js && !js.reached && s.score != null && <span className="small faint"> · not reached</span>}</td>
                      <td className="mono faint">{s.weight}%</td>
                      <td><div className="row"><Pips score={s.score} /><span className="mono small">{s.score == null ? '—' : s.score}</span></div></td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={3} style={{ background: '#fafbfa' }}>
                          <div className="stack small" style={{ gap: 8 }}>
                            {s.stageId === 'communication' ? (
                              <>
                                <p>Combines the measured metrics, clarity ({j.clarity.score}/5) and call control ({j.callControl.score}/5).</p>
                                <p className="muted">{j.callControl.notes}</p>
                              </>
                            ) : s.stageId === 'prep' ? (
                              <p>{j.prepPlan.notes || 'No plan written.'}</p>
                            ) : (
                              <p>{js?.rationale}</p>
                            )}
                            {!!js?.lookForsHit?.length && <div><span className="kicker" style={{ color: 'var(--good)' }}>Did</span><ul className="ticks">{js.lookForsHit.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
                            {!!js?.lookForsMissed?.length && <div><span className="kicker" style={{ color: 'var(--bad)' }}>Missed</span><ul className="ticks">{js.lookForsMissed.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
                            {js?.evidence?.map((e, i) => <Quote key={i} text={e.quote} turn={e.turn} />)}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
          <div className="card-pad small faint" style={{ borderTop: '1px solid var(--line)' }}>Click a stage for the reasoning and evidence. Tone, empathy and confidence are not scored.</div>
        </Card>

        {/* Focus + next drill */}
        <div className="stack" style={{ gap: 16 }}>
          <Card title="Focus on next">
            <div className="stack" style={{ gap: 14 }}>
              {narrative.focusAreas.map((f, i) => (
                <div key={i} className="stack" style={{ gap: 3 }}>
                  <b>{i + 1}. {f.title}</b>
                  <p className="small muted">{f.why}</p>
                  <p className="small"><span className="faint">Practise:</span> {f.drill}</p>
                </div>
              ))}
              <div className="divider" style={{ margin: 0 }} />
              <div className="row-between">
                <div className="small">
                  <b>Recommended next:</b> {MODE_LABEL[narrative.nextDrill.mode]} · <DiffBadge d={narrative.nextDrill.difficulty} />
                  <p className="muted" style={{ marginTop: 4 }}>{narrative.nextDrill.why}</p>
                </div>
              </div>
              <button className="btn primary" onClick={startNext}>Start recommended drill</button>
            </div>
          </Card>
          <div className="grid g2">
            <Card title="Strengths">
              <div className="stack">{j.strengths.map((s, i) => <div key={i} className="stack" style={{ gap: 4 }}><b className="small">{s.point}</b><Quote text={s.quote} turn={s.turn} /></div>)}</div>
            </Card>
            <Card title="To improve">
              <div className="stack">{j.improvements.map((s, i) => <div key={i} className="stack" style={{ gap: 4 }}><b className="small">{s.point}</b><Quote text={s.quote} turn={s.turn} /></div>)}</div>
            </Card>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <section className="card" style={{ marginTop: 16 }}>
        <div className="card-head"><h2>Call metrics</h2><span className="small faint">measured from the audio timings and transcript</span></div>
        <MetricsGrid m={r.metrics} />
      </section>

      <div className="grid g2" style={{ marginTop: 16, alignItems: 'start' }}>
        {/* Discovery */}
        <Card title="Discovery coverage" aside={<span className="mono small">{found}/{j.discovery.length}</span>} pad={false}>
          <table className="t">
            <tbody>
              {j.discovery.map((d) => {
                const l = factLabel(d.factId)
                return (
                  <tr key={d.factId}>
                    <td style={{ width: 86 }}><span className={`badge ${STATUS_BADGE[d.status]}`}>{d.status}</span></td>
                    <td>
                      <b className="small">{l.item}</b>
                      <div className="small muted">{l.fact}</div>
                      {d.howFound && <div className="small faint" style={{ marginTop: 3 }}>{d.turn != null && <span className="mono">#{d.turn} </span>}{d.howFound}</div>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>

        {/* Objections */}
        <Card title="Objections" aside={<span className="mono small">{j.objections.length}</span>} pad={false}>
          {j.objections.length === 0 ? (
            <div className="card-pad small muted">The buyer raised no objections on this call.</div>
          ) : (
            <table className="t">
              <tbody>
                {j.objections.map((o, i) => (
                  <tr key={i}>
                    <td>
                      <div className="row-between"><b className="small">“{o.objection}”</b><span className={`badge ${HANDLING_BADGE[o.handling]}`}>{o.handling}</span></div>
                      <div className="small muted" style={{ marginTop: 3 }}><span className="mono faint">#{o.turn}</span> {o.whatHappened}</div>
                      <div className="small" style={{ marginTop: 3 }}>{o.realCauseFound ? '✓ Found the real cause' : '✗ Didn’t find the real cause'}</div>
                      <div className="small" style={{ marginTop: 6, background: 'var(--accent-soft)', padding: '6px 8px', borderRadius: 6 }}><b>Better:</b> {o.better}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {/* Compliance */}
        <Card title="Compliance" aside={<span className={`badge ${j.compliance.length ? (r.failedOnCompliance ? 'bad' : 'warn') : 'good'}`}>{j.compliance.length ? `${j.compliance.length} issue(s)` : 'Clean'}</span>}>
          {j.compliance.length === 0 ? (
            <p className="small muted">No rule was broken and every required statement was made.</p>
          ) : (
            <div className="stack">
              {j.compliance.map((c, i) => (
                <div key={i} className="stack" style={{ gap: 4 }}>
                  <div className="row"><span className={`badge ${c.severity === 'critical' ? 'bad' : 'warn'}`}>{c.severity}</span><b className="small">{c.kind === 'violation' ? 'Broke' : 'Didn’t say'}: {c.rule}</b></div>
                  <Quote text={c.quote} turn={c.turn} />
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Fact checks */}
        <Card title="Product claims" aside={<span className="small faint">checked against the brief</span>} pad={false}>
          {j.factChecks.length === 0 ? (
            <div className="card-pad small muted">No specific product claims were made.</div>
          ) : (
            <table className="t">
              <tbody>
                {j.factChecks.map((f, i) => (
                  <tr key={i}>
                    <td style={{ width: 108 }}><span className={`badge ${VERDICT_BADGE[f.verdict]}`}>{f.verdict}</span></td>
                    <td className="small"><span className="mono faint">#{f.turn}</span> {f.claim}{f.correction && <div className="muted" style={{ marginTop: 3 }}>{f.correction}</div>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {/* Questions & communication */}
        <Card title="Questions & clarity">
          <div className="stack">
            <div className="grid g3">
              <div><div className="metric-l">Open</div><div className="metric-v">{j.questions.open}</div></div>
              <div><div className="metric-l">Closed</div><div className="metric-v">{j.questions.closed}</div></div>
              <div><div className="metric-l">Leading</div><div className="metric-v">{j.questions.leading}</div></div>
            </div>
            {j.questions.bestQuestion && <div><span className="kicker" style={{ color: 'var(--good)' }}>Best question</span><Quote text={j.questions.bestQuestion} /></div>}
            {j.questions.weakestQuestion && <div><span className="kicker" style={{ color: 'var(--bad)' }}>Weakest question</span><Quote text={j.questions.weakestQuestion} /></div>}
            <div className="divider" style={{ margin: 0 }} />
            <div className="row-between"><b className="small">Clarity</b><Pips score={j.clarity.score} /></div>
            {j.clarity.issues.map((c, i) => <div key={i} className="stack" style={{ gap: 3 }}><span className="small">{c.issue}</span><Quote text={c.quote} turn={c.turn} /></div>)}
            <div className="row-between"><b className="small">Call control</b><Pips score={j.callControl.score} /></div>
            <p className="small muted">{j.callControl.notes}</p>
          </div>
        </Card>

        {/* Methodology */}
        <Card title="Methodology" aside={<span className="small faint">{ed?.methodology.split(/[.:(]/)[0]}</span>}>
          <div className="grid g2">
            <div><div className="kicker" style={{ color: 'var(--good)' }}>Followed</div><ul className="ticks small">{j.methodology.followed.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
            <div><div className="kicker" style={{ color: 'var(--bad)' }}>Missed</div><ul className="ticks small">{j.methodology.missed.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
          </div>
          <div className="divider" />
          <div className="small"><b>Next step:</b> {j.nextStep.detail || 'None agreed'}</div>
        </Card>
      </div>

      {/* Rewrites */}
      <section className="card" style={{ marginTop: 16 }}>
        <div className="card-head"><h2>Say it better</h2><span className="small faint">your weakest moments, rewritten</span></div>
        <table className="t">
          <thead><tr><th style={{ width: 50 }}>Turn</th><th>You said</th><th>Stronger</th></tr></thead>
          <tbody>
            {j.rewrites.map((w, i) => (
              <tr key={i}>
                <td className="mono faint">#{w.turn}</td>
                <td className="small muted">“{w.original}”</td>
                <td className="small"><div>“{w.better}”</div><div className="faint" style={{ marginTop: 4 }}>{w.why}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Written work */}
      <div className="grid g3" style={{ marginTop: 16, alignItems: 'start' }}>
        {[
          { t: 'Pre-call plan', score: j.prepPlan.score, body: j.prepPlan.notes, extra: j.prepPlan.followedPlan == null ? null : j.prepPlan.followedPlan ? 'You followed your plan.' : 'You drifted from your plan.', text: session.prepPlan },
          { t: 'CRM notes', score: j.crmNotes.score, body: [...j.crmNotes.accurate.map((x) => `✓ ${x}`), ...j.crmNotes.missingOrWrong.map((x) => `✗ ${x}`)].join('\n'), extra: null, text: session.crmNotes },
          { t: 'Follow-up email', score: j.followUp.score, body: j.followUp.notes, extra: null, text: session.followUp },
        ].map((w) => (
          <Card key={w.t} title={w.t} aside={w.score == null ? <span className="badge">Not written</span> : <Pips score={w.score} />}>
            {w.score == null ? <p className="small faint">Nothing written, so not scored.</p> : (
              <div className="stack small">
                <p style={{ whiteSpace: 'pre-wrap' }}>{w.body}</p>
                {w.extra && <p className="muted">{w.extra}</p>}
                <details><summary className="faint" style={{ cursor: 'pointer' }}>What you wrote</summary><p style={{ whiteSpace: 'pre-wrap', marginTop: 6 }} className="muted">{w.text}</p></details>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Transcript */}
      <section className="card" style={{ marginTop: 16 }}>
        <div className="card-head"><h2>Transcript</h2><span className="small faint">{session.turns.length} turns · {session.endReason}</span></div>
        <div className="card-pad transcript">
          {session.turns.map((t, i) => {
            const st = t.speaker === 'buyer' ? session.states.find((s) => s.turnIndex === i) : undefined
            return (
              <div key={i} className={`line ${t.speaker}`}>
                <span className="line-time">#{i} {fmtClock(t.startMs)}</span>
                <div>
                  <div className="line-who row">
                    {t.speaker === 'rep' ? session.trainee : p.visible.name}
                    {t.interrupted && <span className="badge warn">cut in</span>}
                    {st && <span className="mono faint" style={{ textTransform: 'none', letterSpacing: 0 }}>trust {st.trust}</span>}
                    {st?.revealedFactIds.map((f) => <span key={f} className="badge good" style={{ textTransform: 'none', letterSpacing: 0 }}>revealed: {factLabel(f).item}</span>)}
                    {st?.objectionRaised && <span className="badge live" style={{ textTransform: 'none', letterSpacing: 0 }}>objection</span>}
                  </div>
                  <div className="line-text">{t.text}</div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <div className="row" style={{ marginTop: 16, justifyContent: 'space-between' }}>
        <span className="small faint">Scored against sales brief v{session.editorialVersion} · overall = weighted stage scores · <span className={`badge ${scoreTone(r.communicationScore)}`}>communication {r.communicationScore}/5</span></span>
        <button className="btn ghost sm" disabled={busy} onClick={async () => { setBusy(true); await generateAndSave(session.id); setBusy(false) }}>
          <Busy on={busy}>Re-score</Busy>
        </button>
      </div>
      <ErrorNote error={session.reportError ?? null} />
    </div>
  )
}
