// Company input — what the admin types in the setup form.
export interface CompanyInput {
  companyName: string
  overview: string
  product: string
  pricing: string
  salesMotion: string
  callObjective: string
  buyers: string
  methodology: string
  script: string
  objections: string
  competitors: string
  proofPoints: string
  neverSay: string
  mustSay: string
  discountRules: string
  languages: string
  priorities: string
}

export interface SourceDoc {
  id: string
  name: string
  kind: 'pdf' | 'docx' | 'text' | 'audio' | 'video' | 'note'
  text: string
  addedAt: number
}

// P1 output
export interface Knowledge {
  company: { name: string; overview: string; size?: string }
  products: { name: string; description: string; features: string[]; outcomes: string[]; pricing: string; financing: string; policies: string[] }[]
  salesMotion: { type: string; channel: string; callObjective: string; cycle: string; dealSize: string; callMinutes: number }
  buyers: { label: string; role: string; pains: string[]; goals: string[]; objections: string[] }[]
  methodology: string
  script: string[]
  objections: { objection: string; response: string }[]
  competitors: { name: string; howWeWin: string }[]
  proofPoints: string[]
  compliance: { neverSay: string[]; mustSay: string[] }
  discountRules: string[]
  languages: string[]
  priorities: string[]
  talkTrackFromCalls: string[]
  gaps: string[]
  conflicts: string[]
}

export interface Stage {
  id: string
  name: string
  weight: number
  active: boolean
  goal: string
  lookFors: string[]
  anchors: { '1': string; '3': string; '5': string }
}

// P2 output
export interface Editorial {
  version: number
  approved: boolean
  createdAt: number
  companySummary: string
  product: { name: string; description: string; keyFeatures: string[]; outcomes: string[]; pricing: string; financing: string; policies: string[] }
  targetCustomer: { icp: string; segments: { name: string; role: string; pains: string[]; goals: string[]; typicalObjections: string[] }[] }
  salesMotion: { type: string; channel: string; callObjective: string; successOutcome: string; typicalCallMinutes: number }
  methodology: string
  stages: Stage[]
  discoveryChecklist: { id: string; item: string; why: string }[]
  valueProps: string[]
  proofPoints: string[]
  objections: { id: string; objection: string; realCauses: string[]; responsePattern: string }[]
  pricingRules: { listPrice: string; discountRules: string[]; negotiationGuidance: string[] }
  compliance: { neverSay: string[]; mustSay: string[] }
  competitors: { name: string; howWeWin: string }[]
  facts: string[]
  passMark: number
}

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert'

// P3 output
export interface Persona {
  id: string
  difficulty: Difficulty
  segment: string
  visible: { name: string; title: string; company: string; companySize: string; leadSource: string; context: string }
  hidden: {
    realGoal: string
    realPain: string
    budget: string
    decisionProcess: string
    hiddenObjection: string
    urgency: string
    pastExperience: string
  }
  hiddenFacts: { id: string; checklistId: string; fact: string; revealWhen: string }[]
  personality: string
  objectionScript: { objectionId: string; says: string; when: string; resolvedIf: string }[]
  winCondition: string
  voice: { name: string; style: string }
  language: string
  editorialVersion: number
}

// P4 output
export interface Lesson {
  id: string
  title: string
  stageId: string
  body: string
  keyPoints: string[]
  example: string
}

export interface QuizQuestion {
  id: string
  topic: string
  question: string
  options: string[]
  answerIndex: number
  explanation: string
}

export interface LearningPack {
  editorialVersion: number
  lessons: Lesson[]
  quiz: QuizQuestion[]
}

export interface QuizAttempt {
  id: string
  trainee: string
  at: number
  answers: number[]
  score: number
  total: number
}

export type Mode = 'full' | 'opening' | 'discovery' | 'objections' | 'closing'

export interface Turn {
  speaker: 'rep' | 'buyer'
  text: string
  startMs: number
  endMs: number
  interrupted?: boolean
}

// P5 per-turn state, kept hidden from the trainee during the call
export interface BuyerState {
  turnIndex: number
  atMs: number
  trust: number
  revealedFactIds: string[]
  objectionRaised: string | null
  objectionResolved: string | null
  end: 'bought' | 'next_step' | 'think_about_it' | 'hung_up' | null
}

export interface Session {
  id: string
  trainee: string
  personaId: string
  persona: Persona
  editorialVersion: number
  mode: Mode
  startedAt: number
  endedAt?: number
  prepPlan: string
  crmNotes: string
  followUp: string
  turns: Turn[]
  states: BuyerState[]
  endReason?: string
  report?: Report
  reportError?: string
}

export interface Evidence { quote: string; turn: number }

// P6 output
export interface Judgement {
  stageScores: { stageId: string; score: number | null; reached: boolean; rationale: string; lookForsHit: string[]; lookForsMissed: string[]; evidence: Evidence[] }[]
  discovery: { factId: string; status: 'found' | 'partial' | 'missed'; howFound: string; turn: number | null }[]
  objections: { objection: string; turn: number; handling: 'strong' | 'adequate' | 'weak' | 'unaddressed'; realCauseFound: boolean; whatHappened: string; better: string }[]
  compliance: { rule: string; kind: 'violation' | 'missing_must_say'; severity: 'critical' | 'minor'; quote: string; turn: number | null }[]
  factChecks: { claim: string; turn: number; verdict: 'correct' | 'incorrect' | 'unverifiable'; correction: string }[]
  clarity: { score: number; issues: { quote: string; turn: number; issue: string }[] }
  callControl: { score: number; notes: string }
  methodology: { followed: string[]; missed: string[] }
  questions: { open: number; closed: number; leading: number; bestQuestion: string; weakestQuestion: string }
  nextStep: { agreed: boolean; specific: boolean; detail: string }
  outcome: { result: string; deserved: boolean; why: string }
  rewrites: { turn: number; original: string; better: string; why: string }[]
  strengths: { point: string; quote: string; turn: number }[]
  improvements: { point: string; quote: string; turn: number }[]
  prepPlan: { score: number | null; followedPlan: boolean | null; notes: string }
  crmNotes: { score: number | null; accurate: string[]; missingOrWrong: string[] }
  followUp: { score: number | null; notes: string }
}

export interface Metrics {
  durationSec: number
  repTalkSec: number
  buyerTalkSec: number
  talkRatio: number
  longestMonologueSec: number
  repTurns: number
  questionsAsked: number
  openQuestions: number
  interruptions: number
  wpm: number
  fillerCount: number
  fillersPerMin: number
  timeToFirstQuestionSec: number | null
  timeToPriceSec: number | null
  avgResponseLatencySec: number
  finalTrust: number
  peakTrust: number
  lowestTrust: number
}

// P7 output
export interface Narrative {
  headline: string
  summary: string
  focusAreas: { title: string; why: string; drill: string }[]
  nextDrill: { mode: Mode; difficulty: Difficulty; why: string }
}

export interface Report {
  createdAt: number
  overall: number
  passed: boolean
  failedOnCompliance: boolean
  stageWeighted: { stageId: string; name: string; weight: number; score: number | null }[]
  communicationScore: number
  metrics: Metrics
  judgement: Judgement
  narrative: Narrative
}

export interface Settings {
  thinkingModel: string
  ttsModel: string
  sttModel: string
}
