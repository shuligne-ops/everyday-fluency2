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
    const timer = setTimeout(() => controller.abort(), 7000)
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

async function transcribeWithOpenAI(audio: File): Promise<ProviderResult> {
  // Prefer the current fast transcription model; keep Whisper as a compatibility fallback.
  const modern = await transcribeOpenAIModel(audio, 'gpt-4o-mini-transcribe')
  if (modern.transcript) return modern
  const whisper = await transcribeOpenAIModel(audio, 'whisper-1')
  if (whisper.transcript) return whisper
  return { error: `${modern.error || 'openai:modern-failed'}|${whisper.error || 'openai:whisper-failed'}` }
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
    const timer = setTimeout(() => controller.abort(), 7000)
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

// Safe health check: exposes only whether server credentials are configured,
// never their values. This is temporary but useful while stabilising preview STT.
export async function GET() {
  return NextResponse.json({
    ok: true,
    openaiConfigured: Boolean(cleanKey(process.env.OPENAI_API_KEY)),
    elevenLabsConfigured: Boolean(cleanKey(process.env.ELEVENLABS_API_KEY)),
  }, { headers: { 'Cache-Control': 'no-store' } })
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

    // Run independent providers in parallel. OpenAI internally tries the modern
    // transcription model first and Whisper second.
    const [openai, eleven] = await Promise.all([
      transcribeWithOpenAI(audio),
      transcribeWithElevenLabs(audio),
    ])

    const winner = openai.transcript ? openai : eleven.transcript ? eleven : null
    if (winner?.transcript) {
      return NextResponse.json({
        transcript: winner.transcript,
        provider: winner.provider,
      }, { headers: { 'Cache-Control': 'no-store' } })
    }

    return NextResponse.json({
      error: 'transcription unavailable',
      code: 'all-providers-failed',
      audio: { size: audio.size, type: audio.type, name: audio.name },
      providers: {
        openai: openai.error || 'unknown',
        elevenlabs: eleven.error || 'unknown',
      },
    }, { status: 502, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[retrieval-v6-stt] unexpected', error)
    return NextResponse.json({ error: 'stt failed', code: 'server-exception' }, { status: 500 })
  }
}
