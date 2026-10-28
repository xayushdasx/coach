import { chatJSON } from '../lib/ai'
import type { Editorial, Judgement, Metrics, Narrative, Session } from '../lib/types'

const SCHEMA = `{
  "headline": string,                 // one sentence, under 14 words, what defined this call
  "summary": string,                  // 3-4 sentences: what happened, where it was won or lost
  "focusAreas": [{ "title": string, "why": string, "drill": string }],   // 2-3, most important first
  "nextDrill": { "mode": "full" | "opening" | "discovery" | "objections" | "closing", "difficulty": "easy" | "medium" | "hard" | "expert", "why": string }
}`

const SYSTEM = `You are P7, the Report writer in a sales-training pipeline.
You turn the Judge's scoring into a short coaching summary for the rep. The full scoring is shown to the rep separately, so do not repeat every finding: pick what matters most.

Rules:
- Speak to the rep in the second person, plainly and specifically. No praise padding, no generic advice.
- Reference concrete moments (quote briefly) and the metrics where useful.
- Only discuss observable behaviour. Never comment on tone, empathy, confidence or energy.
- If there were critical compliance issues, the first focus area is compliance.
- "nextDrill": the one practice session that would most improve the weakest area. Raise difficulty only if the rep scored well on this difficulty.
- If earlier sessions are given, note the trend (improving / same / declining) in the summary.

Output JSON matching:
${SCHEMA}`

export async function runReportWriter(
  editorial: Editorial,
  session: Session,
  judgement: Judgement,
  metrics: Metrics,
  overall: number,
  history: { at: number; overall: number; mode: string }[],
): Promise<Narrative> {
  const user = `# Call
Mode: ${session.mode}. Buyer difficulty: ${session.persona.difficulty}. Overall score: ${overall}/100 (pass mark ${editorial.passMark}).

# Judge output
${JSON.stringify(judgement, null, 2)}

# Metrics
${JSON.stringify(metrics, null, 2)}

# Earlier sessions by this rep (oldest first)
${history.length ? JSON.stringify(history) : '(first session)'}`
  const n = await chatJSON<Partial<Narrative>>(SYSTEM, user, { temperature: 0.3, maxTokens: 2500 })
  return normaliseNarrative(n)
}

export function normaliseNarrative(n: Partial<Narrative> | null | undefined): Narrative {
  return {
    headline: n?.headline ?? 'Call scored',
    summary: n?.summary ?? '',
    focusAreas: Array.isArray(n?.focusAreas) ? n!.focusAreas : [],
    nextDrill: { mode: 'full', difficulty: 'easy', why: '', ...(n?.nextDrill ?? {}) },
  }
}
