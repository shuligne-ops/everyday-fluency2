import { NextRequest, NextResponse } from 'next/server'
import { buildRetryUserMessage } from '@/lib/retry-prompt'
import { callEvalModel, parseJsonLoose } from '@/lib/eval-model'
import { createServiceClient, loadRubric, loadScenario } from '@/lib/speaking-engine'

export async function POST(req: NextRequest) {
  try {
    const { retry_session_id, anon_id, move } = await req.json()
    if (!retry_session_id || !anon_id || !move) return NextResponse.json({ error: 'Нужны retry_session_id, anon_id и move' }, { status: 400 })

    const supabase = createServiceClient()
    const { data: retrySession, error: retryError } = await supabase
      .from('diagnostic_sessions').select('transcript, anon_id, move, step, attempt_id').eq('id', retry_session_id).single()
    if (retryError || !retrySession) return NextResponse.json({ error: 'RETRY-сессия не найдена' }, { status: 404 })
    if (retrySession.anon_id !== anon_id || retrySession.move !== move || retrySession.step !== 'retry' || !retrySession.attempt_id) return NextResponse.json({ error: 'Некорректная RETRY-сессия' }, { status: 400 })
    if (!retrySession.transcript) return NextResponse.json({ error: 'В RETRY-сессии нет транскрипта' }, { status: 400 })

    const { data: trySession, error: tryError } = await supabase
      .from('diagnostic_sessions').select('transcript').eq('anon_id', anon_id).eq('move', move).eq('attempt_id', retrySession.attempt_id).eq('step', 'try').order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (tryError || !trySession?.transcript) return NextResponse.json({ error: 'Не найдена первая попытка TRY для этой сессии' }, { status: 400 })

    const [scenario, rubric] = await Promise.all([
      loadScenario(supabase, move, 'retry'),
      loadRubric(supabase, move, 'retry'),
    ])
    if (!scenario || !rubric) {
      console.error('[diagnostic-retry-eval] нет сценария или рубрики для хода', move)
      return NextResponse.json({ error: 'Для этого хода не настроен разбор RETRY' }, { status: 400 })
    }

    const { text: raw, model } = await callEvalModel(
      rubric.systemPrompt,
      buildRetryUserMessage({ situation: scenario.situationModel, tryTranscript: trySession.transcript, retryTranscript: retrySession.transcript }),
      'diagnostic-retry-eval'
    )
    let analysis: unknown
    try { analysis = parseJsonLoose(raw) } catch {
      console.error('[diagnostic-retry-eval] JSON parse failed. Raw:', raw)
      return NextResponse.json({ error: 'Не удалось разобрать ответ модели' }, { status: 502 })
    }

    const { error: saveError } = await supabase
      .from('diagnostic_sessions')
      .update({ contrast: analysis, rubric_id: rubric.id, model_used: model })
      .eq('id', retry_session_id)
    if (saveError) console.error('[diagnostic-retry-eval] save analysis failed:', saveError)
    return NextResponse.json({ analysis })
  } catch (error) {
    console.error('[diagnostic-retry-eval] unexpected:', error)
    return NextResponse.json({ error: 'Ошибка разбора RETRY' }, { status: 500 })
  }
}
