import { chatJSON } from '../lib/ai'
import type { Editorial, Judgement, Metrics, Session } from '../lib/types'
import { fmtClock } from '../lib/format'

const SCHEMA = `{
  "stageScores": [{ "stageId": string, "score": 1-5 | null, "reached": boolean, "rationale": string, "lookForsHit": string[], "lookForsMissed": string[], "evidence": [{ "quote": string, "turn": number }] }],
  "discovery": [{ "factId": string, "status": "found" | "partial" | "missed", "howFound": string, "turn": number | null }],
  "objections": [{ "objection": string, "turn": number, "handling": "strong" | "adequate" | "weak" | "unaddressed", "realCauseFound": boolean, "whatHappened": string, "better": string }],
  "compliance": [{ "rule": string, "kind": "violation" | "missing_must_say", "severity": "critical" | "minor", "quote": string, "turn": number | null }],
  "factChecks": [{ "claim": string, "turn": number, "verdict": "correct" | "incorrect" | "unverifiable", "correction": string }],
  "clarity": { "score": 1-5, "issues": [{ "quote": string, "turn": number, "issue": string }] },
  "callControl": { "score": 1-5, "notes": string },
  "methodology": { "followed": string[], "missed": string[] },
  "questions": { "open": number, "closed": number, "leading": number, "bestQuestion": string, "weakestQuestion": string },
  "nextStep": { "agreed": boolean, "specific": boolean, "detail": string },
  "outcome": { "result": string, "deserved": boolean, "why": string },
  "rewrites": [{ "turn": number, "original": string, "better": string, "why": string }],
  "strengths": [{ "point": string, "quote": string, "turn": number }],
  "improvements": [{ "point": string, "quote": string, "turn": number }],
  "prepPlan": { "score": 1-5 | null, "followedPlan": boolean | null, "notes": string },
  "crmNotes": { "score": 1-5 | null, "accurate": string[], "missingOrWrong": string[] },
  "followUp": { "score": 1-5 | null, "notes": string }
}`

const SYSTEM = `You are P6, the Judge in a sales-training pipeline. You score a sales rep's role-play call against the company's Sales Brief.

You judge ONLY observable behaviour: what the rep said, asked, claimed and did, and in what order. You must NOT score or comment on empathy, tone, warmth, confidence, conviction, energy or how the rep "sounded" — the transcript cannot show those reliably, so they are out of scope.

Scoring rules:
- Score each stage 1-5 using that stage's anchors. Every score needs at least one evidence quote with its turn number. Quotes must be copied exactly from the transcript.
- A stage the call never got to: "reached": false, "score": 1 if the rep should have got there (they ran out of road or lost the buyer), or null if the drill mode excludes it. Inactive stages: omit.
- "prep": score the pre-call plan if one was written (quality, and whether the rep followed it). If no plan, score null.
- "communication": combine clarity, question quality and call control. Use the measured metrics given to you as facts.
- "discovery": one entry per hidden fact. "found" = the rep surfaced it clearly; "partial" = touched it without getting the specifics; "missed" = never surfaced. Use the buyer's state log (fact reveals) as strong evidence.
- "objections": every objection the buyer raised (use the state log), how the rep handled it, whether they found the real cause behind it, and a better response in "better".
- "compliance": every never-say violation, every missing must-say, any unapproved discount or promise, any misquoted price. "critical" = would cause legal, financial or reputational harm. An empty array if clean.
- "factChecks": every concrete claim the rep made about the product, pricing, terms or proof points, checked against the brief's facts. "unverifiable" = not in the brief.
- "questions": count the rep's open, closed and leading questions.
- "rewrites": the 3-5 weakest rep moments, with a stronger line the rep could have said for this company and this buyer.
- "strengths" / "improvements": 3 each, specific, each with a quote.
- "crmNotes" and "followUp": score the rep's written notes and follow-up message if provided (accuracy against what actually happened, completeness, clear next step); null if not provided.
- Be strict and fair. A score of 5 is rare.

Output JSON matching:
${SCHEMA}`

const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])
const obj = <T extends object>(v: unknown, fallback: T): T => (v && typeof v === 'object' && !Array.isArray(v) ? { ...fallback, ...(v as T) } : fallback)

