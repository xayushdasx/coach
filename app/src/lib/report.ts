import { runJudge } from '../prompts/p6-judge'
import { runReportWriter } from '../prompts/p7-report'
import { computeMetrics, metricsScore } from './metrics'
import { getState, updateSession } from './store'
import type { Editorial, Report, Session } from './types'

// P6 + P7 for one finished session. The overall score is computed here, not by the model,
// so it's always the weighted sum of the stage scores the report shows.
export async function buildReport(session: Session, editorial: Editorial): Promise<Report> {
  const metrics = computeMetrics(session)
  const judgement = await runJudge(editorial, session, metrics)

  const communicationScore = Math.round(((metricsScore(metrics) + (judgement.clarity?.score ?? 3) + (judgement.callControl?.score ?? 3)) / 3) * 10) / 10

  const stageWeighted = editorial.stages
    .filter((s) => s.active)
    .map((s) => {
      const j = judgement.stageScores.find((x) => x.stageId === s.id)
      let score = j?.score ?? null
      if (s.id === 'communication') score = communicationScore
      if (s.id === 'prep') score = judgement.prepPlan?.score ?? null
      return { stageId: s.id, name: s.name, weight: s.weight, score }
    })

  const scored = stageWeighted.filter((s) => s.score != null && s.weight > 0)
  const totalW = scored.reduce((a, s) => a + s.weight, 0)
  const overall = totalW ? Math.round(scored.reduce((a, s) => a + s.weight * (((s.score as number) - 1) / 4) * 100, 0) / totalW) : 0
  const failedOnCompliance = (judgement.compliance ?? []).some((c) => c.severity === 'critical')

  const history = getState()
    .sessions.filter((s) => s.trainee === session.trainee && s.report && s.id !== session.id)
    .sort((a, b) => a.startedAt - b.startedAt)
    .map((s) => ({ at: s.startedAt, overall: s.report!.overall, mode: s.mode }))

  const narrative = await runReportWriter(editorial, session, judgement, metrics, overall, history)

  return {
    createdAt: Date.now(),
    overall,
    passed: overall >= editorial.passMark && !failedOnCompliance,
    failedOnCompliance,
    stageWeighted,
    communicationScore,
    metrics,
    judgement,
    narrative,
  }
}

export async function generateAndSave(sessionId: string) {
  const { sessions, editorialHistory, editorial } = getState()
  const session = sessions.find((s) => s.id === sessionId)
  if (!session) return
  const ed = editorialHistory.find((e) => e.version === session.editorialVersion) ?? editorial
  if (!ed) throw new Error('The Sales Brief this session used is missing.')
  updateSession(sessionId, { reportError: undefined })
  try {
    const report = await buildReport(session, ed)
    updateSession(sessionId, { report })
  } catch (e) {
    updateSession(sessionId, { reportError: (e as Error).message })
  }
}
