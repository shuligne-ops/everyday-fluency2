import { NextRequest } from 'next/server'

function cleanForTTS(text: string): string {
  let t = text
  // Remove character names before dialogue lines (bold or plain)
  t = t.replace(/\*{0,2}(Sophie|Marie|Ben|Luca|Priya|Jess|Carlos|Zoe|Anna|Dan|Eleanor|Maya|John|Arthur|Tom|Sarah|Emma|Mike|Kate|Oliver|Lucy|Jack|Alice|James|Mia|Noah|Lily|Leo|Ava|Sam|Ellie|Mark|Ruby|Adam|Ivy|Chris|Ella|Nina|Max|Gemma|Henry|Rose|Waiter|Waitress|Barista|Stranger|Pharmacist|Receptionist|Manager)\*{0,2}\s*:\s*/gi, '')
  // Remove markdown
  t = t.replace(/#{1,6}\s*/g, '')
  t = t.replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
  t = t.replace(/`([^`]+)`/g, '$1')
  t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  // Remove Russian text in parentheses
  t = t.replace(/\([^)]*[\u0400-\u04FF][^)]*\)/g, '')
  // Remove standalone Russian sentences
  t = t.replace(/[\u0400-\u04FF][\u0400-\u04FF\s,.!?;:'"()-]*[.!?\n]/g, '')
  // Remove remaining Cyrillic
  t = t.replace(/[\u0400-\u04FF]+/g, '')
  // Remove special chars
  t = t.replace(/[*#_~`>|]/g, '')
  // Collapse whitespace
  t = t.replace(/\s{2,}/g, ' ')
  t = t.replace(/\n{3,}/g, '\n\n')
  return t.trim()
}

function splitText(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text]
  const chunks: string[] = []
  let remaining = text
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) { chunks.push(remaining); break }
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

async function genChunk(text: string, voiceId: string, apiKey: string): Promise<ArrayBuffer> {
  const r = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_22050_32`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    }
  )
  if (!r.ok) throw new Error('TTS chunk failed')
  return r.arrayBuffer()
}

export async function POST(req: NextRequest) {
  const { text } = await req.json()
  if (!text) return new Response('No text', { status: 400 })

  const cleaned = cleanForTTS(text)
  if (cleaned.length < 5) return new Response('Too short', { status: 400 })

  const voiceId = process.env.ELEVENLABS_VOICE_ID || 'a9Y3nxjUXhy3ZLsW0XXb'
  const apiKey = process.env.ELEVENLABS_API_KEY!
  const chunks = splitText(cleaned, 700)

  try {
    const buffers = await Promise.all(chunks.map(c => genChunk(c, voiceId, apiKey)))
    const total = buffers.reduce((s, b) => s + b.byteLength, 0)
    const combined = new Uint8Array(total)
    let off = 0
    for (const b of buffers) { combined.set(new Uint8Array(b), off); off += b.byteLength }
    return new Response(combined.buffer, { headers: { 'Content-Type': 'audio/mpeg' } })
  } catch (err) {
    console.error('TTS error:', err)
    return new Response('TTS Error', { status: 500 })
  }
}
