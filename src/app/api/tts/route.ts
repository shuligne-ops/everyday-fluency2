import { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

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

const RETRY_DELAY_MS = 600

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ElevenLabs ограничивает число ОДНОВРЕМЕННЫХ генераций на весь аккаунт
// (проверено вживую: 3 параллельных запроса — ок, 4-й падает с 429 мгновенно).
// Раньше текст резался на куски по 700 символов и генерился параллельно —
// длинное сообщение само по себе съедало весь лимит и конфликтовало с
// другими учениками, слушающими в этот же момент. Теперь один вызов speak()
// это всегда РОВНО один запрос к ElevenLabs (streaming-эндпоинт, без разбивки
// на куски) — он занимает один слот вместо трёх-четырёх, и аудио начинает
// литься клиенту сразу, не дожидаясь полной генерации на сервере.
async function fetchTTSStream(text: string, voiceId: string, apiKey: string, attempt = 0): Promise<Response> {
  const r = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=mp3_22050_32`,
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
  if (r.ok) return r

  // 429 = чужой запрос в этот момент занимает лимит аккаунта — временная
  // перегрузка, не наша логическая ошибка. Один retry почти всегда решает
  // это.
  if (r.status === 429 && attempt < 1) {
    await sleep(RETRY_DELAY_MS)
    return fetchTTSStream(text, voiceId, apiKey, attempt + 1)
  }
  throw new Error(`TTS request failed: ${r.status}`)
}

export async function POST(req: NextRequest) {
  const { text } = await req.json()
  if (!text) return new Response('No text', { status: 400 })

  const cleaned = cleanForTTS(text)
  if (cleaned.length < 5) return new Response('Too short', { status: 400 })

  const voiceId = process.env.ELEVENLABS_VOICE_ID || 'a9Y3nxjUXhy3ZLsW0XXb'
  const apiKey = process.env.ELEVENLABS_API_KEY!

  try {
    const upstream = await fetchTTSStream(cleaned, voiceId, apiKey)
    return new Response(upstream.body, { headers: { 'Content-Type': 'audio/mpeg' } })
  } catch (err) {
    console.error('TTS error:', err, `len=${cleaned.length}`)
    return new Response('TTS Error', { status: 500 })
  }
}
