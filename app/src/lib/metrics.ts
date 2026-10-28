import type { Metrics, Session } from './types'

const FILLERS = ['um', 'umm', 'uh', 'uhh', 'er', 'erm', 'like', 'basically', 'actually', 'you know', 'kind of', 'sort of', 'i mean', 'literally']
const OPEN_STARTS = /^(what|how|why|tell me|walk me|describe|explain|help me understand|could you walk|can you walk|talk me)/i
const PRICE = /(price|pricing|cost|costs|per (seat|user|month|year)|\$|₹|€|£|discount|budget|license fee|subscription)/i

// Targets shown next to each metric in the report.
export const TARGETS = {
  talkRatio: { lo: 40, hi: 60, label: '40–60%' },
  longestMonologueSec: { hi: 75, label: 'under 75s' },
  fillersPerMin: { hi: 3, label: 'under 3/min' },
  wpm: { lo: 120, hi: 170, label: '120–170' },
  interruptions: { hi: 1, label: '0–1' },
}

function words(s: string) {
  return s.trim().split(/\s+/).filter(Boolean)
}

function countFillers(text: string) {
  const t = ' ' + text.toLowerCase().replace(/[^a-z\s']/g, ' ') + ' '
  return FILLERS.reduce((n, f) => n + (t.split(` ${f} `).length - 1), 0)
}

function questionsIn(text: string): string[] {
  return text
    .split(/(?<=[.?!])\s+/)
    .filter((s) => s.trim().endsWith('?'))
}

export function computeMetrics(session: Session): Metrics {
  const turns = session.turns
  const rep = turns.filter((t) => t.speaker === 'rep')
  const buyer = turns.filter((t) => t.speaker === 'buyer')
  const dur = (t: { startMs: number; endMs: number }) => Math.max(0, t.endMs - t.startMs) / 1000
  const repTalk = rep.reduce((a, t) => a + dur(t), 0)
  const buyerTalk = buyer.reduce((a, t) => a + dur(t), 0)
  const repWords = rep.reduce((a, t) => a + words(t.text).length, 0)
  const fillerCount = rep.reduce((a, t) => a + countFillers(t.text), 0)
  const qs = rep.flatMap((t) => questionsIn(t.text).map((q) => ({ q, t })))
  const firstQ = qs[0]?.t
  const firstPrice = rep.find((t) => PRICE.test(t.text))
  const last = turns.at(-1)
  const durationSec = last ? last.endMs / 1000 : 0

  // Gap between the buyer finishing and the rep starting to speak.
  const latencies: number[] = []
  turns.forEach((t, i) => {
    const prev = turns[i - 1]
    if (t.speaker === 'rep' && prev?.speaker === 'buyer' && !t.interrupted) latencies.push(Math.max(0, t.startMs - prev.endMs) / 1000)
  })

  const trusts = session.states.map((s) => s.trust)
  return {
    durationSec: Math.round(durationSec),
    repTalkSec: Math.round(repTalk),
    buyerTalkSec: Math.round(buyerTalk),
    talkRatio: repTalk + buyerTalk > 0 ? Math.round((repTalk / (repTalk + buyerTalk)) * 100) : 0,
    longestMonologueSec: Math.round(Math.max(0, ...rep.map(dur))),
    repTurns: rep.length,
    questionsAsked: qs.length,
    openQuestions: qs.filter(({ q }) => OPEN_STARTS.test(q.trim())).length,
    interruptions: rep.filter((t) => t.interrupted).length,
    wpm: repTalk > 0 ? Math.round(repWords / (repTalk / 60)) : 0,
    fillerCount,
    fillersPerMin: repTalk > 0 ? Math.round((fillerCount / (repTalk / 60)) * 10) / 10 : 0,
    timeToFirstQuestionSec: firstQ ? Math.round(firstQ.startMs / 1000) : null,
    timeToPriceSec: firstPrice ? Math.round(firstPrice.startMs / 1000) : null,
    avgResponseLatencySec: latencies.length ? Math.round((latencies.reduce((a, b) => a + b, 0) / latencies.length) * 10) / 10 : 0,
    finalTrust: trusts.at(-1) ?? 0,
    peakTrust: trusts.length ? Math.max(...trusts) : 0,
    lowestTrust: trusts.length ? Math.min(...trusts) : 0,
  }
}

// 1-5 score from the measured metrics alone; blended with the judge's clarity and control scores.
export function metricsScore(m: Metrics): number {
  let s = 5
  if (m.talkRatio > TARGETS.talkRatio.hi + 10 || m.talkRatio < TARGETS.talkRatio.lo - 15) s -= 1.5
  else if (m.talkRatio > TARGETS.talkRatio.hi || m.talkRatio < TARGETS.talkRatio.lo) s -= 0.75
  if (m.longestMonologueSec > TARGETS.longestMonologueSec.hi) s -= 1
  if (m.fillersPerMin > TARGETS.fillersPerMin.hi) s -= 0.75
  if (m.interruptions > TARGETS.interruptions.hi) s -= 0.75
  if (m.wpm && (m.wpm > 190 || m.wpm < 100)) s -= 0.5
  return Math.max(1, Math.min(5, s))
}
