'use client'

// ─────────────────────────────────────────────────────────────────────────────
// /diagnostic — тестовая страница Дня 1 voice-slice.
// Задача: прогнать живьём захват голоса. Показать ситуацию, записать ответ,
// показать транскрипт от Whisper. SCENE / CONTRAST / RETRY / TRANSFER — дни 2-3,
// сюда НЕ добавляем.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import VoiceRecorder from './VoiceRecorder'

type VoiceResult = {
  session_id: string
  transcript: string
  audio_path: string
}

export default function DiagnosticPage() {
  const [result, setResult] = useState<VoiceResult | null>(null)
  // Момент показа ситуации — точка отсчёта latency (сколько человек думал до ответа).
  const [situationShownAt] = useState(() => Date.now())

  return (
    <main
      style={{
        maxWidth: 640,
        margin: '0 auto',
        padding: '56px 24px',
        fontFamily: 'system-ui, sans-serif',
        color: '#0f1b3d',
      }}
    >
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
        onResult={setResult}
      />

      {result && (
        <div
          style={{
            marginTop: 32,
            padding: '18px 20px',
            background: '#f7f8fb',
            border: '1px solid #e3e7f0',
            borderRadius: 10,
          }}
        >
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 6px', fontWeight: 600 }}>
            Вы сказали:
          </p>
          <p style={{ fontSize: 17, lineHeight: 1.5, margin: 0, color: '#0f1b3d' }}>
            «{result.transcript}»
          </p>
          <p style={{ fontSize: 12, color: '#9aa2b1', margin: '14px 0 0' }}>
            session: {result.session_id}
          </p>
        </div>
      )}
    </main>
  )
}
