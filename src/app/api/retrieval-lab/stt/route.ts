import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const audio = form.get('audio')
    if (!(audio instanceof File)) {
      return NextResponse.json({ error: 'Нужна аудиозапись' }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'STT временно недоступен' }, { status: 503 })

    const whisperForm = new FormData()
    whisperForm.append('file', audio, 'response.webm')
    whisperForm.append('model', 'whisper-1')
    whisperForm.append('language', 'en')

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: whisperForm,
    })

    if (!response.ok) {
      console.error('[retrieval-lab/stt]', response.status, await response.text().catch(() => ''))
      return NextResponse.json({ error: 'Не удалось распознать речь' }, { status: 502 })
    }

    const data = await response.json() as { text?: string }
    const transcript = data.text?.trim()
    if (!transcript) return NextResponse.json({ error: 'Речь не распознана' }, { status: 422 })

    return NextResponse.json({ transcript })
  } catch (error) {
    console.error('[retrieval-lab/stt] unexpected', error)
    return NextResponse.json({ error: 'Ошибка обработки записи' }, { status: 500 })
  }
}
