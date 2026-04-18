import { NextRequest } from 'next/server'

function cleanForTTS(text: string): string {
  let t = text
  t = t.replace(/[\u{1F600}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F000}-\u{1F02F}]|[\u{1F0A0}-\u{1F0FF}]|[\u{1F100}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{FE00}-\u{FE0F}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{200D}]|[\u{FE0F}]/gu, '')
  t = t.replace(/#{1,6}\s*/g, '')
  t = t.replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
  t = t.replace(/`([^`]+)`/g, '$1')
  t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  t = t.replace(/\([^)]*[\u0400-\u04FF][^)]*\)/g, '')
  t = t.replace(/[\u0400-\u04FF][^\n.!?]*[.!?\n]/g, '')
  t = t.replace(/[\u0400-\u04FF]+/g, '')
  t = t.replace(/[❌✅🔊⏳⏸●•·—–]/g, '')
  t = t.replace(/\s{2,}/g, ' ')
  t = t.replace(/\n{3,}/g, '\n\n')
  return t.trim()
}

export async function POST(req: NextRequest) {
  const { text } = await req.json()
  if (!text) return new Response('No text', { status: 400 })

  const cleaned = cleanForTTS(text)
  if (cleaned.length < 5) return new Response('Too short', { status: 400 })

  const finalText = cleaned.substring(0, 800)
  const voiceId = process.env.ELEVENLABS_VOICE_ID || 'Da9VfudgKUvFOKayCiue'

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_22050_32`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': process.env.ELEVENLABS_API_KEY!,
      },
      body: JSON.stringify({
        text: finalText,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    }
  )

  if (!response.ok) {
    console.error('ElevenLabs error:', await response.text())
    return new Response('TTS Error', { status: 500 })
  }

  return new Response(await response.arrayBuffer(), {
    headers: { 'Content-Type': 'audio/mpeg' },
  })
}
