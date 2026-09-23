import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

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

async function transcribeWithOpenAI(audio: File) {
  const key = cleanKey(process.env.OPENAI_API_KEY)
  if (!key) return null

  const body = new FormData()
  body.append('file', audio, audio.name)
  body.append('model', 'whisper-1')
  body.append('language', 'en')
  body.append('temperature', '0')

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 6500)
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
    return transcript ? { transcript, provider: 'openai' as const } : null
  } catch (error) {
    console.warn('[retrieval-v6-stt] OpenAI failed', error)
    return null
  }
}

async function transcribeWithElevenLabs(audio: File) {
  const key = cleanKey(process.env.ELEVENLABS_API_KEY)
  if (!key) return null

  const body = new FormData()
  body.append('file', audio, audio.name)
  body.append('model_id', 'scribe_v2')
  body.append('language_code', 'eng')
  body.append('diarize', 'false')
  body.append('tag_audio_events', 'false')

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 6500)
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
    return transcript ? { transcript, provider: 'elevenlabs' as const } : null
  } catch (error) {
    console.warn('[retrieval-v6-stt] ElevenLabs failed', error)
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const rawAudio = form.get('audio')
    if (!(rawAudio instanceof File)) {
      return NextResponse.json({ error: 'audio required' }, { status: 400 })
    }

    // Android browsers do not always record WebM. Giving an MP4/M4A blob a generic
    // ".audio" name can make transcription providers reject an otherwise valid file.
    // Normalize the filename from the actual MIME type before sending it upstream.
    const audio = await canonicalizeAudio(rawAudio)

    // For the experimental lab favor reliability and latency over tiny duplicate STT cost:
    // ask both configured providers in parallel and use the first successful transcript.
    const openAiPromise = transcribeWithOpenAI(audio)
    const elevenPromise = transcribeWithElevenLabs(audio)

    const first = await new Promise<{ transcript: string; provider: 'openai' | 'elevenlabs' } | null>((resolve) => {
      let finished = 0
      const settle = (result: { transcript: string; provider: 'openai' | 'elevenlabs' } | null) => {
        if (result) return resolve(result)
        finished += 1
        if (finished === 2) resolve(null)
      }
      void openAiPromise.then(settle)
      void elevenPromise.then(settle)
    })

    if (first) {
      return NextResponse.json(first, { headers: { 'Cache-Control': 'no-store' } })
    }

    return NextResponse.json({ error: 'transcription unavailable' }, { status: 502 })
  } catch (error) {
    console.error('[retrieval-v6-stt] unexpected', error)
    return NextResponse.json({ error: 'stt failed' }, { status: 500 })
  }
}
