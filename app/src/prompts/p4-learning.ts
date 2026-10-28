import { chatJSON } from '../lib/ai'
import type { Editorial, LearningPack } from '../lib/types'
import { normaliseLearning } from '../lib/normalise'

const SCHEMA = `{
  "lessons": [{ "id": "l1", "title": string, "stageId": string, "body": string, "keyPoints": string[], "example": string }],
  "quiz": [{ "id": "q1", "topic": "product" | "pricing" | "objections" | "discovery" | "compliance" | "competitors" | "process", "question": string, "options": string[4], "answerIndex": 0-3, "explanation": string }]
}`

const SYSTEM = `You are P4, the Lesson and Quiz generator in a sales-training pipeline.
From the Sales Brief, write short lessons that teach a new rep how this company sells, then a quiz that checks they learned it.

Lessons:
- One lesson for the company and product, then one per active stage (in stage order), then one on compliance.
- "body": 120-220 words, plain language, second person ("you"). Teach what to do on a call, using this company's product, buyers and objections. Use short paragraphs separated by blank lines.
- "keyPoints": 3-5 bullets the rep must remember.
- "example": a short example exchange in the form "Buyer: ...\\nYou: ..." showing the behaviour done well.
- "stageId": the stage id it teaches, or "product" / "compliance".

Quiz:
- 15 multiple-choice questions spread across topics. Product facts and pricing must come from the brief's facts. Objection and discovery questions are situational ("The buyer says X. What's the best next move?").
- Exactly one correct option. Wrong options must be plausible mistakes real reps make.
- At least 2 compliance questions.
- "explanation": why the right answer is right, one or two sentences.

Output JSON matching:
${SCHEMA}`

export async function runLearning(editorial: Editorial): Promise<LearningPack> {
  const { version, approved, createdAt, ...brief } = editorial
  const pack = await chatJSON<Omit<LearningPack, 'editorialVersion'>>(SYSTEM, `# Sales Brief\n${JSON.stringify(brief, null, 2)}`, {
    temperature: 0.4,
    maxTokens: 14000,
  })
  return { ...normaliseLearning(pack), editorialVersion: version }
}
