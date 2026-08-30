import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, loadScenario, DEFAULT_MOVE, type ScenarioKind } from '@/lib/speaking-engine'

// Имя совпадает с fallback-провайдером из lib/llm.ts.
const OPENAI_API_KEY_ENV = 'OPENAI_API_KEY'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const audio = formData.get('audio')
    const anonId = formData.get('anon_id')?.toString()
    const attemptId = formData.get('attempt_id')?.toString()
    const durationMs = Number(formData.get('duration_ms'))
    const latencyMs = Number(formData.get('latency_ms'))
    const step = formData.get('step')?.toString() || 'try'
    const move = formData.get('move')?.toString() || DEFAULT_MOVE

    if (!(audio instanceof File) || !anonId || !attemptId) {
      return NextResponse.json({ error: 'Нужны аудиозапись, anon_id и attempt_id' }, { status: 400 })
    }

    const openAiApiKey = process.env[OPENAI_API_KEY_ENV]
    if (!openAiApiKey) {
      console.error('STT: не задан', OPENAI_API_KEY_ENV)
      return NextResponse.json({ error: 'STT временно недоступен' }, { status: 500 })
    }

    // Whisper получает исходный Blob: это точнее браузерного Web Speech API
    // и позволяет сохранить запись для последующего прослушивания.
    const whisperForm = new FormData()
    whisperForm.append('file', audio, 'recording.webm')
    whisperForm.append('model', 'whisper-1')
    whisperForm.append('language', 'en')

    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openAiApiKey}` },
      body: whisperForm,
    })

    if (!whisperResponse.ok) {
      const detail = await whisperResponse.text()
      console.error('STT Whisper error:', detail)
      return NextResponse.json({ error: 'Не удалось распознать запись' }, { status: 500 })
    }

    const whisperData = await whisperResponse.json() as { text?: string }
    const transcript = whisperData.text?.trim()
    if (!transcript) {
      return NextResponse.json({ error: 'Whisper не вернул транскрипт' }, { status: 500 })
    }

    const supabaseService = createServiceClient()

    const timestamp = Date.now()
    const audioPath = `${anonId}/${step}-${timestamp}.webm`
    const { error: uploadError } = await supabaseService.storage
      .from('diagnostic-audio')
      .upload(audioPath, audio, { contentType: audio.type || 'audio/webm', upsert: false })

    if (uploadError) {
      console.error('STT Storage upload error:', uploadError)
      return NextResponse.json({ error: 'Не удалось сохранить аудиозапись' }, { status: 500 })
    }

    const { data: sessionId, error: recordError } = await supabaseService.rpc(
      'record_diagnostic_session',
      {
        p_anon_id: anonId,
        p_move: move,
        p_step: step,
        p_transcript: transcript,
        p_duration_ms: Number.isFinite(durationMs) ? durationMs : null,
        p_latency_ms: Number.isFinite(latencyMs) ? latencyMs : null,
        p_attempt_id: attemptId,
      }
    )

    if (recordError || !sessionId) {
      console.error('STT record session error:', recordError)
      return NextResponse.json({ error: 'Не удалось записать сессию' }, { status: 500 })
    }

    const { error: updateError } = await supabaseService.rpc(
      'update_diagnostic_audio_path',
      { p_session_id: sessionId, p_audio_path: audioPath }
    )

    if (updateError) {
      console.error('STT update audio path error:', updateError)
      return NextResponse.json({ error: 'Не удалось связать запись с сессией' }, { status: 500 })
    }

    // Шаг записи 1:1 совпадает с kind сценария. Привязка нужна, чтобы попытка
    // осталась связанной с ТЕМ текстом, который человек слышал: при перекалибровке
    // сценарий получает новую версию, а старая строка продолжает указывать на старую.
    const scenario = await loadScenario(supabaseService, move, step as ScenarioKind)
    if (scenario) {
      const { error: scenarioError } = await supabaseService
        .from('diagnostic_sessions')
        .update({ scenario_id: scenario.id })
        .eq('id', sessionId)
      if (scenarioError) console.error('STT link scenario error:', scenarioError)
    } else {
      console.error('STT: сценарий не найден для', move, step)
    }

    return NextResponse.json({ session_id: sessionId, transcript, audio_path: audioPath })
  } catch (error) {
    console.error('STT unexpected error:', error)
    return NextResponse.json({ error: 'Ошибка обработки записи' }, { status: 500 })
  }
}
