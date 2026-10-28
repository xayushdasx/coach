import { chatJSON } from '../lib/ai'
import type { Editorial, Knowledge } from '../lib/types'
import { normaliseEditorialBody } from '../lib/normalise'

export const STAGE_CATALOGUE = [
  { id: 'prep', name: 'Pre-call preparation' },
  { id: 'opening', name: 'Opening & agenda' },
  { id: 'discovery', name: 'Discovery & qualification' },
  { id: 'pitch', name: 'Value pitch' },
  { id: 'demo', name: 'Demo / walkthrough' },
  { id: 'objections', name: 'Objection handling' },
  { id: 'negotiation', name: 'Pricing & negotiation' },
  { id: 'closing', name: 'Closing' },
  { id: 'next_steps', name: 'Next steps' },
  { id: 'communication', name: 'Communication' },
]

const SCHEMA = `{
  "companySummary": string,                       // 3-5 sentences a new rep can read in 20 seconds
  "product": { "name": string, "description": string, "keyFeatures": string[], "outcomes": string[], "pricing": string, "financing": string, "policies": string[] },
  "targetCustomer": { "icp": string, "segments": [{ "name": string, "role": string, "pains": string[], "goals": string[], "typicalObjections": string[] }] },
  "salesMotion": { "type": string, "channel": string, "callObjective": string, "successOutcome": string, "typicalCallMinutes": number },
  "methodology": string,                          // the framework reps follow and how, in plain words
  "stages": [{ "id": string, "name": string, "weight": number, "active": boolean, "goal": string, "lookFors": string[], "anchors": { "1": string, "3": string, "5": string } }],
  "discoveryChecklist": [{ "id": "d1", "item": string, "why": string }],
  "valueProps": string[],
  "proofPoints": string[],
  "objections": [{ "id": "o1", "objection": string, "realCauses": string[], "responsePattern": string }],
  "pricingRules": { "listPrice": string, "discountRules": string[], "negotiationGuidance": string[] },
  "compliance": { "neverSay": string[], "mustSay": string[] },
  "competitors": [{ "name": string, "howWeWin": string }],
  "facts": string[],                              // ground-truth product facts the judge checks rep claims against
  "passMark": number                              // 0-100
}`

const SYSTEM = `You are P2, the Editorial writer in a sales-training pipeline.
From a company's structured knowledge you write the Sales Brief: the single source of truth that an AI buyer, an AI judge and new sales reps will all use.

Stages: use exactly these stage ids and names, in this order:
${STAGE_CATALOGUE.map((s) => `- ${s.id}: ${s.name}`).join('\n')}

Rules for stages:
- Set "active": false for stages that don't apply to this sales motion (for example "demo" for a phone-only sale). Inactive stages get weight 0.
- Weights of active stages sum to 100. Discovery and objection handling usually carry the most weight. Follow the company's stated priorities if given.
- "lookFors": 3-6 observable behaviours a judge can verify from a transcript. Only observable things: what the rep said or asked, in what order. Never feelings, tone, empathy, confidence or energy — those are not scored.
- "anchors": what a 1, a 3 and a 5 look like for this company, concretely.
- "communication" covers clarity of explanations, question quality and call control — again observable only.

Rules for content:
- "discoveryChecklist": 6-10 facts a rep must uncover on a call (for B2B: current process, pain and its cost, impact, decision process and people, budget, timeline, success criteria, competing options...). Ids d1, d2...
- "objections": every objection the company listed plus common ones for this market (max 12). "realCauses" = what usually sits behind the stated objection. Ids o1, o2...
- Never invent statistics, customers or prices. If the knowledge has a gap, write "Not provided" rather than guessing.
- "facts": 10-25 short, checkable statements (prices, plan limits, integrations, contract terms, SLAs, onboarding time...).
- "passMark": default 70 unless the company says otherwise.

Output JSON matching:
${SCHEMA}`

export async function runEditorial(knowledge: Knowledge, previousVersion: number): Promise<Editorial> {
  const body = await chatJSON<Omit<Editorial, 'version' | 'approved' | 'createdAt'>>(
    SYSTEM,
    `# Company knowledge\n${JSON.stringify(knowledge, null, 2)}`,
    { temperature: 0.2, maxTokens: 14000 },
  )
  return normalise({ ...normaliseEditorialBody(body), version: previousVersion + 1, approved: false, createdAt: Date.now() })
}

export async function reviseEditorial(current: Editorial, request: string): Promise<Editorial> {
  const { version, approved, createdAt, ...body } = current
  const revised = await chatJSON<Omit<Editorial, 'version' | 'approved' | 'createdAt'>>(
    SYSTEM + '\n\nYou are revising an existing Sales Brief. Apply the requested changes, keep everything else as it is, and keep ids stable.',
    `# Current Sales Brief\n${JSON.stringify(body, null, 2)}\n\n# Changes requested by the company admin\n${request}`,
    { temperature: 0.2, maxTokens: 14000 },
  )
  return normalise({ ...normaliseEditorialBody(revised), version: version + 1, approved: false, createdAt: Date.now() })
}

// Make stage weights sum to 100 across active stages, whatever the model returned.
export function normalise(e: Editorial): Editorial {
  const stages = STAGE_CATALOGUE.map((c) => {
    const s = e.stages.find((x) => x.id === c.id)
    return s ? { ...s, name: c.name, weight: s.active ? Math.max(0, s.weight) : 0 } : { id: c.id, name: c.name, weight: 0, active: false, goal: '', lookFors: [], anchors: { '1': '', '3': '', '5': '' } }
  })
  const total = stages.reduce((a, s) => a + s.weight, 0) || 1
  return { ...e, stages: stages.map((s) => ({ ...s, weight: Math.round((s.weight / total) * 100) })) }
}
