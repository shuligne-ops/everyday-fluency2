import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

type Contrast = Record<string, unknown>

export async function POST(req: NextRequest) {
  try {
    const { attempt_id } = await req.json()
    if (!attempt_id) return NextResponse.json({ error: 'Нужен attempt_id' }, { status: 400 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )
    // Сортировка — только тай-брейк для дубля одного шага внутри текущего attempt_id.
    const { data, error } = await supabase
      .from('diagnostic_sessions')
      .select('step, audio_path, transcript, contrast, created_at')
      .eq('attempt_id', attempt_id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[diagnostic-result] fetch failed:', error)
      return NextResponse.json({ error: 'Не удалось собрать итог' }, { status: 500 })
    }

    const latestByStep = new Map<string, { audio_path: string | null; transcript: string | null; contrast: Contrast | null }>()
    for (const row of data ?? []) {
      if (!latestByStep.has(row.step)) latestByStep.set(row.step, row as { audio_path: string | null; transcript: string | null; contrast: Contrast | null })
    }
    const tryRow = latestByStep.get('try')
    if (!tryRow) return NextResponse.json({ error: 'TRY для этого прохождения не найден' }, { status: 400 })

    const tryContrast = tryRow.contrast ?? {}
    const retryContrast = latestByStep.get('retry')?.contrast ?? {}
    const transferContrast = latestByStep.get('transfer')?.contrast ?? {}
    let tryAudioUrl: string | null = null
    if (tryRow.audio_path) {
      const { data: signed, error: signedError } = await supabase.storage
        .from('diagnostic-audio')
        .createSignedUrl(tryRow.audio_path, 60 * 60)
      if (signedError) console.error('[diagnostic-result] signed URL failed:', signedError)
      else tryAudioUrl = signed?.signedUrl ?? null
    }

    const transferRaw = transferContrast.transfer_score
    const transferScore = transferRaw === 0 || transferRaw === 1 || transferRaw === 2 ? transferRaw : null
    return NextResponse.json({
      result: {
        tryAudioUrl,
        patternName: typeof tryContrast.pattern === 'string' && tryContrast.pattern ? tryContrast.pattern : 'Паттерн пока не определён',
        userLine: typeof tryContrast.quote === 'string' && tryContrast.quote ? tryContrast.quote : (tryRow.transcript ?? '—'),
        nativeReads: typeof tryContrast.heard_as === 'string' && tryContrast.heard_as ? tryContrast.heard_as : 'Разбор этой реплики пока недоступен.',
        transferScore,
        shiftNote: typeof retryContrast.shift_note === 'string' && retryContrast.shift_note ? retryContrast.shift_note : null,
      },
    })
  } catch (error) {
    console.error('[diagnostic-result] unexpected:', error)
    return NextResponse.json({ error: 'Ошибка сборки итога' }, { status: 500 })
  }
}
