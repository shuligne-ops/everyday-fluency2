import { NextRequest, NextResponse } from 'next/server'
import { buildTransferUserMessage } from '@/lib/transfer-prompt'
import { callEvalModel, parseJsonLoose } from '@/lib/eval-model'
import { createServiceClient, loadRubric, loadScenario } from '@/lib/speaking-engine'

export async function POST(req: NextRequest) {
  try {
    const { session_id } = await req.json()
    if (!session_id) return NextResponse.json({ error: 'Нужен session_id' }, { status: 400 })

    const supabase = createServiceClient()
    const { data: session, error: fetchError } = await supabase
      .from('diagnostic_sessions').select('transcript, step, move').eq('id', session_id).single()
    if (fetchError || !session) return NextResponse.json({ error: 'TRANSFER-сессия не найдена' }, { status: 404 })
    if (session.step !== 'transfer' || !session.transcript) return NextResponse.json({ error: 'Некорректная TRANSFER-сессия' }, { status: 400 })

    const [scenario, rubric] = await Promise.all([
      loadScenario(supabase, session.move, 'transfer'),
      loadRubric(supabase, session.move, 'transfer'),
    ])
    if (!scenario || !rubric) {
      console.error('[diagnostic-transfer-eval] нет сценария или рубрики для хода', session.move)
      return NextResponse.json({ error: 'Для этого хода не настроен разбор TRANSFER' }, { status: 400 })
    }

    const { text: raw, model } = await callEvalModel(
      rubric.systemPrompt,
      buildTransferUserMessage({ situation: scenario.situationModel, transcript: session.transcript }),
      'diagnostic-transfer-eval'
    )
    let analysis: unknown
    try { analysis = parseJsonLoose(raw) } catch {
      console.error('[diagnostic-transfer-eval] JSON parse failed. Raw:', raw)
      return NextResponse.json({ error: 'Не удалось разобрать ответ модели' }, { status: 502 })
    }

    const { error: saveError } = await supabase
      .from('diagnostic_sessions')
      .update({ contrast: analysis, rubric_id: rubric.id, model_used: model })
      .eq('id', session_id)
    if (saveError) console.error('[diagnostic-transfer-eval] save analysis failed:', saveError)
    return NextResponse.json({ analysis })
  } catch (error) {
    console.error('[diagnostic-transfer-eval] unexpected:', error)
    return NextResponse.json({ error: 'Ошибка разбора TRANSFER' }, { status: 500 })
  }
}
