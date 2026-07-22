// src/app/api/diagnostic-contrast/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// CONTRAST-разбор одного диагностического ответа (voice-slice, День 2).
//
// Отдельный роут, НЕ трогает существующий /api/lesson-eval (generic-обёртка,
// на которой работают текстовые прототипы lesson-correction / lesson-refusal).
// Этот роут делает то, чего старый не умеет: тянет транскрипт по session_id
// и пишет разбор обратно в базу — для продольной модели.
//
// Вход:  { session_id }  — id строки в diagnostic_sessions (там уже лежит transcript).
// Выход: { analysis }    — JSON по схеме CONTRAST_SYSTEM, он же сохраняется в
//        колонку contrast (jsonb) для последующего сравнения паттерна.
//
// Модель зовётся напрямую с ручным фолбэком Anthropic(sonnet-5) → OpenAI(gpt-4o).
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { CONTRAST_SYSTEM, buildContrastUserMessage } from '@/lib/contrast-prompt'

// Ситуация должна совпадать с тем, что показано на /diagnostic. Источник истины
// для разбора: студент отвечал именно на это.
const SITUATIONS: Record<string, string> = {
  face_saving_correction:
    'Рабочий созвон при команде и общем руководителе. Коллега уверенно называет неверный дедлайн (пятница). Студент знает, что срок перенесли на понедельник, и должен поправить факт, не выставив коллегу некомпетентным.',
}

// Один вызов модели без стрима, с ручным фолбэком Anthropic → OpenAI.
async function callModel(system: string, user: string): Promise<string> {
  // Попытка 1: Anthropic (claude-sonnet-5 — как в существующем lesson-eval)
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 1024,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    })
    if (r.ok) {
      const data = await r.json()
      const text = data?.content?.[0]?.text
      if (text) return text
    } else {
      console.error('[diagnostic-contrast] anthropic', r.status, await r.text().catch(() => ''))
    }
  } catch (err) {
    console.error('[diagnostic-contrast] anthropic failed:', err)
  }

  // Попытка 2: OpenAI (резерв)
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY!}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 1024,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })
  if (!r.ok) {
    throw new Error(`openai fallback status ${r.status}: ${await r.text().catch(() => '')}`)
  }
  const data = await r.json()
  const text = data?.choices?.[0]?.message?.content
  if (!text) throw new Error('openai fallback: пустой ответ')
  return text
}

// Модель иногда оборачивает JSON в ```json ... ``` — снимаем.
function parseJsonLoose(text: string): any {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim()
  return JSON.parse(cleaned)
}

export async function POST(req: NextRequest) {
  try {
    const { session_id } = await req.json()
    if (!session_id) {
      return NextResponse.json({ error: 'Нужен session_id' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )

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

    const situation = SITUATIONS[session.move] ?? SITUATIONS.face_saving_correction
    const userMessage = buildContrastUserMessage({
      situation,
      transcript: session.transcript,
    })

    const raw = await callModel(CONTRAST_SYSTEM, userMessage)

    let analysis: any
    try {
      analysis = parseJsonLoose(raw)
    } catch (parseErr) {
      console.error('[diagnostic-contrast] JSON parse failed. Raw:', raw)
      return NextResponse.json({ error: 'Не удалось разобрать ответ модели' }, { status: 502 })
    }

    // Сохраняем разбор в базу (для продольной модели). Колонка contrast — jsonb.
    const { error: saveError } = await supabase
      .from('diagnostic_sessions')
      .update({ contrast: analysis })
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
