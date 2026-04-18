import { NextRequest } from 'next/server'

function cleanForTTS(text: string): string {
  let t = text
  t = t.replace(/#{1,6}\s*/g, '')
  t = t.replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
  t = t.replace(/`([^`]+)`/g, '$1')
  t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  t = t.replace(/\([^)]*[\u0400-\u04FF][^)]*\)/g, '')
  t = t.replace(/[\u0400-\u04FF][\u0400-\u04FF\s,.!?;:'"()-]*[.!?\n]/g, '')
  t = t.replace(/[\u0400-\u04FF]+/g, '')
  t = t.replace(/[*#_~`>|]/g, '')
  t = t.replace(/\s{2,}/g, ' ')
  t = t.replace(/\n{3,}/g, '\n\n')
  return t.trim()
}

function splitText(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text]
  const chunks: string[] = []
  let remaining = text
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining)
      break
    }
    let cut = remaining.lastIndexOf('. ', maxLen)
    if (cut < maxLen * 0.3) cut = remaining.lastIndexOf('? ', maxLen)
    if (cut < maxLen * 0.3) cut = remaining.lastIndexOf('! ', maxLen)
    if (cut < maxLen * 0.3) cut = remaining.lastIndexOf('\n', maxLen)
    if (cut < maxLen * 0.3) cut = maxLen
    chunks.push(remaining.substring(0, cut + 1).trim())
    remaining = remaining.substring(cut + 1).trim()
  }
  return chunks.filter(c => c.length > 0)
}

async function generateChunk(text: string, voiceId: string, apiKey: string): Promise<ArrayBuffer> {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_22050_32`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    }
  )
  if (!response.ok) throw new Error('TTS chunk failed')
  return response.arrayBuffer()
}

export async function POST(req: NextRequest) {
  const { text } = await req.json()
  if (!text) return new Response('No text', { status: 400 })

  const cleaned = cleanForTTS(text)
  if (cleaned.length < 5) return new Response('Too short', { status: 400 })

  const voiceId = process.env.ELEVENLABS_VOICE_ID || 'Da9VfudgKUvFOKayCiue'
  const apiKey = process.env.ELEVENLABS_API_KEY!

  const chunks = splitText(cleaned, 700)

  try {
    const audioBuffers = await Promise.all(
      chunks.map(chunk => generateChunk(chunk, voiceId, apiKey))
    )

    const totalLength = audioBuffers.reduce((sum, buf) => sum + buf.byteLength, 0)
    const combined = new Uint8Array(totalLength)
    let offset = 0
    for (const buf of audioBuffers) {
      combined.set(new Uint8Array(buf), offset)
      offset += buf.byteLength
    }

    return new Response(combined.buffer, {
      headers: { 'Content-Type': 'audio/mpeg' },
    })
  } catch (err) {
    console.error('TTS error:', err)
    return new Response('TTS Error', { status: 500 })
  }
}
