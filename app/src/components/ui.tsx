import type { ReactNode } from 'react'
import { scoreTone } from '../lib/format'
import type { Difficulty } from '../lib/types'

export function Spinner() {
  return <span className="spinner" aria-hidden />
}

export function Busy({ on, children }: { on: boolean; children: ReactNode }) {
  return <>{on ? <Spinner /> : null}{children}</>
}

export function Pips({ score, outOf = 5 }: { score: number | null; outOf?: number }) {
  const tone = scoreTone(score, outOf)
  return (
    <span className={`pips ${tone}`} aria-label={score == null ? 'not scored' : `${score} out of ${outOf}`}>
      {Array.from({ length: outOf }, (_, i) => (
        <i key={i} className={score != null && i < Math.round(score) ? 'on' : ''} />
      ))}
    </span>
  )
}

export function Bar({ value, max = 100 }: { value: number; max?: number }) {
  const tone = scoreTone(value, max)
  return (
    <div className={`bar ${tone}`}>
      <i style={{ width: `${Math.max(2, Math.min(100, (value / max) * 100))}%` }} />
    </div>
  )
}

export function DiffBadge({ d }: { d: Difficulty }) {
  return <span className={`badge diff-${d}`}>{d[0].toUpperCase() + d.slice(1)}</span>
}

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      <p>{body}</p>
      {action}
    </div>
  )
}

export function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null
  return <div className="notice bad">{error}</div>
}

export function Quote({ text, turn }: { text: string; turn?: number | null }) {
  if (!text) return null
  return (
    <div className="quote">
      {turn != null && <span className="turn">#{turn}</span>}“{text}”
    </div>
  )
}

export function PageHead({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {actions && <div className="row wrap">{actions}</div>}
    </div>
  )
}
