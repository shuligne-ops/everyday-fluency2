import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const audio = form.get('audio')
    if (!(audio instanceof File)) {
      return NextResponse.json({ error: 'audio required' }, { status: 400 })
    }

    const key = process.env.OPENAI_API_KEY
    if (!key) {
      return NextResponse.json({ error: 'stt unavailable' }, { status: 500 })
    }

    const body = new FormData()
    body.append('file', audio, audio.name || 'answer.webm')
    body.append('model', 'whisper-1')
    body.append('language', 'en')
    body.append('temperature', '0')

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body,
    })

    if (!response.ok) {
      console.error('[retrieval-v6-stt]', response.status, await response.text().catch(() => ''))
      return NextResponse.json({ error: 'transcription failed' }, { status: 502 })
    }

    const data = await response.json() as { text?: string }
    const transcript = data.text?.trim()
    if (!transcript) {
      return NextResponse.json({ error: 'empty transcript' }, { status: 502 })
    }

    return NextResponse.json({ transcript })
  } catch (error) {
    console.error('[retrieval-v6-stt] unexpected', error)
    return NextResponse.json({ error: 'stt failed' }, { status: 500 })
  }
}
