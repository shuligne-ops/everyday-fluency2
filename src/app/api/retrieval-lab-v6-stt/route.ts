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

type ProviderResult = {
  transcript?: string
  provider?: string
  error?: string
}

async function transcribeOpenAIModel(audio: File, model: string): Promise<ProviderResult> {
  const key = cleanKey(process.env.OPENAI_API_KEY)
  if (!key) return { error: 'openai:no-key' }

  const body = new FormData()
  body.append('file', audio, audio.name)
  body.append('model', model)
  body.append('language', 'en')

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 12000)
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${key}` },
      body,
    })
    clearTimeout(timer)

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      console.warn(`[retrieval-v6-stt] OpenAI ${model}`, response.status, detail)
      return { error: `openai:${model}:${response.status}` }
    }

    const data = await response.json() as { text?: string }
    const transcript = data.text?.trim()
    return transcript
      ? { transcript, provider: `openai:${model}` }
      : { error: `openai:${model}:empty` }
  } catch (error) {
    console.warn(`[retrieval-v6-stt] OpenAI ${model} failed`, error)
    return { error: `openai:${model}:timeout-or-network` }
  }
}

async function transcribeWithElevenLabs(audio: File): Promise<ProviderResult> {
  const key = cleanKey(process.env.ELEVENLABS_API_KEY)
  if (!key) return { error: 'elevenlabs:no-key' }

  const body = new FormData()
  body.append('file', audio, audio.name)
  body.append('model_id', 'scribe_v2')
  body.append('language_code', 'eng')
  body.append('diarize', 'false')
  body.append('tag_audio_events', 'false')

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 12000)
    const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'xi-api-key': key },
      body,
    })
    clearTimeout(timer)

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      console.warn('[retrieval-v6-stt] ElevenLabs', response.status, detail)
      return { error: `elevenlabs:${response.status}` }
    }

    const data = await response.json() as { text?: string }
    const transcript = data.text?.trim()
    return transcript
      ? { transcript, provider: 'elevenlabs:scribe_v2' }
      : { error: 'elevenlabs:empty' }
  } catch (error) {
    console.warn('[retrieval-v6-stt] ElevenLabs failed', error)
    return { error: 'elevenlabs:timeout-or-network' }
  }
}

async function probeOpenAI() {
  const key = cleanKey(process.env.OPENAI_API_KEY)
  if (!key) return { configured: false, auth: 'no-key' }
  try {
    const response = await fetch('https://api.openai.com/v1/models/gpt-4o-mini-transcribe', {
      headers: { Authorization: `Bearer ${key}` },
      cache: 'no-store',
    })
    return { configured: true, auth: response.ok ? 'ok' : `http-${response.status}` }
  } catch {
    return { configured: true, auth: 'network-error' }
  }
}

async function probeElevenLabs() {
  const key = cleanKey(process.env.ELEVENLABS_API_KEY)
  if (!key) return { configured: false, auth: 'no-key' }
  try {
    const response = await fetch('https://api.elevenlabs.io/v1/user/subscription', {
      headers: { 'xi-api-key': key },
      cache: 'no-store',
    })
    return { configured: true, auth: response.ok ? 'ok' : `http-${response.status}` }
  } catch {
    return { configured: true, auth: 'network-error' }
  }
}

// Safe health check: reveals only provider availability/status, never secret values.
export async function GET() {
  const [openai, elevenlabs] = await Promise.all([probeOpenAI(), probeElevenLabs()])
  return NextResponse.json({ ok: true, openai, elevenlabs }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const rawAudio = form.get('audio')
    if (!(rawAudio instanceof File)) {
      return NextResponse.json({ error: 'audio required', code: 'no-audio' }, { status: 400 })
    }

    const audio = await canonicalizeAudio(rawAudio)
    if (audio.size < 500) {
      return NextResponse.json({ error: 'audio too short', code: 'audio-too-short', size: audio.size, type: audio.type }, { status: 422 })
    }

    // All STT engines start at once. Return as soon as any one succeeds;
    // do not make a good fast transcript wait for a slower failing provider.
    const attempts = [
      transcribeOpenAIModel(audio, 'gpt-4o-mini-transcribe'),
      transcribeOpenAIModel(audio, 'whisper-1'),
      transcribeWithElevenLabs(audio),
    ]

    const outcome = await new Promise<{ winner?: ProviderResult; errors?: string[] }>((resolve) => {
      let remaining = attempts.length
      let settled = false
      const errors: string[] = []

      attempts.forEach((attempt, index) => {
        void attempt.then((result) => {
          if (settled) return
          if (result.transcript) {
            settled = true
            resolve({ winner: result })
            return
          }
          errors[index] = result.error || 'unknown'
          remaining -= 1
          if (remaining === 0) {
            settled = true
            resolve({ errors })
          }
        }).catch(() => {
          if (settled) return
          errors[index] = 'unhandled-provider-error'
          remaining -= 1
          if (remaining === 0) {
            settled = true
            resolve({ errors })
          }
        })
      })
    })

    if (outcome.winner?.transcript) {
      return NextResponse.json({
        transcript: outcome.winner.transcript,
        provider: outcome.winner.provider,
      }, { headers: { 'Cache-Control': 'no-store' } })
    }

    return NextResponse.json({
      error: 'transcription unavailable',
      code: 'all-providers-failed',
      audio: { size: audio.size, type: audio.type, name: audio.name },
      providers: outcome.errors || [],
    }, { status: 502, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[retrieval-v6-stt] unexpected', error)
    return NextResponse.json({ error: 'stt failed', code: 'server-exception' }, { status: 500 })
  }
}
