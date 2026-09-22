import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/speaking-engine'

/**
 * Prototype read endpoint for longitudinal speaking memory.
 * Uses the anonymous diagnostic id already owned by this browser. It exposes
 * only scheduling/performance metadata, never rubrics or model-only scenarios.
 */
export async function GET(req: NextRequest) {
  const userKey = req.nextUrl.searchParams.get('user_key')?.trim()
  const move = req.nextUrl.searchParams.get('move')?.trim()
  const proofAttempt = req.nextUrl.searchParams.get('attempt_id')?.trim()

  if (!userKey || userKey.length < 8) {
    return NextResponse.json({ error: 'Нужен user_key' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Do not make the service-role endpoint an oracle for arbitrary anonymous ids.
  // The caller must prove knowledge of an attempt_id that belongs to this user_key.
  if (!proofAttempt) return NextResponse.json({ error: 'Нужен attempt_id' }, { status: 400 })
  const { data: proof } = await supabase
    .from('diagnostic_sessions')
    .select('id')
    .eq('anon_id', userKey)
    .eq('attempt_id', proofAttempt)
    .limit(1)
    .maybeSingle()
  if (!proof) return NextResponse.json({ error: 'Сессия не подтверждена' }, { status: 403 })

  let query = supabase
    .from('skill_memory')
    .select('move_id,strength,successful_transfers,failed_transfers,last_transfer_score,last_latency_ms,best_latency_ms,last_seen_at,next_probe_at,updated_at')
    .eq('user_key', userKey)

  if (move) query = query.eq('move_id', move)

  const { data, error } = await query.order('next_probe_at', { ascending: true })
  if (error) {
    console.error('[skill-memory] read failed:', error)
    return NextResponse.json({ error: 'Память навыка пока недоступна' }, { status: 503 })
  }

  const now = Date.now()
  const skills = (data ?? []).map((row) => ({
    ...row,
    due: new Date(row.next_probe_at).getTime() <= now,
  }))

  return NextResponse.json({ skills })
}
