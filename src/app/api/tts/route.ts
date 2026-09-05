import { NextRequest } from 'next/server'
import { cleanForTTS } from '@/lib/clean-for-tts'

export const runtime = 'nodejs'
export const maxDuration = 60

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
