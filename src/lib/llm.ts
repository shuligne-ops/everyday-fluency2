// lib/llm.ts
// ─────────────────────────────────────────────────────────────────────────────
// Провайдер-агностичный слой вызова LLM с молчаливым фолбэком.
//
// Зачем он нужен:
//   Раньше /api/chat ходил напрямую в Anthropic. Если Anthropic падал
//   (сбой, блок, кончился баланс) — урок умирал, ученик видел "API Error".
//   Теперь: основной провайдер падает → тот же запрос молча уходит в резерв.
//   Ученик видит непрерывный поток текста и не знает о переключении.
//
// Что делает слой:
//   1. Принимает system-промпт и messages в едином виде.
//   2. Пробует ОСНОВНОЙ провайдер (Anthropic). Если ответ пришёл — стримит его.
//   3. Если основной не ответил (ошибка/таймаут) ДО начала стрима — пробует РЕЗЕРВ (OpenAI).
//   4. Нормализует разные форматы SSE (Anthropic vs OpenAI) к чистому тексту.
//
// Важное ограничение фолбэка (читай внимательно):
//   Фолбэк срабатывает только если основной провайдер не начал отдавать текст.
//   Если Anthropic уже начал стримить и оборвался на середине — переключения
//   НЕ будет (иначе ученик увидел бы склейку двух разных ответов). Это
//   осознанный компромисс: ловим самый частый случай (провайдер недоступен/
//   баланс кончился — это видно сразу), а редкий обрыв на середине не маскируем.
// ─────────────────────────────────────────────────────────────────────────────

export type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

type ProviderConfig = {
  name: string
  call: (system: string, messages: ChatMessage[], signal: AbortSignal) => Promise<Response>
  // Превращает один HTTP-ответ провайдера в поток чистых текстовых дельт.
  parseStream: (response: Response) => ReadableStream<Uint8Array>
}

const TIMEOUT_MS = 15_000 // если основной провайдер молчит дольше — уходим в резерв

// ── ОСНОВНОЙ: Anthropic ──────────────────────────────────────────────────────
const anthropic: ProviderConfig = {
  name: 'anthropic',
  call: (system, messages, signal) =>
    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        stream: true,
        system,
        messages,
      }),
    }),
  parseStream: (response) => {
    const encoder = new TextEncoder()
    return new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        while (reader) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? '' // последний кусок может быть неполным — копим до след. чанка
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6)
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              // Anthropic-формат: текст лежит в content_block_delta.delta.text
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                controller.enqueue(encoder.encode(parsed.delta.text))
              }
            } catch {
              /* неполный JSON — пропускаем, дособерётся следующим чанком */
            }
          }
        }
        controller.close()
      },
    })
  },
}

// ── РЕЗЕРВ: OpenAI ───────────────────────────────────────────────────────────
const openai: ProviderConfig = {
  name: 'openai',
  call: (system, messages, signal) =>
    fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY!}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 2048,
        stream: true,
        // У OpenAI system-промпт — это первое сообщение с role: 'system',
        // а не отдельное поле как у Anthropic. Поэтому подмешиваем его в начало.
        messages: [{ role: 'system', content: system }, ...messages],
      }),
    }),
  parseStream: (response) => {
    const encoder = new TextEncoder()
    return new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        while (reader) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6)
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              // OpenAI-формат: текст лежит в choices[0].delta.content
              const text = parsed.choices?.[0]?.delta?.content
              if (text) controller.enqueue(encoder.encode(text))
            } catch {
              /* неполный JSON — дособерётся следующим чанком */
            }
          }
        }
        controller.close()
      },
    })
  },
}

// Порядок попыток: сначала основной, при провале — резерв.
const PROVIDERS = [anthropic, openai]

/**
 * Главная функция слоя. Возвращает готовый поток чистого текста для фронтенда.
 *
 * Пробует провайдеров по очереди. Первый, кто отдал валидный 200-ответ,
 * становится источником стрима. Если все упали — бросает ошибку (её ловит route.ts).
 */
export async function streamChat(
  system: string,
  messages: ChatMessage[]
): Promise<ReadableStream<Uint8Array>> {
  let lastError: unknown = null

  for (const provider of PROVIDERS) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const response = await provider.call(system, messages, controller.signal)
      clearTimeout(timeout)

      if (!response.ok) {
        // Провайдер ответил, но с ошибкой (например, кончился баланс → 429/400).
        // Логируем и пробуем следующего.
        const errText = await response.text().catch(() => '')
        console.error(`[llm] ${provider.name} вернул ${response.status}: ${errText}`)
        lastError = new Error(`${provider.name} status ${response.status}`)
        continue
      }

      // Успех. Если это резерв — оставим след в логах, чтобы ты видел в Vercel,
      // что основной провайдер падал (ученику при этом ничего не показываем).
      if (provider.name !== PROVIDERS[0].name) {
        console.warn(`[llm] основной провайдер недоступен — отвечает резерв (${provider.name})`)
      }
      return provider.parseStream(response)
    } catch (err) {
      clearTimeout(timeout)
      // Сюда попадаем при таймауте (abort) или сетевом сбое до ответа.
      console.error(`[llm] ${provider.name} не ответил:`, err)
      lastError = err
      continue
    }
  }

  // Ни один провайдер не сработал.
  throw lastError ?? new Error('Все LLM-провайдеры недоступны')
}
