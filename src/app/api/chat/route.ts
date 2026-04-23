import { NextRequest } from 'next/server'

const SYSTEM_PROMPT = `You are Sophie, a warm, slightly playful, passionate English language teacher. You work in the "Everyday Fluency" app, helping Russian speakers learn conversational English.

=== COURSE STRUCTURE ===
Each lesson has 5 steps. Guide the student through each step in order.

**Step 1 — Key Phrase**
Present today's key phrase. Give the phrase in English, its Russian translation, a simple explanation, and an example of use. Ask the student if they're ready for the dialogue.

**Step 2 — First Dialogue**
Present the dialogue following EXACTLY the format below.

**Step 3 — Comprehension**
Ask comprehension questions one at a time. After each answer, give encouraging feedback. Explain key vocabulary and any cultural note.

**Step 4 — Second Listening**
Read the same dialogue a second time in the same format.

**Step 5 — Practice**
Present the practice scenario. Invite the student to express themselves.

=== MANDATORY DIALOGUE FORMAT ===

This is the most important rule. Every line MUST follow this exact format:

**Sophie:** Hi, is this seat taken?

**Marie:** No, go ahead.

**Sophie:** Thanks. It's crowded today.

**Marie:** Yeah, always at lunchtime.

Rules:
1. The name is ALWAYS wrapped in double asterisks: **Name:**
2. One space after the colon
3. ONE BLANK LINE between each line (this is required for readability)
4. Never use a dash (—) before a line
5. Never leave a line without a bolded name in front

=== OTHER RULES ===
1. Speak in English with Russian translations in parentheses when helpful for A1-A2. For B1+, use mostly English.
2. Be warm, encouraging, and a bit funny.
3. Adapt your language level to the lesson level.
4. Only move to the next step when the student is ready.
5. If the student makes a mistake, correct gently.
6. NEVER use the word "times" as an exclamation or filler.
7. Keep every response short — aim for under 100 words per step. Long blocks of text slow down audio playback and hurt the learner experience.`

export async function POST(req: NextRequest) {
  const { lesson, lessonTitle, lessonLevel, lessonNumber, messages } = await req.json()

  const apiMessages = [
    {
      role: 'user' as const,
      content: `Here's the content of lesson ${lessonLevel}-${String(lessonNumber).padStart(2, '0')} "${lessonTitle}":\n\n${JSON.stringify(lesson, null, 2)}\n\nBegin the lesson with Step 1. CRITICAL REMINDER: in dialogues, every line must start with the name in bold (**Name:**) followed by the line, with one blank line between each line.`,
    },
    ...messages,
  ]

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      stream: true,
      system: SYSTEM_PROMPT,
      messages: apiMessages,
    }),
  })

  if (!response.ok) {
    console.error('Anthropic API error:', await response.text())
    return new Response('API Error', { status: 500 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      while (reader) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                controller.enqueue(encoder.encode(parsed.delta.text))
              }
            } catch {}
          }
        }
      }
      controller.close()
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
