'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { hasActiveSubscription } from '@/lib/access'

// Главный экспорт — оборачивает контент в Suspense.
// Это требование Next.js 16: useSearchParams() должен быть внутри Suspense
// чтобы prerender работал корректно.
export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <PaymentSuccessContent />
    </Suspense>
  )
}

function LoadingFallback() {
  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#292524', marginBottom: '8px' }}>Загрузка…</h1>
      </div>
    </div>
  )
}

// Основной контент — здесь useSearchParams() безопасен потому что 
// компонент рендерится только на клиенте (внутри Suspense).
function PaymentSuccessContent() {
  const router = useRouter()
  const search = useSearchParams()
  const [status, setStatus] = useState<'checking' | 'active' | 'pending' | 'unknown'>('checking')
  const [attempts, setAttempts] = useState(0)

  const planFromUrl = search.get('plan')
  const planLabel =
    planFromUrl === 'monthly' ? 'Месяц' :
    planFromUrl === 'annual' ? 'Год' :
    planFromUrl === 'launch_annual' ? 'Стартовый годовой' :
    planFromUrl === 'lifetime' ? 'Навсегда' : null

  useEffect(() => {
    let cancelled = false

    async function checkStatus() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setStatus('unknown')
        return
      }

      const has = await hasActiveSubscription(user.id)
      if (cancelled) return

      if (has) {
        setStatus('active')
      } else if (attempts < 5) {
        setStatus('pending')
        setTimeout(() => {
          if (!cancelled) setAttempts((a) => a + 1)
        }, 2000)
      } else {
        setStatus('pending')
      }
    }

    checkStatus()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempts])

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        {status === 'checking' && (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#292524', marginBottom: '8px' }}>Проверяем оплату…</h1>
            <p style={{ fontSize: '15px', color: '#57534e', lineHeight: 1.6 }}>Это займёт несколько секунд.</p>
          </>
        )}

        {status === 'active' && (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#292524', marginBottom: '12px' }}>Подписка активирована</h1>
            {planLabel && (
              <p style={{ fontSize: '15px', color: '#57534e', marginBottom: '20px' }}>Тариф: <strong>{planLabel}</strong></p>
            )}
            <p style={{ fontSize: '15px', color: '#57534e', lineHeight: 1.6, marginBottom: '24px' }}>
              Сейчас открыты A1 и A2 (60 уроков). Уровни B1–C2 готовятся и будут добавляться регулярно — доступ откроется автоматически. Чек о покупке оформляется вручную и придёт на ваш email в течение суток.
            </p>
            <Link
              href="/"
              style={{
                display: 'inline-block',
                background: 'linear-gradient(135deg, #f59e0b, #f97316)',
                color: 'white',
                padding: '12px 28px',
                borderRadius: '12px',
                fontWeight: 600,
                textDecoration: 'none',
                fontSize: '15px',
              }}
            >
              К урокам →
            </Link>
          </>
        )}

        {status === 'pending' && (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#292524', marginBottom: '12px' }}>Платёж принят, активируем…</h1>
            <p style={{ fontSize: '15px', color: '#57534e', lineHeight: 1.6, marginBottom: '20px' }}>
              ЮKassa обрабатывает платёж. Активация обычно занимает до минуты, иногда чуть дольше.
              Если через 5 минут доступ не появится — напишите на shuligne@gmail.com с указанием времени оплаты.
            </p>
            <button
              onClick={() => router.refresh()}
              style={{
                background: '#292524', color: 'white', padding: '10px 24px',
                borderRadius: '12px', border: 'none', fontWeight: 600,
                cursor: 'pointer', fontSize: '14px', fontFamily: 'inherit',
              }}
            >
              Проверить ещё раз
            </button>
          </>
        )}

        {status === 'unknown' && (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🤔</div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#292524', marginBottom: '12px' }}>Не удалось проверить статус</h1>
            <p style={{ fontSize: '15px', color: '#57534e', lineHeight: 1.6, marginBottom: '20px' }}>
              Возможно, вы не вошли в систему. Войдите и откройте /pricing — там будет статус подписки.
            </p>
            <Link
              href="/auth"
              style={{
                display: 'inline-block',
                background: '#292524', color: 'white',
                padding: '10px 24px', borderRadius: '12px',
                textDecoration: 'none', fontWeight: 600, fontSize: '14px',
              }}
            >
              Войти
            </Link>
          </>
        )}
      </div>
    </div>
  )
}

// Общие стили вынесены чтобы fallback и main выглядели одинаково
const containerStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: 'linear-gradient(160deg, #fdf8f0 0%, #f5f9f7 100%)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '20px',
}

const cardStyle: React.CSSProperties = {
  background: 'white',
  borderRadius: '20px',
  padding: '40px 32px',
  maxWidth: '480px',
  width: '100%',
  boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
  textAlign: 'center',
}
