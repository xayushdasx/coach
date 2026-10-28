import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { fmtDate, MODE_LABEL } from '../lib/format'
import { PageHead } from '../components/ui'

export default function Overview() {
  const nav = useNavigate()
  const knowledge = useStore((s) => s.knowledge)
  const editorial = useStore((s) => s.editorial)
  const personas = useStore((s) => s.personas)
  const learning = useStore((s) => s.learning)
  const sessions = useStore((s) => s.sessions)
  const recent = [...sessions].sort((a, b) => b.startedAt - a.startedAt).slice(0, 6)

  const steps = [
    { to: '/company', title: 'Company', body: knowledge ? 'Knowledge extracted' : 'Describe how you sell and upload material', done: !!knowledge },
    { to: '/brief', title: 'Sales brief', body: editorial ? (editorial.approved ? `Version ${editorial.version} approved` : `Version ${editorial.version} waiting for approval`) : 'Generated from your company info', done: !!editorial?.approved },
    { to: '/buyers', title: 'Buyers', body: personas.length ? `${personas.length} buyer personas ready` : 'AI buyers your reps will sell to', done: personas.length > 0 },
    { to: '/learn', title: 'Lessons & quiz', body: learning ? `${learning.lessons.length} lessons, ${learning.quiz.length} questions` : 'What reps study before calling', done: !!learning },
  ]
  const ready = !!editorial?.approved && personas.length > 0

  return (
    <div className="page">
      <PageHead
        title="Sales coach"
        sub="Set up your company once. Your reps then learn how you sell, practise live voice calls against AI buyers, and get a scored report after every call."
        actions={
          <button className="btn primary" disabled={!ready} onClick={() => nav('/practice')}>
            Start a practice call
          </button>
        }
      />

      <div className="pipeline" style={{ marginBottom: 24 }}>
        {steps.map((s, i) => (
          <Link key={s.to} to={s.to} className={`pipe-step ${s.done ? 'done' : ''}`}>
            <span className="pipe-num">{s.done ? '✓' : `Step ${i + 1}`}</span>
            <span className="pipe-title">{s.title}</span>
            <span className="small muted">{s.body}</span>
          </Link>
        ))}
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Recent calls</h2>
          <Link to="/reports" className="btn ghost sm">All reports</Link>
        </div>
        {recent.length === 0 ? (
          <div className="card-pad muted">No practice calls yet. {ready ? 'Start one from Practice calls.' : 'Finish the setup steps above first.'}</div>
        ) : (
          <table className="t">
            <thead>
              <tr><th>Trainee</th><th>Buyer</th><th>Mode</th><th>When</th><th style={{ textAlign: 'right' }}>Score</th></tr>
            </thead>
            <tbody>
              {recent.map((s) => (
                <tr key={s.id} className="click" onClick={() => nav(s.report ? `/reports/${s.id}` : `/call/${s.id}`)}>
                  <td>{s.trainee}</td>
                  <td>{s.persona.visible.name}<div className="small faint">{s.persona.visible.title}, {s.persona.visible.company}</div></td>
                  <td>{MODE_LABEL[s.mode]}</td>
                  <td className="muted">{fmtDate(s.startedAt)}</td>
                  <td style={{ textAlign: 'right' }}>
                    {s.report ? (
                      <span className={`badge ${s.report.passed ? 'good' : 'bad'} mono`}>{s.report.overall}</span>
                    ) : (
                      <span className="badge">{s.endedAt ? 'Report pending' : 'In progress'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
