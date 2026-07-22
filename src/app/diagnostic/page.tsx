'use client'

import { useState } from 'react'
import VoiceRecorder from './VoiceRecorder'

type VoiceResult = { session_id: string; transcript: string; audio_path: string }
type Phase = 'try' | 'retry' | 'transfer' | 'done'
type Contrast = {
  verdict: 'strong' | 'mixed' | 'weak'; pattern: string; heard_as: string; quote: string
  stronger: string; why: string; one_on_one: string
}
type RetryAnalysis = { shifted: boolean; shift_note: string; still_present: string; residual_quote: string }
type TransferAnalysis = { transfer_score: 0 | 1 | 2; score_label: string; what_worked: string; what_missing: string; quote: string }

const TRANSFER_SITUATION = 'Клиент на созвоне уверенно говорит, что вы обещали закончить работу сегодня. На самом деле договорённость была на понедельник. Клиент платит — поправьте факт, не заставив его почувствовать себя неправым.'
const VERDICT_COLOR: Record<Contrast['verdict'], string> = { strong: '#15803d', mixed: '#f59e0b', weak: '#b42318' }
const VERDICT_LABEL: Record<Contrast['verdict'], string> = { strong: 'Сильный ход', mixed: 'Почти — одна деталь', weak: 'Стоит доработать' }

