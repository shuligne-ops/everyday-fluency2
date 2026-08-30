// src/lib/eval-model.ts
// ─────────────────────────────────────────────────────────────────────────────
// Один вызов модели без стрима с ручным фолбэком Anthropic → OpenAI. Раньше эта
// функция была скопирована в трёх роутах разбора; теперь она одна и возвращает
// ещё и имя модели — оно пишется в diagnostic_sessions.model_used, иначе вердикт
// нельзя отнести к конкретной модели при разборе расхождений.
// ─────────────────────────────────────────────────────────────────────────────

const ANTHROPIC_MODEL = 'claude-sonnet-5'
const OPENAI_FALLBACK_MODEL = 'gpt-4o'

export type ModelReply = { text: string; model: string }

export async function callEvalModel(system: string, user: string, tag: string): Promise<ModelReply> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1024,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    })
    if (response.ok) {
      const data = await response.json()
      const text = data?.content?.[0]?.text
      if (text) return { text, model: ANTHROPIC_MODEL }
    } else {
      console.error(`[${tag}] anthropic`, response.status, await response.text().catch(() => ''))
    }
  } catch (error) {
    console.error(`[${tag}] anthropic failed:`, error)
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY!}` },
    body: JSON.stringify({
      model: OPENAI_FALLBACK_MODEL,
      max_tokens: 1024,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })
  if (!response.ok) {
    throw new Error(`openai fallback status ${response.status}: ${await response.text().catch(() => '')}`)
  }
  const data = await response.json()
  const text = data?.choices?.[0]?.message?.content
  if (!text) throw new Error('openai fallback: пустой ответ')
  return { text, model: OPENAI_FALLBACK_MODEL }
}

// Модель иногда оборачивает JSON в ```json ... ``` — снимаем.
export function parseJsonLoose(text: string): unknown {
  return JSON.parse(text.replace(/```json/gi, '').replace(/```/g, '').trim())
}
