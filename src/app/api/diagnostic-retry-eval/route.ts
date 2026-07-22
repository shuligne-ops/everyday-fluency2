import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { RETRY_SYSTEM, buildRetryUserMessage } from '@/lib/retry-prompt'

const SITUATION = 'Рабочий созвон при команде и общем руководителе. Коллега уверенно называет неверный дедлайн (пятница). Студент знает, что срок перенесли на понедельник, и должен поправить факт, не выставив коллегу некомпетентным.'

async function callModel(system: string, user: string): Promise<string> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-5', max_tokens: 1024, system, messages: [{ role: 'user', content: user }] }),
    })
    if (response.ok) {
      const data = await response.json()
      const text = data?.content?.[0]?.text
      if (text) return text
    } else console.error('[diagnostic-retry-eval] anthropic', response.status, await response.text().catch(() => ''))
  } catch (error) {
    console.error('[diagnostic-retry-eval] anthropic failed:', error)
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY!}` },
    body: JSON.stringify({ model: 'gpt-4o', max_tokens: 1024, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
  })
  if (!response.ok) throw new Error(`openai fallback status ${response.status}: ${await response.text().catch(() => '')}`)
  const data = await response.json()
  const text = data?.choices?.[0]?.message?.content
  if (!text) throw new Error('openai fallback: пустой ответ')
  return text
}

function parseJsonLoose(text: string) {
  return JSON.parse(text.replace(/```json/gi, '').replace(/```/g, '').trim())
}

export async function POST(req: NextRequest) {
  try {
    const { retry_session_id, anon_id, move } = await req.json()
    if (!retry_session_id || !anon_id || !move) return NextResponse.json({ error: 'Нужны retry_session_id, anon_id и move' }, { status: 400 })

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: retrySession, error: retryError } = await supabase
      .from('diagnostic_sessions').select('transcript, anon_id, move, step, attempt_id').eq('id', retry_session_id).single()
    if (retryError || !retrySession) return NextResponse.json({ error: 'RETRY-сессия не найдена' }, { status: 404 })
    if (retrySession.anon_id !== anon_id || retrySession.move !== move || retrySession.step !== 'retry' || !retrySession.attempt_id) return NextResponse.json({ error: 'Некорректная RETRY-сессия' }, { status: 400 })
    if (!retrySession.transcript) return NextResponse.json({ error: 'В RETRY-сессии нет транскрипта' }, { status: 400 })

    const { data: trySession, error: tryError } = await supabase
      .from('diagnostic_sessions').select('transcript').eq('anon_id', anon_id).eq('move', move).eq('attempt_id', retrySession.attempt_id).eq('step', 'try').order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (tryError || !trySession?.transcript) return NextResponse.json({ error: 'Не найдена первая попытка TRY для этой сессии' }, { status: 400 })

    const raw = await callModel(RETRY_SYSTEM, buildRetryUserMessage({ situation: SITUATION, tryTranscript: trySession.transcript, retryTranscript: retrySession.transcript }))
    let analysis: unknown
    try { analysis = parseJsonLoose(raw) } catch {
      console.error('[diagnostic-retry-eval] JSON parse failed. Raw:', raw)
      return NextResponse.json({ error: 'Не удалось разобрать ответ модели' }, { status: 502 })
    }

    const { error: saveError } = await supabase.from('diagnostic_sessions').update({ contrast: analysis }).eq('id', retry_session_id)
    if (saveError) console.error('[diagnostic-retry-eval] save analysis failed:', saveError)
    return NextResponse.json({ analysis })
  } catch (error) {
    console.error('[diagnostic-retry-eval] unexpected:', error)
    return NextResponse.json({ error: 'Ошибка разбора RETRY' }, { status: 500 })
  }
}