export default function DiagnosticPage() {
  const [phase, setPhase] = useState<Phase>('try')
  const [tryResult, setTryResult] = useState<VoiceResult | null>(null)
  const [contrast, setContrast] = useState<Contrast | null>(null)
  const [retryAnalysis, setRetryAnalysis] = useState<RetryAnalysis | null>(null)
  const [transferAnalysis, setTransferAnalysis] = useState<TransferAnalysis | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState('')
  const [tryShownAt] = useState(() => Date.now())
  const [retryShownAt, setRetryShownAt] = useState(0)
  const [transferShownAt, setTransferShownAt] = useState(0)

  async function postEval(path: string, body: Record<string, string>) {
    const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const json = await response.json()
    if (!response.ok) throw new Error(json.error || 'Не удалось разобрать ответ')
    return json.analysis
  }

  async function handleTry(data: VoiceResult) {
    setTryResult(data); setError(''); setAnalyzing(true)
    try {
      const analysis = await postEval('/api/diagnostic-contrast', { session_id: data.session_id })
      setContrast(analysis as Contrast)
      setRetryShownAt(Date.now())
      setPhase('retry')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка разбора')
    } finally { setAnalyzing(false) }
  }

  async function handleRetry(data: VoiceResult) {
    const anonId = localStorage.getItem('ef_diag_anon')
    if (!anonId) { setError('Не найден идентификатор диагностической сессии'); return }
    setError(''); setAnalyzing(true)
    try {
      const analysis = await postEval('/api/diagnostic-retry-eval', { retry_session_id: data.session_id, anon_id: anonId, move: 'face_saving_correction' })
      setRetryAnalysis(analysis as RetryAnalysis)
      setTransferShownAt(Date.now())
      setPhase('transfer')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка разбора RETRY')
    } finally { setAnalyzing(false) }
  }

  async function handleTransfer(data: VoiceResult) {
    setError(''); setAnalyzing(true)
    try {
      const analysis = await postEval('/api/diagnostic-transfer-eval', { session_id: data.session_id })
      setTransferAnalysis(analysis as TransferAnalysis)
      setPhase('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка разбора TRANSFER')
    } finally { setAnalyzing(false) }
  }

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '56px 24px', fontFamily: 'system-ui, sans-serif', color: '#0f1b3d' }}>
      <p style={{ fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', color: '#f59e0b', fontWeight: 700, margin: 0 }}>Диагностика · ситуация 1</p>
      <h1 style={{ fontSize: 24, lineHeight: 1.3, fontWeight: 700, margin: '14px 0 20px' }}>Рабочий созвон. Коллега уверенно называет дедлайн пятницу.</h1>
      <p style={{ fontSize: 17, lineHeight: 1.6, color: '#1f2b4d', margin: '0 0 8px' }}>Вы точно знаете, что срок другой — задачу перенесли на понедельник. На звонке ещё пятеро, включая вашего общего руководителя.</p>
      <p style={{ fontSize: 17, lineHeight: 1.6, color: '#1f2b4d', margin: '0 0 28px', fontWeight: 600 }}>Что вы скажете? Ответьте вслух, по-английски — так, как сказали бы на самом деле.</p>

      {phase === 'try' && <VoiceRecorder situationShownAt={tryShownAt} step="try" move="face_saving_correction" onResult={handleTry} />}
      {tryResult && <div style={{ marginTop: 32, padding: '18px 20px', background: '#f7f8fb', border: '1px solid #e3e7f0', borderRadius: 10 }}><p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 6px', fontWeight: 600 }}>Вы сказали:</p><p style={{ fontSize: 17, lineHeight: 1.5, margin: 0 }}>«{tryResult.transcript}»</p></div>}
      {analyzing && <p style={{ marginTop: 20, fontSize: 15, color: '#6b7280' }}>Разбираю, как это звучит для собеседника…</p>}
      {error && <p role="alert" style={{ marginTop: 20, color: '#b42318' }}>{error}</p>}

      {contrast && <div style={{ marginTop: 24, padding: '22px', background: '#fff', border: '1px solid #e3e7f0', borderRadius: 12 }}>
        <span style={{ display: 'inline-block', fontSize: 13, fontWeight: 700, color: '#fff', background: VERDICT_COLOR[contrast.verdict], padding: '4px 12px', borderRadius: 20 }}>{VERDICT_LABEL[contrast.verdict]}</span>
        <p style={{ fontSize: 14, color: '#6b7280', margin: '18px 0 4px', fontWeight: 600 }}>Как это слышат коллеги</p><p style={{ fontSize: 16, lineHeight: 1.55, margin: 0 }}>{contrast.heard_as}</p>
        {contrast.quote && <p style={{ fontSize: 15, fontStyle: 'italic', color: '#8a5a00', margin: '12px 0 0', paddingLeft: 12, borderLeft: '3px solid #f59e0b' }}>«{contrast.quote}»</p>}
        <p style={{ fontSize: 14, color: '#6b7280', margin: '20px 0 4px', fontWeight: 600 }}>Сильнее в этой публичной ситуации</p><p style={{ fontSize: 16, lineHeight: 1.5, margin: 0, fontWeight: 600 }}>«{contrast.stronger}»</p><p style={{ fontSize: 15, lineHeight: 1.55, margin: '8px 0 0', color: '#1f2b4d' }}>{contrast.why}</p>
        <p style={{ fontSize: 14, color: '#6b7280', margin: '20px 0 4px', fontWeight: 600 }}>Один на один можно прямее</p><p style={{ fontSize: 15, lineHeight: 1.5, margin: 0, color: '#475569' }}>«{contrast.one_on_one}»</p>
      </div>}

      {(phase === 'retry' || phase === 'transfer' || phase === 'done') && <section style={{ marginTop: 36, paddingTop: 28, borderTop: '1px solid #e3e7f0' }}>
        <p style={{ fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', color: '#f59e0b', fontWeight: 700, margin: 0 }}>Сразу ещё раз</p>
        <h2 style={{ fontSize: 21, margin: '10px 0' }}>Скажите своими словами</h2><p style={{ lineHeight: 1.6, margin: '0 0 18px' }}>Исправьте факт, но оставьте коллеге выход. Не повторяйте готовую фразу — найдите свой ход.</p>
        {phase === 'retry' && <VoiceRecorder situationShownAt={retryShownAt} step="retry" move="face_saving_correction" onResult={handleRetry} />}
        {retryAnalysis && <div style={{ marginTop: 20, padding: '16px 18px', background: retryAnalysis.shifted ? '#f0fdf4' : '#fff7ed', borderRadius: 10 }}><strong>{retryAnalysis.shifted ? 'Сдвиг есть' : 'Сдвиг пока не произошёл'}</strong><p style={{ margin: '8px 0 0', lineHeight: 1.55 }}>{retryAnalysis.shift_note}</p>{retryAnalysis.still_present && <p style={{ margin: '8px 0 0', color: '#8a5a00' }}>{retryAnalysis.still_present}{retryAnalysis.residual_quote && ` «${retryAnalysis.residual_quote}»`}</p>}</div>}
      </section>}

      {(phase === 'transfer' || phase === 'done') && <section style={{ marginTop: 36, paddingTop: 28, borderTop: '1px solid #e3e7f0' }}>
        <p style={{ fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', color: '#f59e0b', fontWeight: 700, margin: 0 }}>Новая ситуация</p><h2 style={{ fontSize: 21, margin: '10px 0' }}>Теперь — клиент</h2><p style={{ lineHeight: 1.6, margin: '0 0 18px' }}>{TRANSFER_SITUATION}</p>
        {phase === 'transfer' && <VoiceRecorder situationShownAt={transferShownAt} step="transfer" move="face_saving_correction" onResult={handleTransfer} />}
        {transferAnalysis && <div style={{ marginTop: 20, padding: '16px 18px', background: '#f7f8fb', borderRadius: 10 }}><strong>{transferAnalysis.score_label} · {transferAnalysis.transfer_score}/2</strong>{transferAnalysis.what_worked && <p style={{ margin: '8px 0 0', lineHeight: 1.55 }}>{transferAnalysis.what_worked}</p>}{transferAnalysis.what_missing && <p style={{ margin: '8px 0 0', lineHeight: 1.55, color: '#8a5a00' }}>{transferAnalysis.what_missing}</p>}{transferAnalysis.quote && <p style={{ margin: '8px 0 0', fontStyle: 'italic' }}>«{transferAnalysis.quote}»</p>}</div>}
      </section>}
    </main>
  )
}
