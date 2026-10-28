import { useStore } from '../lib/store'
import { normaliseJudgement } from '../prompts/p6-judge'
import { fmtDate, scoreTone } from '../lib/format'
import type { Session } from '../lib/types'
import { Bar, Empty, PageHead } from '../components/ui'

const HEAT: Record<string, string> = { good: 'var(--good-soft)', warn: 'var(--warn-soft)', bad: 'var(--bad-soft)', none: 'transparent' }

function avg(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
}

export default function Team() {
  const sessions = useStore((s) => s.sessions)
  const editorial = useStore((s) => s.editorial)
  const quizAttempts = useStore((s) => s.quizAttempts)
  const scored = sessions.filter((s) => s.report)

  if (scored.length === 0) {
    return (
      <div className="page">
        <PageHead title="Team" />
        <Empty title="No scored calls yet" body="Once reps finish practice calls, this page shows who is ready, who is struggling, and where the whole team is weak." />
      </div>
    )
  }

  const byTrainee = new Map<string, Session[]>()
  scored.forEach((s) => byTrainee.set(s.trainee, [...(byTrainee.get(s.trainee) ?? []), s]))
  const stages = (editorial?.stages ?? []).filter((s) => s.active)
  const passMark = editorial?.passMark ?? 70

  // Weakest areas across the team.
  const missed = new Map<string, number>()
  const objections = new Map<string, { n: number; weak: number }>()
  let compliance = 0
  scored.forEach((s) => {
    const j = normaliseJudgement(s.report!.judgement)
    j.discovery.forEach((d) => {
      if (d.status === 'found') return
      const f = s.persona.hiddenFacts.find((x) => x.id === d.factId)
      const item = editorial?.discoveryChecklist.find((c) => c.id === f?.checklistId)?.item ?? f?.checklistId ?? d.factId
      missed.set(item, (missed.get(item) ?? 0) + 1)
    })
    j.objections.forEach((o) => {
      const key = o.objection.length > 70 ? o.objection.slice(0, 70) + '…' : o.objection
      const cur = objections.get(key) ?? { n: 0, weak: 0 }
      objections.set(key, { n: cur.n + 1, weak: cur.weak + (o.handling === 'weak' || o.handling === 'unaddressed' ? 1 : 0) })
    })
    compliance += j.compliance.filter((c) => c.severity === 'critical').length
  })
  const topMissed = [...missed.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  const topObj = [...objections.entries()].filter(([, v]) => v.weak > 0).sort((a, b) => b[1].weak - a[1].weak).slice(0, 6)

  const rows = [...byTrainee.entries()].map(([name, list]) => {
    const sorted = [...list].sort((a, b) => a.startedAt - b.startedAt)
    const scores = sorted.map((s) => s.report!.overall)
    const recent = scores.slice(-3)
    const fullPasses = sorted.filter((s) => s.mode === 'full' && s.report!.passed && ['hard', 'expert'].includes(s.persona.difficulty)).length
    const quiz = quizAttempts.filter((q) => q.trainee === name)
    return {
      name,
      calls: list.length,
      avg: Math.round(avg(scores) ?? 0),
      recentAvg: Math.round(avg(recent) ?? 0),
      trend: scores.length > 1 ? scores[scores.length - 1] - scores[0] : 0,
      passRate: Math.round((list.filter((s) => s.report!.passed).length / list.length) * 100),
      last: sorted.at(-1)!.startedAt,
      quizBest: quiz.length ? Math.max(...quiz.map((q) => Math.round((q.score / q.total) * 100))) : null,
      ready: fullPasses >= 2 && (avg(recent) ?? 0) >= passMark,
      stage: Object.fromEntries(stages.map((st) => [st.id, avg(list.map((s) => s.report!.stageWeighted.find((x) => x.stageId === st.id)?.score).filter((x): x is number => x != null))])),
    }
  })

  return (
    <div className="page" style={{ maxWidth: 1240 }}>
      <PageHead title="Team" sub={`Readiness = at least two passed full calls against hard or expert buyers, and an average of ${passMark}+ over the last three calls.`} />

      <section className="card" style={{ marginBottom: 16 }}>
        <table className="t">
          <thead><tr><th>Rep</th><th>Status</th><th>Calls</th><th style={{ width: 180 }}>Avg score</th><th>Last 3</th><th>Trend</th><th>Pass rate</th><th>Quiz</th><th>Last call</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <td><b>{r.name}</b></td>
                <td><span className={`badge ${r.ready ? 'good' : 'warn'}`}>{r.ready ? 'Ready for real calls' : 'In training'}</span></td>
                <td className="mono">{r.calls}</td>
                <td><div className="row"><span className="mono" style={{ width: 28 }}>{r.avg}</span><div style={{ flex: 1 }}><Bar value={r.avg} /></div></div></td>
                <td className="mono">{r.recentAvg}</td>
                <td className="mono" style={{ color: r.trend > 0 ? 'var(--good)' : r.trend < 0 ? 'var(--bad)' : 'var(--ink-3)' }}>{r.trend > 0 ? '+' : ''}{r.trend}</td>
                <td className="mono">{r.passRate}%</td>
                <td className="mono">{r.quizBest == null ? '—' : `${r.quizBest}%`}</td>
                <td className="small muted">{fmtDate(r.last)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card" style={{ marginBottom: 16, overflowX: 'auto' }}>
        <div className="card-head"><h2>Stage scores by rep</h2><span className="small faint">average, 1–5</span></div>
        <table className="t">
          <thead><tr><th>Rep</th>{stages.map((s) => <th key={s.id} style={{ textAlign: 'center' }}>{s.name}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <td><b>{r.name}</b></td>
                {stages.map((s) => {
                  const v = r.stage[s.id]
                  return <td key={s.id} className="mono" style={{ textAlign: 'center', background: HEAT[scoreTone(v)] }}>{v == null ? '—' : v.toFixed(1)}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="grid g3" style={{ alignItems: 'start' }}>
        <section className="card">
          <div className="card-head"><h2>Most-missed discovery</h2></div>
          <div className="card-pad">
            {topMissed.length === 0 ? <p className="small muted">Nothing missed so far.</p> : (
              <ul className="clean">{topMissed.map(([k, n]) => <li key={k} className="row-between small"><span>{k}</span><span className="mono faint">{n}×</span></li>)}</ul>
            )}
          </div>
        </section>
        <section className="card">
          <div className="card-head"><h2>Objections handled poorly</h2></div>
          <div className="card-pad">
            {topObj.length === 0 ? <p className="small muted">No weak objection handling so far.</p> : (
              <ul className="clean">{topObj.map(([k, v]) => <li key={k} className="row-between small" style={{ gap: 12 }}><span>“{k}”</span><span className="mono faint">{v.weak}/{v.n}</span></li>)}</ul>
            )}
          </div>
        </section>
        <section className="card">
          <div className="card-head"><h2>Compliance</h2></div>
          <div className="card-pad stack" style={{ gap: 4 }}>
            <span className="score-big" style={{ fontSize: 40, color: compliance ? 'var(--bad)' : 'var(--good)' }}>{compliance}</span>
            <span className="small muted">critical issues across {scored.length} calls</span>
          </div>
        </section>
      </div>
    </div>
  )
}
