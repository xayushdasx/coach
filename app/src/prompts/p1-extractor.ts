import { chatJSON } from '../lib/ai'
import type { CompanyInput, Knowledge, SourceDoc } from '../lib/types'
import { normaliseKnowledge } from '../lib/normalise'

const SCHEMA = `{
  "company": { "name": string, "overview": string, "size": string },
  "products": [{ "name": string, "description": string, "features": string[], "outcomes": string[], "pricing": string, "financing": string, "policies": string[] }],
  "salesMotion": { "type": "B2B" | "B2C" | "B2B2C", "channel": string, "callObjective": string, "cycle": string, "dealSize": string, "callMinutes": number },
  "buyers": [{ "label": string, "role": string, "pains": string[], "goals": string[], "objections": string[] }],
  "methodology": string,
  "script": string[],
  "objections": [{ "objection": string, "response": string }],
  "competitors": [{ "name": string, "howWeWin": string }],
  "proofPoints": string[],
  "compliance": { "neverSay": string[], "mustSay": string[] },
  "discountRules": string[],
  "languages": string[],
  "priorities": string[],
  "talkTrackFromCalls": string[],
  "gaps": string[],
  "conflicts": string[]
}`

const SYSTEM = `You are P1, the Extractor in a sales-training pipeline.
You read everything a company uploaded about how it sells and turn it into one structured knowledge record.

Rules:
- Use only what the sources say. Never invent prices, statistics, customer names, or policies.
- Where the form and the uploaded documents disagree, keep the form's value and record the disagreement in "conflicts" (quote both values).
- Where something a sales trainer needs is missing (for example no objection list, no pricing, no compliance rules), add a short plain-language note to "gaps" saying what is missing and why it matters.
- "proofPoints" are only claims the company has stated: statistics, named customers, case studies, awards.
- "talkTrackFromCalls": if any source is a transcript of a real sales call, extract the phrases, questions and moves that worked.
- "callMinutes": your best estimate of a typical call length from the sources; default to 30 for B2B demos and 15 for phone sales.
- Keep each string short and concrete.

Output JSON matching this TypeScript-like schema:
${SCHEMA}`

export async function runExtractor(company: CompanyInput, sources: SourceDoc[]): Promise<Knowledge> {
  const form = Object.entries(company)
    .filter(([, v]) => v.trim())
    .map(([k, v]) => `## ${k}\n${v}`)
    .join('\n\n')
  // Keep each document bounded so the request stays within limits.
  const docs = sources
    .map((d) => `### Source: ${d.name} (${d.kind})\n${d.text.slice(0, 40000)}`)
    .join('\n\n')
  const user = `# Setup form filled by the company\n\n${form || '(empty)'}\n\n# Uploaded sources\n\n${docs || '(none)'}`
  return normaliseKnowledge(await chatJSON<Knowledge>(SYSTEM, user, { temperature: 0.1, maxTokens: 12000 }))
}