// Smaller models sometimes drop or null out sections. Fill every field so the report can always render.
export function normaliseJudgement(raw: Partial<Judgement> | null | undefined): Judgement {
  const j = (raw ?? {}) as any
  return {
    stageScores: arr<any>(j.stageScores).map((s) => ({ ...s, lookForsHit: arr(s?.lookForsHit), lookForsMissed: arr(s?.lookForsMissed), evidence: arr(s?.evidence) })),
    discovery: arr(j.discovery),
    objections: arr(j.objections),
    compliance: arr(j.compliance),
    factChecks: arr(j.factChecks),
    clarity: (() => { const c = obj(j.clarity, { score: 3, issues: [] }); return { ...c, issues: arr<Judgement['clarity']['issues'][number]>(c.issues) } })(),
    callControl: obj(j.callControl, { score: 3, notes: '' }),
    methodology: (() => { const m = obj(j.methodology, { followed: [], missed: [] }); return { followed: arr<string>(m.followed), missed: arr<string>(m.missed) } })(),
    questions: obj(j.questions, { open: 0, closed: 0, leading: 0, bestQuestion: '', weakestQuestion: '' }),
    nextStep: obj(j.nextStep, { agreed: false, specific: false, detail: '' }),
    outcome: obj(j.outcome, { result: 'Unknown', deserved: false, why: '' }),
    rewrites: arr(j.rewrites),
    strengths: arr(j.strengths),
    improvements: arr(j.improvements),
    prepPlan: obj(j.prepPlan, { score: null, followedPlan: null, notes: '' }),
    crmNotes: (() => { const c = obj(j.crmNotes, { score: null, accurate: [], missingOrWrong: [] }); return { ...c, accurate: arr<string>(c.accurate), missingOrWrong: arr<string>(c.missingOrWrong) } })(),
    followUp: obj(j.followUp, { score: null, notes: '' }),
  }
}

export function transcriptText(session: Session): string {
  return session.turns
    .map((t, i) => `[${i}] ${fmtClock(t.startMs)} ${t.speaker === 'rep' ? 'REP' : 'BUYER'}${t.interrupted ? ' (interrupted buyer)' : ''}: ${t.text}`)
    .join('\n')
}

export async function runJudge(editorial: Editorial, session: Session, metrics: Metrics): Promise<Judgement> {
  const p = session.persona
  const brief = {
    salesMotion: editorial.salesMotion,
    methodology: editorial.methodology,
    stages: editorial.stages.filter((s) => s.active),
    discoveryChecklist: editorial.discoveryChecklist,
    objections: editorial.objections,
    pricingRules: editorial.pricingRules,
    compliance: editorial.compliance,
    facts: editorial.facts,
    proofPoints: editorial.proofPoints,
  }
  const stateLog = session.states.map((s) => ({
    buyerTurnAt: fmtClock(s.atMs),
    trust: s.trust,
    revealed: s.revealedFactIds,
    objectionRaised: s.objectionRaised,
    objectionResolved: s.objectionResolved,
    end: s.end,
  }))
  const user = `# Sales Brief
${JSON.stringify(brief, null, 2)}

# Call mode
${session.mode}${session.mode !== 'full' ? ' (a drill: only score the stages this drill covers; others get score null)' : ''}

# Buyer (hidden truth the rep had to uncover)
${JSON.stringify({ visible: p.visible, hidden: p.hidden, hiddenFacts: p.hiddenFacts, objectionScript: p.objectionScript, winCondition: p.winCondition }, null, 2)}

# Buyer state log (from the AI buyer, one entry per buyer turn)
${JSON.stringify(stateLog, null, 2)}

# Measured metrics (facts, computed from audio timings)
${JSON.stringify(metrics, null, 2)}

# Rep's pre-call plan
${session.prepPlan.trim() || '(none written)'}

# Transcript (turn numbers in brackets)
${transcriptText(session)}

# Call ended because
${session.endReason ?? 'unknown'}

# Rep's CRM notes after the call
${session.crmNotes.trim() || '(none written)'}

# Rep's follow-up message after the call
${session.followUp.trim() || '(none written)'}`
  return normaliseJudgement(await chatJSON<Judgement>(SYSTEM, user, { temperature: 0, maxTokens: 14000 }))
}
