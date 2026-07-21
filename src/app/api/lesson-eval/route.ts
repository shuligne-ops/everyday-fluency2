import { NextRequest } from 'next/server'

type AnthropicContentBlock = {
  type: string
  text?: string
}

export async function POST(req: NextRequest) {
  const { system, user } = await req.json()

  if (!system || !user) {
    return Response.json({ error: 'missing system or user' }, { status: 400 })
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 700,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    })

    if (!response.ok) {
      const detail = await response.text()
      console.error('lesson-eval API error:', detail)
      return Response.json({ error: 'upstream error' }, { status: 502 })
    }

    const data = await response.json() as { content?: AnthropicContentBlock[] }
    const text = (data.content || [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text || '')
      .join('\n')
      .trim()

    return Response.json({ text })
  } catch (error) {
    console.error('lesson-eval request failed:', error)
    return Response.json({ error: 'upstream error' }, { status: 502 })
  }
}
