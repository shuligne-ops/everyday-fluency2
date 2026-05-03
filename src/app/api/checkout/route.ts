// src/app/api/checkout/route.ts
// Endpoint создаёт платёж через ЮKassa API и возвращает URL для редиректа.
//
// Использование с фронта:
//   const r = await fetch('/api/checkout', { method: 'POST', body: JSON.stringify({ plan: 'annual' }) })
//   const { confirmation_url } = await r.json()
//   window.location.href = confirmation_url
//
// СЕЙЧАС: если YOOKASSA_SHOP_ID и YOOKASSA_SECRET_KEY не заданы в env,
// возвращает 503 с понятной ошибкой. Это нормально — ЮKassa пока на модерации.
// После одобрения добавим переменные в Vercel и оно заработает само.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Тарифы — в копейках чтобы избежать проблем с float.
// Если поменяешь цены — синхронизируй и здесь, и на /pricing, и в SQL CHECK.
const PLANS = {
  monthly: { amount_kopeks: 89000, label: 'Подписка на месяц', plan: 'monthly' as const },
  annual: { amount_kopeks: 799000, label: 'Подписка на год', plan: 'annual' as const },
  launch_annual: { amount_kopeks: 499000, label: 'Стартовая подписка на год', plan: 'launch_annual' as const },
  lifetime: { amount_kopeks: 1999000, label: 'Доступ навсегда (EF + FAQ)', plan: 'lifetime' as const },
}

type PlanKey = keyof typeof PLANS

export async function POST(req: NextRequest) {
  // 1. Проверка ENV
  const shopId = process.env.YOOKASSA_SHOP_ID
  const secretKey = process.env.YOOKASSA_SECRET_KEY
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://everyday-fluency2.vercel.app'

  if (!shopId || !secretKey) {
    return NextResponse.json(
      {
        error: 'payment_not_configured',
        message: 'Платёжная система ещё не подключена. Заявка на ЮKassa на модерации.',
      },
      { status: 503 }
    )
  }

  // 2. Парсим запрос
  let body: { plan?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const planKey = body.plan as PlanKey | undefined
  if (!planKey || !(planKey in PLANS)) {
    return NextResponse.json(
      { error: 'invalid_plan', valid_plans: Object.keys(PLANS) },
      { status: 400 }
    )
  }
  const planInfo = PLANS[planKey]

  // 3. Авторизация юзера через access_token из заголовка
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer /, '')
  if (!token) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // Используем service-role для проверки токена (anon key недостаточно для admin-операций)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseService = createClient(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { data: userData, error: userErr } = await supabaseService.auth.getUser(token)
  if (userErr || !userData.user) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 })
  }
  const user = userData.user

  // 4. Если launch_annual — проверяем что место в первой 50-ке ещё есть
  if (planKey === 'launch_annual') {
    const { count, error: countErr } = await supabaseService
      .from('user_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('plan', 'launch_annual')

    if (countErr) {
      console.error('[checkout] launch count check failed:', countErr)
      return NextResponse.json({ error: 'internal_error' }, { status: 500 })
    }
    if ((count ?? 0) >= 50) {
      return NextResponse.json(
        {
          error: 'launch_offer_ended',
          message: 'Стартовое предложение для первых 50 подписчиков уже использовано. Доступен обычный годовой тариф.',
        },
        { status: 410 }
      )
    }
  }

  // 5. Создаём платёж в ЮKassa
  // API: https://yookassa.ru/developers/api#create_payment
  const idempotenceKey = crypto.randomUUID()
  const credentials = Buffer.from(`${shopId}:${secretKey}`).toString('base64')

  const yookassaBody = {
    amount: {
      value: (planInfo.amount_kopeks / 100).toFixed(2), // "7990.00"
      currency: 'RUB',
    },
    capture: true, // одношаговый платёж (без хольда)
    confirmation: {
      type: 'redirect',
      return_url: `${baseUrl}/payment/success?plan=${planKey}`,
    },
    description: `${planInfo.label} — ${user.email ?? 'Everyday Fluency'}`,
    metadata: {
      user_id: user.id,
      plan: planInfo.plan,
      user_email: user.email ?? '',
    },
    receipt: {
      customer: { email: user.email ?? 'no-email@everyday-fluency.app' },
      items: [
        {
          description: planInfo.label,
          quantity: '1.00',
          amount: {
            value: (planInfo.amount_kopeks / 100).toFixed(2),
            currency: 'RUB',
          },
          vat_code: 1, // НДС не облагается (самозанятый)
          payment_subject: 'service',
          payment_mode: 'full_payment',
        },
      ],
    },
  }

  let yookassaResp: Response
  try {
    yookassaResp = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${credentials}`,
        'Idempotence-Key': idempotenceKey,
      },
      body: JSON.stringify(yookassaBody),
    })
  } catch (err) {
    console.error('[checkout] ЮKassa fetch failed:', err)
    return NextResponse.json({ error: 'yookassa_unreachable' }, { status: 502 })
  }

  if (!yookassaResp.ok) {
    const errText = await yookassaResp.text()
    console.error('[checkout] ЮKassa error:', yookassaResp.status, errText)
    return NextResponse.json(
      { error: 'yookassa_error', status: yookassaResp.status, details: errText },
      { status: 502 }
    )
  }

  const payment = await yookassaResp.json()
  // payment.confirmation.confirmation_url — ссылка куда редиректить юзера
  // payment.id — ID платежа, придёт в webhook'е

  // 6. Создаём pending-запись подписки (UPSERT по user_id)
  // Когда придёт webhook payment.succeeded — обновим status на 'active'
  const expiresAt = (() => {
    if (planKey === 'lifetime') return null
    const now = new Date()
    if (planKey === 'monthly') return new Date(now.setMonth(now.getMonth() + 1)).toISOString()
    // annual или launch_annual
    return new Date(now.setFullYear(now.getFullYear() + 1)).toISOString()
  })()

  const { error: upsertErr } = await supabaseService
    .from('user_subscriptions')
    .upsert(
      {
        user_id: user.id,
        plan: planInfo.plan,
        status: 'pending',
        starts_at: new Date().toISOString(),
        expires_at: expiresAt,
        amount_paid: planInfo.amount_kopeks,
        currency: 'RUB',
        yookassa_payment_id: payment.id,
      },
      { onConflict: 'user_id' }
    )

  if (upsertErr) {
    console.error('[checkout] upsert failed:', upsertErr)
    // не возвращаем ошибку юзеру — платёж уже создан, webhook сам пометит active
  }

  return NextResponse.json({
    confirmation_url: payment.confirmation.confirmation_url,
    payment_id: payment.id,
  })
}
