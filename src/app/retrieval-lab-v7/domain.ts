export type Phase = 'hidden' | 'visible' | 'compact' | 'minimal' | 'varied' | 'review' | 'learning'
export type CueType = 'ru' | 'situation' | 'dialogue'
export type Evaluation = {
  communication: 'ok' | 'partial' | 'wrong' | 'uncertain'
  target: 'correct' | 'incorrect' | 'not_used' | 'not_required' | 'uncertain'
  language: 'ok' | 'minor' | 'important' | 'blocking' | 'uncertain'
  naturalness: 'natural' | 'acceptable' | 'marked' | 'unacceptable' | 'uncertain'
  errors: { span: string; correction: string; severity: 'minor' | 'important' | 'blocking'; target_relevance: 'inside_target' | 'off_target'; message_ru: string }[]
  corrected_utterance: string
  note_ru: string
}
export const enums = {
  communication: ['ok', 'partial', 'wrong', 'uncertain'],
  target: ['correct', 'incorrect', 'not_used', 'not_required', 'uncertain'],
  language: ['ok', 'minor', 'important', 'blocking', 'uncertain'],
  naturalness: ['natural', 'acceptable', 'marked', 'unacceptable', 'uncertain'],
} as const
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const exactKeys = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k))
export function parseEvaluation(raw: unknown): Evaluation | null {
  try {
    const d: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!object(d) || !exactKeys(d, [...Object.keys(enums), 'errors', 'corrected_utterance', 'note_ru'])) return null
    for (const [key, values] of Object.entries(enums)) if (typeof d[key] !== 'string' || !(values as readonly string[]).includes(d[key] as string)) return null
    if (typeof d.corrected_utterance !== 'string' || typeof d.note_ru !== 'string' || d.note_ru.length > 1200 || d.corrected_utterance.length > 2000 || !Array.isArray(d.errors) || d.errors.length > 8) return null
    for (const e of d.errors) {
      if (!object(e) || !exactKeys(e, ['span', 'correction', 'severity', 'target_relevance', 'message_ru'])) return null
      if (!['span', 'correction', 'message_ru'].every(k => typeof e[k] === 'string' && (e[k] as string).length <= 1000)) return null
      if (!['minor', 'important', 'blocking'].includes(e.severity as string) || !['inside_target', 'off_target'].includes(e.target_relevance as string)) return null
    }
    // Contradictory severity cannot become a positive score.
    const severity = { ok: 0, minor: 1, important: 2, blocking: 3, uncertain: 4 }
    if (d.errors.some(e => severity[e.severity as 'minor'] > severity[d.language as keyof typeof severity])) return null
    if (['minor', 'important', 'blocking'].includes(d.language as string) && d.errors.length === 0) return null
    return d as Evaluation
  } catch { return null }
}
export const technical = (): Evaluation => ({ communication: 'uncertain', target: 'uncertain', language: 'uncertain', naturalness: 'uncertain', errors: [], corrected_utterance: '', note_ru: 'Не удалось надёжно проверить ответ. Он не засчитан. Можно проверить ещё раз или идти дальше.' })
export const isTechnical = (e: Evaluation) => Object.keys(enums).some(k => e[k as keyof Evaluation] === 'uncertain')
export const visiblePhase = (p: Phase) => !['hidden', 'review'].includes(p)
export function decision(e: Evaluation, visible: boolean): 'accept' | 'note' | 'retry' | 'technical' {
  if (isTechnical(e)) return 'technical'
  if (e.communication !== 'ok' || ['important', 'blocking'].includes(e.language) || e.naturalness === 'unacceptable') return 'retry'
  if (e.errors.some(x => x.severity !== 'minor' || x.target_relevance === 'inside_target')) return 'retry'
  if (e.target === 'incorrect' || visible && e.target !== 'correct') return 'retry'
  return e.language === 'minor' || e.target === 'not_used' || e.naturalness === 'marked' ? 'note' : 'accept'
}
export type Attempt = {
  taskId: string; targetId: string; phase: Phase; targetVisible: boolean; cueType: CueType
  answer: string; originalTranscript: string; transcriptEdited: boolean; retry: number; firstAttempt: boolean; timestamp: string
  result: Evaluation
}
export function metrics(records: Attempt[]) {
  const first = records.filter(r => r.firstAttempt)
  const visible = first.filter(r => r.targetVisible)
  const hidden = first.filter(r => !r.targetVisible)
  const success = (r: Attempt) => !isTechnical(r.result) && r.result.communication === 'ok' && r.result.target === 'correct' && ['accept', 'note'].includes(decision(r.result, r.targetVisible))
  return {
    meaning: first.filter(r => !isTechnical(r.result) && r.result.communication === 'ok').length, total: first.length,
    visible: visible.filter(success).length, visibleTotal: visible.length,
    hidden: hidden.filter(success).length, hiddenTotal: hidden.length,
    corrections: records.filter(r => !isTechnical(r.result) && r.result.language !== 'ok').length,
    technical: records.filter(r => isTechnical(r.result)).length,
  }
}
export type Due = { targetId: string; stage: number; dueAt: number; round: number }
export const intervals = [1, 3, 7, 14]
export function schedule(previous: Due | undefined, targetId: string, independent: boolean, now = Date.now()): Due {
  const stage = previous && independent ? Math.min(previous.stage + 1, 3) : 0
  return { targetId, stage, dueAt: now + intervals[stage] * 86400000, round: previous ? previous.round + 1 : 0 }
}
