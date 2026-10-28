import { useSyncExternalStore } from 'react'
import type { CompanyInput, Editorial, Knowledge, LearningPack, Persona, QuizAttempt, Session, Settings, SourceDoc } from './types'

// One workspace per browser, kept in localStorage. Swap for a backend later.
export interface Workspace {
  company: CompanyInput
  sources: SourceDoc[]
  knowledge: Knowledge | null
  editorial: Editorial | null
  editorialHistory: Editorial[]
  personas: Persona[]
  learning: LearningPack | null
  quizAttempts: QuizAttempt[]
  sessions: Session[]
  trainee: string
  settings: Settings
}

export const emptyCompany: CompanyInput = {
  companyName: '',
  overview: '',
  product: '',
  pricing: '',
  salesMotion: '',
  callObjective: '',
  buyers: '',
  methodology: '',
  script: '',
  objections: '',
  competitors: '',
  proofPoints: '',
  neverSay: '',
  mustSay: '',
  discountRules: '',
  languages: '',
  priorities: '',
}

export const defaultSettings: Settings = {
  thinkingModel: 'gemini-3.1-flash-lite',
  ttsModel: 'bulbul:v4-flash',
  sttModel: 'saaras:v4',
}

export const MODELS = {
  thinking: ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite'],
  tts: ['bulbul:v4-flash', 'bulbul:v3'],
  stt: ['saaras:v4', 'saaras:v3'],
}

const KEY = 'coach.workspace.v1'

function load(): Workspace {
  const base: Workspace = {
    company: emptyCompany,
    sources: [],
    knowledge: null,
    editorial: null,
    editorialHistory: [],
    personas: [],
    learning: null,
    quizAttempts: [],
    sessions: [],
    trainee: '',
    settings: defaultSettings,
  }
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return base
    const saved = JSON.parse(raw)
    // Older saves can name models that are no longer offered (Puter models, Gemini 2.5); fall back to defaults.
    const s = { ...defaultSettings, ...saved.settings }
    const settings: Settings = {
      thinkingModel: MODELS.thinking.includes(s.thinkingModel) ? s.thinkingModel : defaultSettings.thinkingModel,
      ttsModel: MODELS.tts.includes(s.ttsModel) ? s.ttsModel : defaultSettings.ttsModel,
      sttModel: MODELS.stt.includes(s.sttModel) ? s.sttModel : defaultSettings.sttModel,
    }
    return { ...base, ...saved, company: { ...emptyCompany, ...saved.company }, settings }
  } catch {
    return base
  }
}

let state: Workspace = load()
const listeners = new Set<() => void>()

export function getState(): Workspace {
  return state
}

export function setState(patch: Partial<Workspace> | ((s: Workspace) => Partial<Workspace>)) {
  const next = typeof patch === 'function' ? patch(state) : patch
  state = { ...state, ...next }
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch (e) {
    console.error('Could not save workspace', e)
  }
  listeners.forEach((l) => l())
}

export function useStore<T>(select: (s: Workspace) => T): T {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => select(state),
  )
}

export function getSettings(): Settings {
  return state.settings
}

export function updateSession(id: string, patch: Partial<Session>) {
  setState((s) => ({ sessions: s.sessions.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))
}

export function resetWorkspace() {
  localStorage.removeItem(KEY)
  state = load()
  listeners.forEach((l) => l())
}

// Replace this browser's workspace with one exported from another browser.
export function importWorkspace(data: Partial<Workspace>) {
  localStorage.setItem(KEY, JSON.stringify(data))
  state = load()
  localStorage.setItem(KEY, JSON.stringify(state))
  listeners.forEach((l) => l())
}

export const uid = (p = '') => p + Math.random().toString(36).slice(2, 10)
