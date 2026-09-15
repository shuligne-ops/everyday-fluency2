import { NextRequest } from 'next/server'
import { callEvalModel } from '@/lib/eval-model'

export async function POST(req: NextRequest) {
  const { system, user } = await req.json()

  if (!system || !user) {
    return Response.json({ error: 'missing system or user' }, { status: 400 })
  }

  try {
    // Anthropic → при сбое OpenAI (gpt-4o), как в diagnostic-retry-eval.
    const { text } = await callEvalModel(system, user, 'lesson-eval')
    return Response.json({ text: text.trim() })
  } catch (error) {
    console.error('lesson-eval request failed:', error)
    return Response.json({ error: 'upstream error' }, { status: 502 })
  }
}
