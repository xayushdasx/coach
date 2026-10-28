import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getState, setState, uid, useStore } from '../lib/store'
import { runLearning } from '../prompts/p4-learning'
import { Busy, Empty, ErrorNote, PageHead } from '../components/ui'

export default function Learn() {
  const editorial = useStore((s) => s.editorial)
  const learning = useStore((s) => s.learning)
  const attempts = useStore((s) => s.quizAttempts)
  const trainee = useStore((s) => s.trainee)
  const [tab, setTab] = useState<'lessons' | 'quiz'>('lessons')
  const [lessonIdx, setLessonIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!editorial?.approved) {
    return (
      <div className="page">
        <Empty title="Approve the sales brief first" body="Lessons and the quiz are written from the approved brief." action={<Link className="btn primary" to="/brief">Go to Sales brief</Link>} />
      </div>
    )
  }

  async function generate() {
    setBusy(true)
    setError(null)
    try {
      setState({ learning: await runLearning(editorial!) })
      setLessonIdx(0)
      setAnswers({})
      setSubmitted(false)
    } catch (e) {
      setError(`Writing lessons failed: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const head = (
    <PageHead
      title="Lessons & quiz"
      sub="What a new rep studies before their first practice call, written from your sales brief."
      actions={
        <button className="btn" disabled={busy} onClick={generate}>
          <Busy on={busy}>{busy ? 'Writing…' : learning ? 'Rewrite from current brief' : 'Write lessons and quiz'}</Busy>
        </button>
      }
    />
  )

  if (!learning) {
    return (
      <div className="page">
        {head}
        <ErrorNote error={error} />
        <Empty title="No lessons yet" body="Generate a short course: one lesson per stage of your sales call, plus a 15-question quiz." />
      </div>
    )
  }

  const lesson = learning.lessons[lessonIdx]
  const score = learning.quiz.filter((q) => answers[q.id] === q.answerIndex).length
  const mine = attempts.filter((a) => a.trainee === (trainee || 'Unnamed'))

  function submit() {
    setSubmitted(true)
    const name = getState().trainee || 'Unnamed'
    setState((s) => ({
      quizAttempts: [...s.quizAttempts, { id: uid('q_'), trainee: name, at: Date.now(), answers: learning!.quiz.map((q) => answers[q.id] ?? -1), score, total: learning!.quiz.length }],
    }))
  }

  return (
    <div className="page">
      {head}
      <ErrorNote error={error} />
      {learning.editorialVersion !== editorial.version && (
        <div className="notice warn" style={{ marginBottom: 16 }}>These lessons were written from brief version {learning.editorialVersion}; the current brief is version {editorial.version}.</div>
      )}
      <div className="seg" style={{ marginBottom: 16 }}>
        <button className={tab === 'lessons' ? 'on' : ''} onClick={() => setTab('lessons')}>Lessons ({learning.lessons.length})</button>
        <button className={tab === 'quiz' ? 'on' : ''} onClick={() => setTab('quiz')}>Quiz ({learning.quiz.length})</button>
      </div>

      {tab === 'lessons' ? (
        <div className="grid" style={{ gridTemplateColumns: '240px minmax(0,1fr)', alignItems: 'start' }}>
          <nav className="card" style={{ padding: 6 }}>
            {learning.lessons.map((l, i) => (
              <button key={l.id} className={`nav-link ${i === lessonIdx ? 'active' : ''}`} style={{ width: '100%', border: 0, background: i === lessonIdx ? undefined : 'transparent', cursor: 'pointer', textAlign: 'left', font: 'inherit' }} onClick={() => setLessonIdx(i)}>
                <span className="row"><span className="nav-step">{i + 1}</span>{l.title}</span>
              </button>
            ))}
          </nav>
          {lesson && (
            <article className="card card-pad stack" style={{ gap: 14, maxWidth: 720 }}>
              <h2 style={{ fontSize: 22 }}>{lesson.title}</h2>
              <div className="prose">{lesson.body.split(/\n\s*\n/).map((p, i) => <p key={i}>{p}</p>)}</div>
              <div>
                <div className="kicker">Remember</div>
                <ul className="ticks">{lesson.keyPoints.map((k, i) => <li key={i}>{k}</li>)}</ul>
              </div>
              {lesson.example && (
                <div style={{ background: 'var(--sunken)', borderRadius: 8, padding: 14 }}>
                  <div className="kicker" style={{ marginBottom: 6 }}>Example</div>
                  {lesson.example.split('\n').map((l, i) => <p key={i} className="small" style={{ marginTop: i ? 4 : 0 }}>{l}</p>)}
                </div>
              )}
              <div className="row-between">
                <button className="btn" disabled={lessonIdx === 0} onClick={() => setLessonIdx(lessonIdx - 1)}>Previous</button>
                {lessonIdx < learning.lessons.length - 1 ? (
                  <button className="btn primary" onClick={() => setLessonIdx(lessonIdx + 1)}>Next lesson</button>
                ) : (
                  <button className="btn primary" onClick={() => setTab('quiz')}>Take the quiz</button>
                )}
              </div>
            </article>
          )}
        </div>
      ) : (
        <div className="stack" style={{ maxWidth: 760, gap: 14 }}>
          {mine.length > 0 && <p className="small muted">Your previous attempts: {mine.map((a) => `${a.score}/${a.total}`).join(', ')}</p>}
          {learning.quiz.map((q, qi) => (
            <div key={q.id} className="card card-pad stack" style={{ gap: 10 }}>
              <div className="row-between"><span className="kicker">Question {qi + 1} · {q.topic}</span></div>
              <b>{q.question}</b>
              <div className="stack" style={{ gap: 6 }}>
                {q.options.map((o, oi) => {
                  const chosen = answers[q.id] === oi
                  const right = submitted && oi === q.answerIndex
                  const wrong = submitted && chosen && oi !== q.answerIndex
                  return (
                    <label key={oi} className="row" style={{ padding: '8px 10px', borderRadius: 8, border: `1px solid ${right ? 'var(--good)' : wrong ? 'var(--bad)' : chosen ? 'var(--accent)' : 'var(--line)'}`, background: right ? 'var(--good-soft)' : wrong ? 'var(--bad-soft)' : 'transparent', cursor: submitted ? 'default' : 'pointer' }}>
                      <input type="radio" name={q.id} disabled={submitted} checked={chosen} onChange={() => setAnswers({ ...answers, [q.id]: oi })} />
                      <span>{o}</span>
                    </label>
                  )
                })}
              </div>
              {submitted && <p className="small muted">{q.explanation}</p>}
            </div>
          ))}
          <div className="card card-pad row-between">
            {submitted ? (
              <>
                <span><b className="mono">{score}/{learning.quiz.length}</b> correct</span>
                <button className="btn" onClick={() => { setAnswers({}); setSubmitted(false) }}>Try again</button>
              </>
            ) : (
              <>
                <span className="small muted">{Object.keys(answers).length} of {learning.quiz.length} answered</span>
                <button className="btn primary" disabled={Object.keys(answers).length < learning.quiz.length} onClick={submit}>Submit answers</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
