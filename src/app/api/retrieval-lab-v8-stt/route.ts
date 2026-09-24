import { NextRequest, NextResponse } from 'next/server'
import { findTask } from '../../retrieval-lab-v8/tasks'

export const runtime = 'nodejs'
export const maxDuration = 15

function cleanKey(value: string | undefined) {
  return (value || '').replace(/[^\x21-\x7E]/g, '')
}

function canonicalExtension(type: string) {
  const t = (type || '').toLowerCase()
  if (t.includes('webm')) return 'webm'
  if (t.includes('mp4') || t.includes('m4a')) return 'mp4'
  if (t.includes('ogg')) return 'ogg'
  if (t.includes('wav')) return 'wav'
  if (t.includes('mpeg') || t.includes('mp3')) return 'mp3'
  return 'webm'
}

async function canonicalizeAudio(audio: File) {
  const type = audio.type || 'audio/webm'
  const ext = canonicalExtension(type)
  const bytes = await audio.arrayBuffer()
  return new File([bytes], `answer.${ext}`, { type })
}

async function callOpenAI(audio: File, prompt: string, model: 'gpt-transcribe' | 'gpt-4o-mini-transcribe') {
  const key = cleanKey(process.env.OPENAI_API_KEY)
  if (!key) return { error: 'no-key' }
  const body = new FormData()
  body.append('file', audio, audio.name)
  body.append('model', model)
  body.append('prompt', prompt)
  if (model === 'gpt-transcribe') body.append('languages[]', 'en')
  else body.append('language', 'en')

  try {
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      signal: AbortSignal.timeout(11000),
      headers: { Authorization: `Bearer ${key}` },
      body,
    })
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      console.warn(`[retrieval-v8-stt] ${model}`, response.status, detail.slice(0, 400))
      return { error: `${model}:${response.status}` }
    }
    const data = await response.json() as { text?: string }
    const transcript = data.text?.trim()
    return transcript ? { transcript, provider: model } : { error: `${model}:empty` }
  } catch (error) {
    console.warn(`[retrieval-v8-stt] ${model} failed`, error)
    return { error: `${model}:network` }
  }
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const rawAudio = form.get('audio')
    const taskId = form.get('taskId')
    if (!(rawAudio instanceof File) || typeof taskId !== 'string') {
      return NextResponse.json({ error: 'audio and taskId required' }, { status: 400 })
    }
    const task = findTask(taskId)
    if (!task) return NextResponse.json({ error: 'unknown task' }, { status: 400 })
    if (rawAudio.size > 8_000_000) return NextResponse.json({ error: 'audio too large' }, { status: 413 })
    const audio = await canonicalizeAudio(rawAudio)
    if (audio.size < 500) return NextResponse.json({ error: 'audio too short' }, { status: 422 })

    const prompt = [
      'Transcribe one short English learner response literally.',
      'Preserve grammatical mistakes, hesitations and the words actually spoken. Do not rewrite or correct English.',
      'Use the context only to resolve faint audio, names or pronouns. If the audio conflicts with the context, follow the audio.',
      `Situation: ${task.context}`,
      task.dialogue ? `Dialogue before the learner response: ${task.dialogue.replace(/\n/g, ' ')}` : '',
      `Communicative intention: ${task.intent}`,
    ].filter(Boolean).join('\n')

    const primary = await callOpenAI(audio, prompt, 'gpt-transcribe')
    if (primary.transcript) return NextResponse.json(primary, { headers: { 'Cache-Control': 'no-store' } })

    const fallback = await callOpenAI(audio, prompt, 'gpt-4o-mini-transcribe')
    if (fallback.transcript) return NextResponse.json(fallback, { headers: { 'Cache-Control': 'no-store' } })

    return NextResponse.json({ error: 'transcription unavailable', providers: [primary.error, fallback.error] }, { status: 502, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[retrieval-v8-stt] unexpected', error)
    return NextResponse.json({ error: 'stt failed' }, { status: 500 })
  }
}
