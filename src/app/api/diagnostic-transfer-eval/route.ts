import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { TRANSFER_SYSTEM, buildTransferUserMessage } from '@/lib/transfer-prompt'

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
    } else console.error('[diagnostic-transfer-eval] anthropic', response.status, await response.text().catch(() => ''))
  } catch (error) {
    console.error('[diagnostic-transfer-eval] anthropic failed:', error)
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
    const { session_id } = await req.json()
    if (!session_id) return NextResponse.json({ error: 'Нужен session_id' }, { status: 400 })

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: session, error: fetchError } = await supabase
      .from('diagnostic_sessions').select('transcript, step').eq('id', session_id).single()
    if (fetchError || !session) return NextResponse.json({ error: 'TRANSFER-сессия не найдена' }, { status: 404 })
    if (session.step !== 'transfer' || !session.transcript) return NextResponse.json({ error: 'Некорректная TRANSFER-сессия' }, { status: 400 })

    const raw = await callModel(TRANSFER_SYSTEM, buildTransferUserMessage(session.transcript))
    let analysis: unknown
    try { analysis = parseJsonLoose(raw) } catch {
      console.error('[diagnostic-transfer-eval] JSON parse failed. Raw:', raw)
      return NextResponse.json({ error: 'Не удалось разобрать ответ модели' }, { status: 502 })
    }

    const { error: saveError } = await supabase.from('diagnostic_sessions').update({ contrast: analysis }).eq('id', session_id)
    if (saveError) console.error('[diagnostic-transfer-eval] save analysis failed:', saveError)
    return NextResponse.json({ analysis })
  } catch (error) {
    console.error('[diagnostic-transfer-eval] unexpected:', error)
    return NextResponse.json({ error: 'Ошибка разбора TRANSFER' }, { status: 500 })
  }
}
