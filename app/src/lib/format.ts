export function fmtClock(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function fmtDate(t: number): string {
  return new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export const MODE_LABEL: Record<string, string> = {
  full: 'Full call',
  opening: 'Opening drill',
  discovery: 'Discovery drill',
  objections: 'Objection gauntlet',
  closing: 'Closing drill',
}

export function scoreTone(score: number | null, outOf = 5): 'good' | 'warn' | 'bad' | 'none' {
  if (score == null) return 'none'
  const pct = score / outOf
  return pct >= 0.7 ? 'good' : pct >= 0.5 ? 'warn' : 'bad'
}
