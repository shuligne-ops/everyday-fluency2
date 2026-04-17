import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const { text } = await req.json()

  if (!text) {
    return new Response('No text provided', { status: 400 })
  }

  const voiceId = process.env.ELEVENLABS_VOICE_ID || 'Da9VfudgKUvFOKayCiue'

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': process.env.ELEVENLABS_API_KEY!,
      },
      body: JSON.stringify({
        text: text.substring(0, 2000),
        model_id: 'eleven_turbo_v2_5',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: false,
        },
      }),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    console.error('ElevenLabs error:', error)
    return new Response('TTS Error', { status: 500 })
  }

  const audioBuffer = await response.arrayBuffer()

  return new Response(audioBuffer, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
