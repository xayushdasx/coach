import { chatJSON, SARVAM_VOICES } from '../lib/ai'
import { uid } from '../lib/store'
import type { Difficulty, Editorial, Persona } from '../lib/types'
import { normalisePersona } from '../lib/normalise'

const DIFFICULTY_GUIDE = `- easy: warm inbound lead, open, answers questions fully, 1 objection that resolves with a reasonable answer.
- medium: interested but busy, short answers unless asked good follow-ups, 2 objections, one hidden behind a stated one.
- hard: skeptical, comparing alternatives, 3 objections including a hidden one, an unseen decision maker, will only commit to a next step if discovery was strong.
- expert: hostile or very senior, tests the rep with tricky questions, 4 objections, pushes for a discount or a promise the rep must not make (a compliance trap), ends the call early if the rep pitches without discovering. Never buys on a first call; the best a rep can win is a concrete next step.
- "winCondition" describes what earns a next step or a sale; it is never a single line the rep can say.`

const SCHEMA = `[{
  "difficulty": "easy" | "medium" | "hard" | "expert",
  "segment": string,                       // which target segment from the brief
  "visible": { "name": string, "title": string, "company": string, "companySize": string, "leadSource": string, "context": string },
  "hidden": { "realGoal": string, "realPain": string, "budget": string, "decisionProcess": string, "hiddenObjection": string, "urgency": string, "pastExperience": string },
  "hiddenFacts": [{ "id": "f1", "checklistId": string, "fact": string, "revealWhen": string }],
  "personality": string,
  "objectionScript": [{ "objectionId": string, "says": string, "when": string, "resolvedIf": string }],
  "winCondition": string,
  "voice": { "name": string, "style": string },
  "language": string
}]`

const SYSTEM = `You are P3, the Buyer Persona generator in a sales-training pipeline.
You create realistic buyers that a sales rep will talk to in a voice role-play. Each buyer has a visible lead card (what the rep sees before the call) and a hidden truth (only the AI buyer knows it; the rep must uncover it).

Difficulty levels:
${DIFFICULTY_GUIDE}

Rules:
- Buyers must belong to the target segments in the Sales Brief and be plausible for this market. Use realistic but fictional names and companies.
- "hiddenFacts": one per item of the brief's discovery checklist (link it with "checklistId"). "revealWhen" says what kind of question unlocks it (e.g. "rep asks how invoices are approved today, and follows up on delays").
- "objectionScript": use objection ids from the brief ("o1"...). "says" is how the buyer would put it. "resolvedIf" is what the rep must do or show.
- The buyer is an outsider. "says", "hidden" and "hiddenFacts" must only contain things a customer could know before the call: their own situation, needs, budget, past experiences, and general public impressions. Never put the seller's plan names, plan lengths, prices, discount rules, refund or trial terms, features or statistics in a buyer's mouth. Write e.g. "If I pay upfront for a longer plan, what's in it for me?" — not "If I pay for the 2-year plan…".
- A buyer's concerns about money should sound real: most buyers react to the amount itself, compare it with what they spend today, or need to consult someone — even if they can afford it.
- "visible.context" is 1-2 sentences of what the CRM shows (lead source, what they downloaded, last touch). It must not give away hidden facts.
- "voice.name": pick from female voices [${SARVAM_VOICES.female.join(', ')}] or male voices [${SARVAM_VOICES.male.join(', ')}] to match the persona.
- Voices with "_enhi_" speak Hindi-English code-mix: use them only for buyers whose language is Hindi or Hinglish.
- "voice.style": one short note on how this person talks (pace, attitude). It guides the role-play, not the voice engine.
- "language": the language the buyer speaks, from the brief.
- Vary personalities, seniority, company size and objections across buyers.

Output a JSON array matching:
${SCHEMA}`

export async function runPersonas(editorial: Editorial, mix: Difficulty[]): Promise<Persona[]> {
  const counts = mix.reduce<Record<string, number>>((a, d) => ({ ...a, [d]: (a[d] ?? 0) + 1 }), {})
  const ask = Object.entries(counts).map(([d, n]) => `${n} × ${d}`).join(', ')
  const brief = {
    companySummary: editorial.companySummary,
    product: editorial.product,
    targetCustomer: editorial.targetCustomer,
    salesMotion: editorial.salesMotion,
    discoveryChecklist: editorial.discoveryChecklist,
    objections: editorial.objections,
    competitors: editorial.competitors,
    compliance: editorial.compliance,
  }
  const raw = await chatJSON<Omit<Persona, 'id' | 'editorialVersion'>[]>(
    SYSTEM,
    `# Sales Brief\n${JSON.stringify(brief, null, 2)}\n\n# Create these buyers\n${ask}`,
    { temperature: 0.8, maxTokens: 14000 },
  )
  const list = Array.isArray(raw) ? raw : Array.isArray((raw as any)?.buyers) ? (raw as any).buyers : [raw]
  return list.map((p: unknown) => ({ ...normalisePersona(p), id: uid('p_'), editorialVersion: editorial.version }))
}
