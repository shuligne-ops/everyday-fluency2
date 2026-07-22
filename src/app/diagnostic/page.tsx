'use client'

// ─────────────────────────────────────────────────────────────────────────────
// /diagnostic — voice-slice, дни 1-2.
// День 1: показать ситуацию, записать голос, получить транскрипт (Whisper).
// День 2: по session_id запросить CONTRAST-разбор и показать его.
// SCENE / RETRY / TRANSFER — дни 3+, сюда пока НЕ добавляем.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import VoiceRecorder from './VoiceRecorder'

type VoiceResult = {
  session_id: string
  transcript: string
  audio_path: string
}

type Contrast = {
  verdict: 'strong' | 'mixed' | 'weak'
  pattern: string
  heard_as: string
  quote: string
  stronger: string
  why: string
  one_on_one: string
}

const VERDICT_COLOR: Record<Contrast['verdict'], string> = {
  strong: '#15803d',
  mixed: '#f59e0b',
  weak: '#b42318',
}

const VERDICT_LABEL: Record<Contrast['verdict'], string> = {
  strong: 'Сильный ход',
  mixed: 'Почти — одна деталь',
  weak: 'Стоит доработать',
}

export default function DiagnosticPage() {
  const [result, setResult] = useState<VoiceResult | null>(null)
  const [contrast, setContrast] = useState<Contrast | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [evalError, setEvalError] = useState('')
  const [situationShownAt] = useState(() => Date.now())

  // После получения транскрипта — сразу запрашиваем CONTRAST-разбор.
  async function handleResult(data: VoiceResult) {
    setResult(data)
    setContrast(null)
    setEvalError('')
    setAnalyzing(true)
    try {
      const r = await fetch('/api/diagnostic-contrast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: data.session_id }),
      })
      const json = await r.json()
      if (!r.ok) throw new Error(json.error || 'Не удалось разобрать ответ')
      setContrast(json.analysis as Contrast)
    } catch (err) {
      setEvalError(err instanceof Error ? err.message : 'Ошибка разбора')
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '56px 24px', fontFamily: 'system-ui, sans-serif', color: '#0f1b3d' }}>
      <p style={{ fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', color: '#f59e0b', fontWeight: 700, margin: 0 }}>
        Диагностика · ситуация 1
      </p>
      <h1 style={{ fontSize: 24, lineHeight: 1.3, fontWeight: 700, margin: '14px 0 20px' }}>
        Рабочий созвон. Коллега уверенно называет дедлайн пятницу.
      </h1>
      <p style={{ fontSize: 17, lineHeight: 1.6, color: '#1f2b4d', margin: '0 0 8px' }}>
        Вы точно знаете, что срок другой — задачу перенесли на понедельник.
        На звонке ещё пятеро, включая вашего общего руководителя.
      </p>
      <p style={{ fontSize: 17, lineHeight: 1.6, color: '#1f2b4d', margin: '0 0 28px', fontWeight: 600 }}>
        Что вы скажете? Ответьте вслух, по-английски — так, как сказали бы на самом деле.
      </p>

      <VoiceRecorder
        situationShownAt={situationShownAt}
        step="try"
        move="face_saving_correction"
        onResult={handleResult}
      />

      {result && (
        <div style={{ marginTop: 32, padding: '18px 20px', background: '#f7f8fb', border: '1px solid #e3e7f0', borderRadius: 10 }}>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 6px', fontWeight: 600 }}>Вы сказали:</p>
          <p style={{ fontSize: 17, lineHeight: 1.5, margin: 0, color: '#0f1b3d' }}>«{result.transcript}»</p>
        </div>
      )}

      {analyzing && (
        <p style={{ marginTop: 20, fontSize: 15, color: '#6b7280' }}>Разбираю, как это звучит для коллег…</p>
      )}
      {evalError && (
        <p role="alert" style={{ marginTop: 20, color: '#b42318' }}>{evalError}</p>
      )}

      {contrast && (
        <div style={{ marginTop: 24, padding: '22px 22px', background: '#fff', border: '1px solid #e3e7f0', borderRadius: 12 }}>
          <span style={{ display: 'inline-block', fontSize: 13, fontWeight: 700, color: '#fff', background: VERDICT_COLOR[contrast.verdict], padding: '4px 12px', borderRadius: 20 }}>
            {VERDICT_LABEL[contrast.verdict]}
          </span>

          <p style={{ fontSize: 14, color: '#6b7280', margin: '18px 0 4px', fontWeight: 600 }}>Как это слышат коллеги</p>
          <p style={{ fontSize: 16, lineHeight: 1.55, margin: 0 }}>{contrast.heard_as}</p>

          {contrast.quote && (
            <p style={{ fontSize: 15, fontStyle: 'italic', color: '#8a5a00', margin: '12px 0 0', paddingLeft: 12, borderLeft: '3px solid #f59e0b' }}>
              «{contrast.quote}»
            </p>
          )}

          <p style={{ fontSize: 14, color: '#6b7280', margin: '20px 0 4px', fontWeight: 600 }}>Сильнее в этой публичной ситуации</p>
          <p style={{ fontSize: 16, lineHeight: 1.5, margin: 0, color: '#0f1b3d', fontWeight: 600 }}>«{contrast.stronger}»</p>
          <p style={{ fontSize: 15, lineHeight: 1.55, margin: '8px 0 0', color: '#1f2b4d' }}>{contrast.why}</p>

          <p style={{ fontSize: 14, color: '#6b7280', margin: '20px 0 4px', fontWeight: 600 }}>Один на один можно прямее</p>
          <p style={{ fontSize: 15, lineHeight: 1.5, margin: 0, color: '#475569' }}>«{contrast.one_on_one}»</p>
        </div>
      )}
    </main>
  )
}
