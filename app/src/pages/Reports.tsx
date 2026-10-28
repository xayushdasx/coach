import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { fmtDate, MODE_LABEL } from '../lib/format'
import { DiffBadge, Empty, PageHead } from '../components/ui'

export default function Reports() {
  const nav = useNavigate()
  const sessions = useStore((s) => s.sessions)
  const trainee = useStore((s) => s.trainee)
  const [mine, setMine] = useState(true)
  const list = [...sessions]
    .filter((s) => !mine || !trainee || s.trainee === trainee)
    .sort((a, b) => b.startedAt - a.startedAt)

  return (
    <div className="page">
      <PageHead
        title="Reports"
        sub="Every practice call with its score. Open one for the full breakdown."
        actions={
          trainee && (
            <div className="seg">
              <button className={mine ? 'on' : ''} onClick={() => setMine(true)}>{trainee}</button>
              <button className={!mine ? 'on' : ''} onClick={() => setMine(false)}>Everyone</button>
            </div>
          )
        }
      />
      {list.length === 0 ? (
        <Empty title="No calls yet" body="Reports appear here after each practice call." />
      ) : (
        <div className="card">
          <table className="t">
            <thead><tr><th>When</th><th>Trainee</th><th>Mode</th><th>Buyer</th><th>Outcome</th><th style={{ textAlign: 'right' }}>Score</th></tr></thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id} className="click" onClick={() => nav(s.report || s.endedAt ? `/reports/${s.id}` : `/call/${s.id}`)}>
                  <td className="muted">{fmtDate(s.startedAt)}</td>
                  <td>{s.trainee}</td>
                  <td>{MODE_LABEL[s.mode]}</td>
                  <td>{s.persona.visible.name} <DiffBadge d={s.persona.difficulty} /></td>
                  <td className="small muted">{s.report?.judgement?.outcome?.result ?? s.endReason ?? 'In progress'}</td>
                  <td style={{ textAlign: 'right' }}>
                    {s.report ? (
                      <span className={`badge mono ${s.report.passed ? 'good' : 'bad'}`}>{s.report.overall}{s.report.failedOnCompliance ? ' · compliance' : ''}</span>
                    ) : (
                      <span className="badge">{s.endedAt ? 'Not scored' : 'Open'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
