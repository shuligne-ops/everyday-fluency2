import { NextRequest, after } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { cleanForTTS } from '@/lib/clean-for-tts'

export const runtime = 'nodejs'
export const maxDuration = 60

const RETRY_DELAY_MS = 600
const MODEL = 'eleven_flash_v2_5'

// Кэш готового аудио в Supabase Storage. Имя файла — отпечаток модели, голоса
// и текста: сменишь модель или голос — старое просто перестанет находиться.
// Без ключей Supabase cache === null, и роут работает ровно как до правки.
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const cache = SERVICE_KEY && SUPA_URL
  ? createClient(SUPA_URL, SERVICE_KEY).storage.from('tts-cache')
  : null

function cacheKey(voiceId: string, cleaned: string): string {
  return createHash('sha256').update(`${MODEL}|${voiceId}|${cleaned}`).digest('hex') + '.mp3'
}

async function collectStream(stream: ReadableStream<Uint8Array>): Promise<Uint8Array<ArrayBuffer>> {
  const parts: Uint8Array[] = []
  let total = 0
  const reader = stream.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    parts.push(value)
    total += value.byteLength
  }
  const out = new Uint8Array(total)
  let off = 0
  for (const p of parts) { out.set(p, off); off += p.byteLength }
  return out
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Значение из env может прийти с BOM (U+FEFF) или невидимыми пробелами —
// такой заголовок роняет fetch с "Cannot convert argument to a ByteString".
function sanitizeEnv(value: string | undefined): string {
  return (value || '').replace(/[^\x21-\x7E]/g, '')
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
        model_id: MODEL,
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    }
  )
  if (r.ok) return r

  const body = await r.text().catch(() => '<no body>')
  console.error(`TTS: ElevenLabs ${r.status} ${r.statusText}: ${body.slice(0, 500)}`)

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

  const voiceId = sanitizeEnv(process.env.ELEVENLABS_VOICE_ID) || 'a9Y3nxjUXhy3ZLsW0XXb'

  const key = cacheKey(voiceId, cleaned)
  if (cache) {
    const cached = await cache.download(key)
    if (cached.data) {
      return new Response(await cached.data.arrayBuffer(), {
        headers: { 'Content-Type': 'audio/mpeg', 'X-TTS-Cache': 'hit' },
      })
    }
  }

  const KEY = sanitizeEnv(process.env.ELEVENLABS_API_KEY)
  if (!KEY) {
    console.error('TTS: ELEVENLABS_API_KEY не задан (или содержит только невалидные символы)')
    return Response.json({ error: 'ELEVENLABS_API_KEY не задан' }, { status: 500 })
  }

  try {
    const upstream = await fetchTTSStream(cleaned, voiceId, KEY)
    if (!cache || !upstream.body) {
      return new Response(upstream.body, { headers: { 'Content-Type': 'audio/mpeg' } })
    }

    // Поток раздваивается: одна копия льётся клиенту сразу, как и раньше,
    // вторая копится в памяти и уходит в бакет после ответа. Студент не ждёт
    // Storage, а упавшая заливка (нет бакета, кончилась квота) его не касается.
    const [toClient, toCache] = upstream.body.tee()
    const collected = collectStream(toCache)
    after(async () => {
      try {
        const audio = await collected
        const { error } = await cache.upload(
          key,
          new Blob([audio], { type: 'audio/mpeg' }),
          { contentType: 'audio/mpeg', upsert: true }
        )
        if (error) console.warn('TTS cache upload failed:', error.message)
      } catch (e) {
        console.warn('TTS cache upload failed:', e)
      }
    })

    return new Response(toClient, {
      headers: { 'Content-Type': 'audio/mpeg', 'X-TTS-Cache': 'miss' },
    })
  } catch (err) {
    console.error('TTS error:', err, `len=${cleaned.length}`)
    return new Response('TTS Error', { status: 500 })
  }
}
