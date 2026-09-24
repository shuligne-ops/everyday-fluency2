import { NextRequest, NextResponse } from 'next/server'
import { callEvalModel } from '@/lib/eval-model'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const { system, user } = await req.json()
  if (!system || !user) {
    return NextResponse.json({ error: 'missing prompt' }, { status: 400 })
  }

  const key = process.env.OPENAI_API_KEY
  if (key) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 3500)
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0,
          max_tokens: 320,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      })
      clearTimeout(timer)

      if (response.ok) {
        const data = await response.json()
        const text = data?.choices?.[0]?.message?.content
        if (text) return NextResponse.json({ text: text.trim(), model: 'gpt-4o-mini' })
      } else {
        console.warn('[retrieval-v6-eval] fast model', response.status, await response.text().catch(() => ''))
      }
    } catch (error) {
      console.warn('[retrieval-v6-eval] fast model failed', error)
    }
  }

  try {
    const { text, model } = await callEvalModel(system, user, 'retrieval-v6-eval')
    return NextResponse.json({ text: text.trim(), model })
  } catch (error) {
    console.error('[retrieval-v6-eval] all models failed', error)
    return NextResponse.json({ error: 'evaluation unavailable' }, { status: 502 })
  }
}
