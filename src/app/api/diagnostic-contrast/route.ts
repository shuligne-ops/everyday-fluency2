// src/app/api/diagnostic-contrast/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// CONTRAST-разбор одного диагностического ответа (шаг TRY).
//
// Отдельный роут, НЕ трогает существующий /api/lesson-eval (generic-обёртка,
// на которой работают текстовые прототипы lesson-correction / lesson-refusal).
// Этот роут делает то, чего старый не умеет: тянет транскрипт по session_id
// и пишет разбор обратно в базу — для продольной модели.
//
// Вход:  { session_id }  — id строки в diagnostic_sessions (там уже лежит transcript).
// Выход: { analysis }    — JSON по схеме из rubrics.output_schema, он же сохраняется
//        в колонку contrast (jsonb) для последующего сравнения паттерна.
//
// Ни сцена, ни критерии здесь не захардкожены: и то и другое приходит из БД по
// move разбираемой сессии. Новый ход добавляется строками в scenarios и rubrics.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { buildContrastUserMessage } from '@/lib/contrast-prompt'
import { callEvalModel, parseJsonLoose } from '@/lib/eval-model'
import { createServiceClient, loadRubric, loadScenario } from '@/lib/speaking-engine'

export async function POST(req: NextRequest) {
  try {
    const { session_id } = await req.json()
    if (!session_id) {
      return NextResponse.json({ error: 'Нужен session_id' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Тянем транскрипт и move из базы (не доверяем клиенту транскрипт — он уже сохранён).
    const { data: session, error: fetchError } = await supabase
      .from('diagnostic_sessions')
      .select('transcript, move')
      .eq('id', session_id)
      .single()

    if (fetchError || !session) {
      console.error('[diagnostic-contrast] session not found:', fetchError)
      return NextResponse.json({ error: 'Сессия не найдена' }, { status: 404 })
    }
    if (!session.transcript) {
      return NextResponse.json({ error: 'В сессии нет транскрипта' }, { status: 400 })
    }

    const [scenario, rubric] = await Promise.all([
      loadScenario(supabase, session.move, 'try'),
      loadRubric(supabase, session.move, 'try'),
    ])
    if (!scenario || !rubric) {
      console.error('[diagnostic-contrast] нет сценария или рубрики для хода', session.move)
      return NextResponse.json({ error: 'Для этого хода не настроен разбор' }, { status: 400 })
    }

    const userMessage = buildContrastUserMessage({
      situation: scenario.situationModel,
      transcript: session.transcript,
    })

    const { text: raw, model } = await callEvalModel(rubric.systemPrompt, userMessage, 'diagnostic-contrast')

    let analysis: unknown
    try {
      analysis = parseJsonLoose(raw)
    } catch {
      console.error('[diagnostic-contrast] JSON parse failed. Raw:', raw)
      return NextResponse.json({ error: 'Не удалось разобрать ответ модели' }, { status: 502 })
    }

    // Сохраняем разбор в базу (для продольной модели). Колонка contrast — jsonb.
    const { error: saveError } = await supabase
      .from('diagnostic_sessions')
      .update({ contrast: analysis, rubric_id: rubric.id, model_used: model })
      .eq('id', session_id)

    if (saveError) {
      // Разбор удался — не роняем ответ из-за проблемы записи, только логируем.
      console.error('[diagnostic-contrast] save contrast failed:', saveError)
    }

    return NextResponse.json({ analysis })
  } catch (error) {
    console.error('[diagnostic-contrast] unexpected:', error)
    return NextResponse.json({ error: 'Ошибка разбора' }, { status: 500 })
  }
}
