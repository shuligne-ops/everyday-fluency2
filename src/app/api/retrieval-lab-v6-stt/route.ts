import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

function cleanKey(value: string | undefined) {
  return (value || '').replace(/[^\x21-\x7E]/g, '')
}

async function transcribeWithOpenAI(audio: File) {
  const key = cleanKey(process.env.OPENAI_API_KEY)
  if (!key) return null

  const body = new FormData()
  body.append('file', audio, audio.name || 'answer.webm')
  body.append('model', 'whisper-1')
  body.append('language', 'en')
  body.append('temperature', '0')

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 6000)
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${key}` },
      body,
    })
    clearTimeout(timer)

    if (!response.ok) {
      console.warn('[retrieval-v6-stt] OpenAI', response.status, await response.text().catch(() => ''))
      return null
    }

    const data = await response.json() as { text?: string }
    const transcript = data.text?.trim()
    return transcript || null
  } catch (error) {
    console.warn('[retrieval-v6-stt] OpenAI failed', error)
    return null
  }
}

async function transcribeWithElevenLabs(audio: File) {
  const key = cleanKey(process.env.ELEVENLABS_API_KEY)
  if (!key) return null

  const body = new FormData()
  body.append('file', audio, audio.name || 'answer.webm')
  body.append('model_id', 'scribe_v2')
  body.append('language_code', 'eng')
  body.append('diarize', 'false')
  body.append('tag_audio_events', 'false')

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 7000)
    const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'xi-api-key': key },
      body,
    })
    clearTimeout(timer)

    if (!response.ok) {
      console.warn('[retrieval-v6-stt] ElevenLabs', response.status, await response.text().catch(() => ''))
      return null
    }

    const data = await response.json() as { text?: string }
    const transcript = data.text?.trim()
    return transcript || null
  } catch (error) {
    console.warn('[retrieval-v6-stt] ElevenLabs failed', error)
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const audio = form.get('audio')
    if (!(audio instanceof File)) {
      return NextResponse.json({ error: 'audio required' }, { status: 400 })
    }

    // Keep the working OpenAI path first, but do not let a missing/invalid
    // preview key make voice input unusable. The project already has an
    // ElevenLabs credential for speech services, so Scribe is the silent STT fallback.
    const openAiTranscript = await transcribeWithOpenAI(audio)
    if (openAiTranscript) {
      return NextResponse.json({ transcript: openAiTranscript, provider: 'openai' })
    }

    const elevenTranscript = await transcribeWithElevenLabs(audio)
    if (elevenTranscript) {
      return NextResponse.json({ transcript: elevenTranscript, provider: 'elevenlabs' })
    }

    return NextResponse.json({ error: 'transcription unavailable' }, { status: 502 })
  } catch (error) {
    console.error('[retrieval-v6-stt] unexpected', error)
    return NextResponse.json({ error: 'stt failed' }, { status: 500 })
  }
}
