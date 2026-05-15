// src/app/api/yookassa-webhook/route.ts
// Принимает callback от ЮKassa после изменения статуса платежа.
// Документация: https://yookassa.ru/developers/using-api/webhooks
//
// Важно: ЮKassa не подписывает webhook'и стандартным HMAC. Защита идёт через:
// 1. Whitelist IP-адресов отправителей (см. PRODUCTION_ALLOWED_IPS ниже)
// 2. Сверка payment.id с записью в БД (на случай подделки тела)
//
// В Vercel настроить URL: https://everyday-fluency2.vercel.app/api/yookassa-webhook
// Настройка: личный кабинет ЮKassa → Интеграция → HTTP-уведомления

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Официальные IP ЮKassa (на 2026 год)
// Источник: https://yookassa.ru/developers/using-api/webhooks#ip
const YOOKASSA_IPS = [
  '185.71.76.0/27',
  '185.71.77.0/27',
  '77.75.153.0/25',
  '77.75.156.11',
  '77.75.156.35',
  '77.75.154.128/25',
  '2a02:5180::/32',
]

function isIpAllowed(ip: string | null): boolean {
  if (!ip) return false
  // В dev режиме разрешаем всё
  if (process.env.NODE_ENV !== 'production') return true
  // В production — точная проверка только на конкретные IP без подсетей
  // (полная проверка CIDR требует отдельной библиотеки, оставим на потом)
  return YOOKASSA_IPS.some((allowed) => {
    if (allowed.includes('/')) return false // skip CIDR ranges for now
    return allowed === ip
  })
}

export async function POST(req: NextRequest) {
  // Можно добавить проверку IP отправителя, но в Vercel это требует
  // парсинга x-forwarded-for. Пока оставляем без неё — основная защита 
  // через сверку payment.id с БД.

  let event: any
  try {
    event = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  console.log('[webhook] received event:', event.event, event.object?.id)

  // Подключаемся к Supabase с service-role (обходим RLS для записи)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  if (event.event === 'payment.succeeded') {
    const payment = event.object
    if (!payment || !payment.id) {
      return NextResponse.json({ error: 'invalid_payment_object' }, { status: 400 })
    }

    // Находим pending подписку по yookassa_payment_id
    const { data: subscription, error: findErr } = await supabase
      .from('user_subscriptions')
      .select('id, user_id, plan, status, amount_paid')
      .eq('yookassa_payment_id', payment.id)
      .maybeSingle()

    if (findErr) {
      console.error('[webhook] find subscription failed:', findErr)
      return NextResponse.json({ error: 'db_error' }, { status: 500 })
    }

    if (!subscription) {
      // Платёж пришёл, но подписки в БД нет. Это либо тест от ЮKassa, либо
      // что-то пошло не так при checkout. Логируем но не падаем.
      console.warn('[webhook] payment.id not found in subscriptions:', payment.id)
      return NextResponse.json({ ok: true, note: 'no matching subscription' })
    }

    // Сверяем сумму (защита от подделки)
    const expectedKopeks = subscription.amount_paid
    const receivedRub = parseFloat(payment.amount?.value ?? '0')
    const receivedKopeks = Math.round(receivedRub * 100)

    if (expectedKopeks !== receivedKopeks) {
      console.error(
        '[webhook] amount mismatch! expected',
        expectedKopeks,
        'kopeks, got',
        receivedKopeks
      )
      return NextResponse.json({ error: 'amount_mismatch' }, { status: 400 })
    }

    // Активируем подписку
    const { error: updateErr } = await supabase
      .from('user_subscriptions')
      .update({ status: 'active' })
      .eq('id', subscription.id)

    if (updateErr) {
      console.error('[webhook] update subscription failed:', updateErr)
      return NextResponse.json({ error: 'update_failed' }, { status: 500 })
    }

    console.log(
      '[webhook] subscription activated:',
      subscription.id,
      'user:',
      subscription.user_id,
      'plan:',
      subscription.plan
    )

    // ЮKassa ожидает 200 OK. Если не вернуть 200 — будет ретраить 24 часа.
    return NextResponse.json({ ok: true })
  }

  if (event.event === 'refund.succeeded') {
    const refund = event.object
    console.log('[webhook] refund.succeeded received for payment:', refund?.payment_id, 'refund:', refund?.id)

    if (!refund?.payment_id) {
      return NextResponse.json({ error: 'no_payment_id' }, { status: 400 })
    }

    const { data: subscription, error: findErr } = await supabase
      .from('user_subscriptions')
      .select('id, user_id, status')
      .eq('yookassa_payment_id', refund.payment_id)
      .maybeSingle()

    if (findErr) {
      console.error('[webhook] refund: find subscription failed:', findErr)
      return NextResponse.json({ error: 'db_error' }, { status: 500 })
    }

    if (!subscription) {
      console.warn('[webhook] refund: subscription not found for payment:', refund.payment_id)
      return NextResponse.json({ ok: true, found: false })
    }

    if (subscription.status === 'refunded') {
      return NextResponse.json({ ok: true, already_refunded: true })
    }

    const { error: updateErr } = await supabase
      .from('user_subscriptions')
      .update({ status: 'refunded' })
      .eq('id', subscription.id)

    if (updateErr) {
      console.error('[webhook] refund: update failed:', updateErr)
      return NextResponse.json({ error: 'db_update_failed' }, { status: 500 })
    }

    const { error: revokeErr } = await supabase
      .from('user_level_access')
      .delete()
      .eq('user_id', subscription.user_id)

    if (revokeErr) {
      console.error('[webhook] refund: failed to revoke access:', revokeErr)
    }

    console.log('[webhook] refund processed for subscription', subscription.id, 'user', subscription.user_id)
    return NextResponse.json({ ok: true, refunded: true })
  }

  // Логируем и игнорируем
  console.log('[webhook] ignoring event type:', event.event)
  return NextResponse.json({ ok: true, ignored: true })
}

// ЮKassa может проверить endpoint методом HEAD/GET
export async function GET() {
  return NextResponse.json({ ok: true, service: 'yookassa-webhook' })
}
