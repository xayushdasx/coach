import type { BuyerState, Turn } from '../lib/types'
import { fmtClock } from '../lib/format'

// The buyer's trust in the rep over the call, with rep talk bands and buyer events.
export function TrustTrace({
  turns,
  states,
  start = 4,
  height = 170,
  nowMs,
}: {
  turns: Turn[]
  states: BuyerState[]
  start?: number
  height?: number
  nowMs?: number
}) {
  const W = 760
  const H = height
  const padL = 26
  const padR = 10
  const padT = 10
  const bandH = 10
  const plotB = H - 24 - bandH - 6
  const end = Math.max(nowMs ?? 0, turns.at(-1)?.endMs ?? 0, 60000)
  const x = (ms: number) => padL + (ms / end) * (W - padL - padR)
  const y = (t: number) => padT + (1 - t / 10) * (plotB - padT)

  const pts: [number, number][] = [[x(0), y(start)]]
  let cur = start
  for (const s of states) {
    pts.push([x(s.atMs), y(cur)])
    cur = s.trust
    pts.push([x(s.atMs), y(cur)])
  }
  pts.push([x(end), y(cur)])
  const line = pts.map(([a, b], i) => `${i ? 'L' : 'M'}${a.toFixed(1)},${b.toFixed(1)}`).join(' ')
  const area = `${line} L${x(end)},${plotB} L${x(0)},${plotB} Z`

  const ticks = Math.min(8, Math.max(2, Math.floor(end / 60000)))
  return (
    <svg className="trace" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Buyer trust over the call">
      <defs>
        <linearGradient id="trustFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#0b6b53" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#0b6b53" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 5, 10].map((t) => (
        <g key={t}>
          <line className="grid-line" x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} />
          <text className="axis" x={padL - 6} y={y(t) + 3.5} textAnchor="end">{t}</text>
        </g>
      ))}
      <path className="area" d={area} />
      <path className="path" d={line} />
      {states.map((s, i) => (
        <g key={i}>
          {s.revealedFactIds.map((_, k) => (
            <circle key={k} className="ev-fact" cx={x(s.atMs)} cy={y(s.trust) - 8 - k * 7} r={3.2} />
          ))}
          {s.objectionRaised && <path className="ev-obj" d={`M${x(s.atMs) - 4},${y(s.trust) + 12} l4,-7 l4,7 Z`} />}
          {s.objectionResolved && <circle className="ev-res" cx={x(s.atMs)} cy={y(s.trust)} r={5} />}
        </g>
      ))}
      {turns.filter((t) => t.speaker === 'rep').map((t, i) => (
        <rect key={i} className="rep-band" x={x(t.startMs)} y={plotB + 6} width={Math.max(1.5, x(t.endMs) - x(t.startMs))} height={bandH} rx={2} />
      ))}
      {Array.from({ length: ticks + 1 }, (_, i) => (end / ticks) * i).map((ms, i) => (
        <text key={i} className="axis" x={x(ms)} y={H - 4} textAnchor={i === 0 ? 'start' : i === ticks ? 'end' : 'middle'}>
          {fmtClock(ms)}
        </text>
      ))}
    </svg>
  )
}

export function TraceLegend() {
  return (
    <div className="legend">
      <span><i style={{ background: 'var(--ink)', borderRadius: 2, height: 3, width: 14 }} />Buyer trust (0–10)</span>
      <span><i style={{ background: 'var(--accent)' }} />Fact uncovered</span>
      <span><i style={{ background: 'var(--live)', borderRadius: 0, clipPath: 'polygon(50% 0, 100% 100%, 0 100%)' }} />Objection raised</span>
      <span><i style={{ border: '2px solid var(--good)', background: 'transparent' }} />Objection resolved</span>
      <span><i style={{ background: 'var(--accent-soft)', borderRadius: 2, width: 14 }} />You talking</span>
    </div>
  )
}
