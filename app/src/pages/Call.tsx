import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getState, updateSession, useStore } from '../lib/store'
import { speak, transcribe } from '../lib/ai'
import { CallEngine, type Phase } from '../lib/voice'
import { buyerTurn } from '../prompts/p5-buyer'
import { generateAndSave } from '../lib/report'
import { fmtClock, MODE_LABEL } from '../lib/format'
import type { BuyerState, Session, Turn } from '../lib/types'
import { Busy, DiffBadge, Empty, ErrorNote } from '../components/ui'

const PHASE_LABEL: Record<Phase, string> = {
  idle: 'Not connected',
  connecting: 'Connecting…',
  buyer: 'Buyer is speaking',
  listening: 'Your turn — speak when ready',
  rep: 'Listening to you',
  thinking: 'Buyer is thinking…',
  ended: 'Call ended',
}

const END_LABEL: Record<string, string> = {
  bought: 'The buyer agreed to buy',
  next_step: 'The buyer agreed to a next step',
  think_about_it: 'The buyer will think about it',
  hung_up: 'The buyer ended the call',
}

export default function Call() {
  const { id } = useParams()
  const nav = useNavigate()
  const session = useStore((s) => s.sessions.find((x) => x.id === id))
  const editorial = useStore((s) => s.editorial)
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [reporting, setReporting] = useState(false)
  const [crm, setCrm] = useState('')
  const [followUp, setFollowUp] = useState('')
  const engine = useRef<CallEngine | null>(null)
  const meter = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const running = useRef(false)

  useEffect(() => () => engine.current?.stop(), [])
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [session?.turns.length])
  useEffect(() => {
    if (phase === 'idle' || phase === 'ended') return
    const t = setInterval(() => setElapsed(engine.current?.now() ?? 0), 500)
    return () => clearInterval(t)
  }, [phase])

  if (!session) return <div className="page"><Empty title="Call not found" body="This practice call doesn’t exist in this browser." action={<Link className="btn" to="/practice">Back to practice</Link>} /></div>
  if (session.report) {
    return <div className="page"><Empty title="This call is finished" body="Its report is ready." action={<Link className="btn primary" to={`/reports/${session.id}`}>Open report</Link>} /></div>
  }

  const ed = getState().editorialHistory.find((e) => e.version === session.editorialVersion) ?? editorial
  const p = session.persona
  const current = () => getState().sessions.find((x) => x.id === id) as Session

  function save(turns: Turn[], states: BuyerState[]) {
    updateSession(session!.id, { turns, states })
  }

  async function endCall(reason: string) {
    running.current = false
    engine.current?.stop()
    setPhase('ended')
    updateSession(session!.id, { endedAt: Date.now(), endReason: reason })
  }

  // One step of the conversation, decided by who spoke last. Safe to call again after an error.
  async function loop() {
    if (running.current || !ed) return
    running.current = true
    setError(null)
    const eng = engine.current!
    try {
      while (running.current) {
        const s = current()
        const last = s.turns.at(-1)
        if (!last || last.speaker === 'rep') {
          setPhase('thinking')
          const reply = await buyerTurn(ed, p, s.mode, s.turns, s.states)
          if (!running.current) return
          const audio = await speak(reply.say, p.voice.name, p.voice.style)
          if (!running.current) return
          setPhase('buyer')
          const startGuess = eng.now()
          const turns: Turn[] = [...s.turns, { speaker: 'buyer', text: reply.say, startMs: startGuess, endMs: startGuess }]
          const state: BuyerState = { turnIndex: turns.length - 1, atMs: startGuess, trust: reply.trust, revealedFactIds: reply.revealedFactIds, objectionRaised: reply.objectionRaised, objectionResolved: reply.objectionResolved, end: reply.end }
          save(turns, [...s.states, state])
          const played = await eng.playBuyer(audio)
          const fixed = turns.map((t, i) => (i === turns.length - 1 ? { ...t, startMs: played.startMs, endMs: played.endMs } : t))
          save(fixed, [...s.states, { ...state, atMs: played.startMs }])
          if (reply.end && !played.bargedIn) return endCall(END_LABEL[reply.end] ?? reply.end)
          if (played.bargedIn) setNotice('You cut the buyer off. That counts as an interruption.')
        } else {
          setPhase('listening')
          const cap = await eng.captureRep(() => setPhase('rep'))
          if (!running.current) return
          if (!cap) continue
          setPhase('thinking')
          const text = await transcribe(cap.blob, undefined)
          if (!running.current) return
          if (!text) {
            setNotice('Didn’t catch that. Please say it again.')
            continue
          }
          setNotice(null)
          const s2 = current()
          save([...s2.turns, { speaker: 'rep', text, startMs: cap.startMs, endMs: cap.endMs, interrupted: cap.interrupted }], s2.states)
        }
      }
    } catch (e) {
      setError(`${(e as Error).message || 'Something went wrong'}. Retry to continue the call where it stopped.`)
      setPhase('idle')
    } finally {
      running.current = false
    }
  }

  async function join() {
    setPhase('connecting')
    setError(null)
    try {
      if (!engine.current) {
        const eng = new CallEngine()
        eng.onLevel = (level, speaking) => {
          const el = meter.current
          if (!el) return
          el.classList.toggle('on', speaking)
          Array.from(el.children).forEach((bar, i) => {
            const shape = 0.45 + 0.55 * Math.sin(((i + 1) / (el.children.length + 1)) * Math.PI)
            ;(bar as HTMLElement).style.height = `${Math.max(3, level * shape * 28)}px`
          })
        }
        await eng.init()
        engine.current = eng
      }
      loop()
    } catch (e) {
      setError(`Microphone unavailable: ${(e as Error).message}. Allow microphone access for this site and try again.`)
      setPhase('idle')
    }
  }

  async function getReport() {
    setReporting(true)
    updateSession(session!.id, { crmNotes: crm, followUp })
    await generateAndSave(session!.id)
    setReporting(false)
    const s = current()
    if (s.report) nav(`/reports/${s.id}`)
  }

  const ended = !!session.endedAt
  const limitMin = session.mode === 'full' ? (ed?.salesMotion.typicalCallMinutes ?? 20) + 5 : 8
  const live = phase === 'buyer' || phase === 'rep' || phase === 'listening'

  return (
    <div className="page" style={{ maxWidth: 1240 }}>
      <div className="page-head">
        <div>
          <div className="row" style={{ marginBottom: 6 }}>
            <span className="badge">{MODE_LABEL[session.mode]}</span>
            <DiffBadge d={p.difficulty} />
          </div>
          <h1>Call with {p.visible.name}</h1>
        </div>
        {!ended && phase !== 'idle' && (
          <div className="row">
            <span className="mono" style={{ fontSize: 18 }}>{fmtClock(elapsed)}</span>
            <span className="small faint">/ {limitMin}:00</span>
            <button className="btn" onClick={() => endCall('The rep ended the call')}>End call</button>
          </div>
        )}
      </div>

      <div className="call">
        <aside className="stack" style={{ gap: 16 }}>
          <section className="card card-pad stack lead-card">
            <div className="kicker">Lead card</div>
            <dl>
              <dt>Role</dt><dd>{p.visible.title}</dd>
              <dt>Company</dt><dd>{p.visible.company} · {p.visible.companySize}</dd>
              <dt>Source</dt><dd>{p.visible.leadSource}</dd>
              <dt>CRM notes</dt><dd>{p.visible.context}</dd>
            </dl>
          </section>
          {session.prepPlan && (
            <section className="card card-pad stack">
              <div className="kicker">Your plan</div>
              <p className="small" style={{ whiteSpace: 'pre-wrap' }}>{session.prepPlan}</p>
            </section>
          )}
          {!ended && (
            <section className="card card-pad small muted stack" style={{ gap: 6 }}>
              <b style={{ color: 'var(--ink)' }}>How the call works</b>
              <span>Speak naturally. Your turn ends after a short pause, or press <b>Done talking</b>.</span>
              <span>You can cut in while the buyer talks. It’s counted as an interruption.</span>
              <span>The buyer only shares what you ask about.</span>
            </section>
          )}
        </aside>

        <section className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: 520 }}>
          <div className="card-head">
            <span className={`phase ${live ? 'live' : ''}`}><span className="dot" />{PHASE_LABEL[ended ? 'ended' : phase]}</span>
            {!ended && (phase === 'listening' || phase === 'rep') && <button className="btn sm" onClick={() => engine.current?.finishTurn()}>Done talking</button>}
            {!ended && phase === 'buyer' && <button className="btn sm" onClick={() => engine.current?.interruptBuyer()}>Interrupt</button>}
          </div>

          <div ref={scroller} className="card-pad transcript" style={{ flex: 1, overflowY: 'auto', maxHeight: 520 }}>
            {session.turns.length === 0 && !ended && phase === 'idle' && (
              <div className="stack" style={{ alignItems: 'flex-start', gap: 10, padding: '30px 0' }}>
                <h2>Ready when you are</h2>
                <p className="muted">{p.visible.name.split(' ')[0]} answers first. Your microphone turns on when you join.</p>
                <button className="btn live lg" onClick={join}>Join call</button>
              </div>
            )}
            {session.turns.map((t, i) => (
              <div key={i} className={`line ${t.speaker}`}>
                <span className="line-time">{fmtClock(t.startMs)}</span>
                <div>
                  <div className="line-who">{t.speaker === 'rep' ? 'You' : p.visible.name.split(' ')[0]}{t.interrupted ? ' · cut in' : ''}</div>
                  <div className="line-text">{t.text}</div>
                </div>
              </div>
            ))}
            {phase === 'thinking' && <div className="small faint row"><Busy on>…</Busy></div>}
          </div>

          {!ended && phase !== 'idle' && (
            <div className="card-pad" style={{ borderTop: '1px solid var(--line)' }}>
              <div className="mic">
                <span className="small faint" style={{ width: 70 }}>Your mic</span>
                <div ref={meter} className="mic-meter">{Array.from({ length: 32 }, (_, i) => <i key={i} style={{ height: 3 }} />)}</div>
              </div>
            </div>
          )}
          {(error || notice) && (
            <div className="card-pad stack" style={{ borderTop: '1px solid var(--line)' }}>
              <ErrorNote error={error} />
              {notice && !error && <div className="notice info">{notice}</div>}
              {error && (
                <div className="row">
                  <button className="btn primary" onClick={join}>Retry</button>
                  <button className="btn" onClick={() => endCall('Call stopped after an error')}>End call</button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {ended && (
        <section className="card" style={{ marginTop: 16 }}>
          <div className="card-head">
            <h2>After the call</h2>
            <span className="small muted">{session.endReason}</span>
          </div>
          <div className="card-pad stack" style={{ gap: 14 }}>
            <p className="muted small">Write what you’d log and send. Both are scored against what actually happened on the call. Leave them empty to skip.</p>
            <div className="grid g2">
              <label className="field">
                <span className="field-label">CRM notes</span>
                <span className="field-hint">Situation, pain, people involved, budget, timeline, objections, next step.</span>
                <textarea rows={7} value={crm} onChange={(e) => setCrm(e.target.value)} />
              </label>
              <label className="field">
                <span className="field-label">Follow-up email</span>
                <span className="field-hint">The message you’d send the buyer after this call.</span>
                <textarea rows={7} value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
              </label>
            </div>
            <ErrorNote error={session.reportError ?? null} />
            <div className="row">
              <button className="btn primary lg" disabled={reporting || session.turns.filter((t) => t.speaker === 'rep').length === 0} onClick={getReport}>
                <Busy on={reporting}>{reporting ? 'Scoring your call…' : 'Get my report'}</Busy>
              </button>
              {session.turns.filter((t) => t.speaker === 'rep').length === 0 && <span className="small faint">You didn’t say anything on this call, so there’s nothing to score.</span>}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
