import type { Editorial, Knowledge, LearningPack, Persona } from './types'

// Smaller models sometimes drop or null out fields. These fill every field the UI reads,
// so a partial answer shows as "Not provided" instead of crashing a page.

const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : v == null ? d : String(v))
const o = (v: unknown): Record<string, any> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, any>) : {})

export function normaliseKnowledge(raw: unknown): Knowledge {
  const k = o(raw)
  return {
    company: { name: str(o(k.company).name), overview: str(o(k.company).overview), size: str(o(k.company).size) },
    products: arr<any>(k.products).map((p) => ({ name: str(p?.name), description: str(p?.description), features: arr(p?.features), outcomes: arr(p?.outcomes), pricing: str(p?.pricing), financing: str(p?.financing), policies: arr(p?.policies) })),
    salesMotion: { type: str(o(k.salesMotion).type), channel: str(o(k.salesMotion).channel), callObjective: str(o(k.salesMotion).callObjective), cycle: str(o(k.salesMotion).cycle), dealSize: str(o(k.salesMotion).dealSize), callMinutes: Number(o(k.salesMotion).callMinutes) || 20 },
    buyers: arr<any>(k.buyers).map((b) => ({ label: str(b?.label), role: str(b?.role), pains: arr(b?.pains), goals: arr(b?.goals), objections: arr(b?.objections) })),
    methodology: str(k.methodology),
    script: arr(k.script),
    objections: arr(k.objections),
    competitors: arr(k.competitors),
    proofPoints: arr(k.proofPoints),
    compliance: { neverSay: arr(o(k.compliance).neverSay), mustSay: arr(o(k.compliance).mustSay) },
    discountRules: arr(k.discountRules),
    languages: arr(k.languages),
    priorities: arr(k.priorities),
    talkTrackFromCalls: arr(k.talkTrackFromCalls),
    gaps: arr(k.gaps),
    conflicts: arr(k.conflicts),
  }
}

export function normaliseEditorialBody(raw: unknown): Omit<Editorial, 'version' | 'approved' | 'createdAt'> {
  const e = o(raw)
  const p = o(e.product)
  const tc = o(e.targetCustomer)
  const sm = o(e.salesMotion)
  const pr = o(e.pricingRules)
  return {
    companySummary: str(e.companySummary),
    product: { name: str(p.name), description: str(p.description), keyFeatures: arr(p.keyFeatures), outcomes: arr(p.outcomes), pricing: str(p.pricing, 'Not provided'), financing: str(p.financing), policies: arr(p.policies) },
    targetCustomer: { icp: str(tc.icp), segments: arr<any>(tc.segments).map((s) => ({ name: str(s?.name), role: str(s?.role), pains: arr(s?.pains), goals: arr(s?.goals), typicalObjections: arr(s?.typicalObjections) })) },
    salesMotion: { type: str(sm.type), channel: str(sm.channel), callObjective: str(sm.callObjective), successOutcome: str(sm.successOutcome), typicalCallMinutes: Number(sm.typicalCallMinutes) || 20 },
    methodology: str(e.methodology),
    stages: arr<any>(e.stages).map((s) => ({ id: str(s?.id), name: str(s?.name), weight: Number(s?.weight) || 0, active: s?.active !== false, goal: str(s?.goal), lookFors: arr(s?.lookFors), anchors: { '1': str(o(s?.anchors)['1']), '3': str(o(s?.anchors)['3']), '5': str(o(s?.anchors)['5']) } })),
    discoveryChecklist: arr<any>(e.discoveryChecklist).map((d, i) => ({ id: str(d?.id, `d${i + 1}`), item: str(d?.item), why: str(d?.why) })),
    valueProps: arr(e.valueProps),
    proofPoints: arr(e.proofPoints),
    objections: arr<any>(e.objections).map((x, i) => ({ id: str(x?.id, `o${i + 1}`), objection: str(x?.objection), realCauses: arr(x?.realCauses), responsePattern: str(x?.responsePattern) })),
    pricingRules: { listPrice: str(pr.listPrice, 'Not provided'), discountRules: arr(pr.discountRules), negotiationGuidance: arr(pr.negotiationGuidance) },
    compliance: { neverSay: arr(o(e.compliance).neverSay), mustSay: arr(o(e.compliance).mustSay) },
    competitors: arr(e.competitors),
    facts: arr(e.facts),
    passMark: Number(e.passMark) || 70,
  }
}

export function normalisePersona(raw: unknown): Omit<Persona, 'id' | 'editorialVersion'> {
  const p = o(raw)
  const v = o(p.visible)
  const h = o(p.hidden)
  const d = ['easy', 'medium', 'hard', 'expert'].includes(p.difficulty) ? p.difficulty : 'medium'
  return {
    difficulty: d,
    segment: str(p.segment),
    visible: { name: str(v.name, 'Buyer'), title: str(v.title), company: str(v.company), companySize: str(v.companySize), leadSource: str(v.leadSource), context: str(v.context) },
    hidden: { realGoal: str(h.realGoal), realPain: str(h.realPain), budget: str(h.budget), decisionProcess: str(h.decisionProcess), hiddenObjection: str(h.hiddenObjection), urgency: str(h.urgency), pastExperience: str(h.pastExperience) },
    hiddenFacts: arr<any>(p.hiddenFacts).map((f, i) => ({ id: str(f?.id, `f${i + 1}`), checklistId: str(f?.checklistId), fact: str(f?.fact), revealWhen: str(f?.revealWhen) })),
    personality: str(p.personality),
    objectionScript: arr<any>(p.objectionScript).map((x) => ({ objectionId: str(x?.objectionId), says: str(x?.says), when: str(x?.when), resolvedIf: str(x?.resolvedIf) })),
    winCondition: str(p.winCondition),
    voice: { name: str(o(p.voice).name), style: str(o(p.voice).style) },
    language: str(p.language, 'English'),
  }
}

export function normaliseLearning(raw: unknown): Omit<LearningPack, 'editorialVersion'> {
  const l = o(raw)
  return {
    lessons: arr<any>(l.lessons).map((x, i) => ({ id: str(x?.id, `l${i + 1}`), title: str(x?.title, `Lesson ${i + 1}`), stageId: str(x?.stageId), body: str(x?.body), keyPoints: arr(x?.keyPoints), example: str(x?.example) })),
    quiz: arr<any>(l.quiz)
      .map((q, i) => ({ id: str(q?.id, `q${i + 1}`), topic: str(q?.topic), question: str(q?.question), options: arr<string>(q?.options).map((x) => str(x)), answerIndex: Number(q?.answerIndex) || 0, explanation: str(q?.explanation) }))
      .filter((q) => q.question && q.options.length >= 2),
  }
}
