'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { hasActiveSubscription, getUserSubscription } from '@/lib/access'

type PlanKey = 'monthly' | 'annual' | 'launch_annual'

export default function PricingPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [hasSubscription, setHasSubscription] = useState(false)
  const [currentPlan, setCurrentPlan] = useState<string | null>(null)
  const [loading, setLoading] = useState<PlanKey | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        setUserId(user.id)
        setUserEmail(user.email ?? null)
        const has = await hasActiveSubscription(user.id)
        setHasSubscription(has)
        if (has) {
          const sub = await getUserSubscription(user.id)
          if (sub) setCurrentPlan(sub.plan)
        }
      }
    })
  }, [])

  async function handleSubscribe(plan: PlanKey) {
    setError(null)

    // Незалогиненный → отправляем на /auth с возвратом
    if (!userId) {
      router.push(`/auth?return=/pricing&plan=${plan}`)
      return
    }

    setLoading(plan)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({ plan }),
      })

      const result = await res.json()

      if (!res.ok) {
        if (res.status === 503) {
          setError('Платёжная система ещё не подключена. Подписка станет доступна на днях.')
        } else if (res.status === 410) {
          setError(result.message ?? 'Стартовое предложение закончилось.')
        } else {
          setError(result.message ?? 'Не удалось создать платёж. Попробуйте позже.')
        }
        setLoading(null)
        return
      }

      // Редирект на страницу оплаты ЮKassa
      window.location.href = result.confirmation_url
    } catch (err) {
      console.error(err)
      setError('Ошибка соединения. Проверьте интернет и попробуйте снова.')
      setLoading(null)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #fdf8f0 0%, #f5f9f7 100%)' }}>
      {/* Header */}
      <header style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #f5f5f4', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '12px', background: 'linear-gradient(135deg, #f59e0b, #f97316)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '14px' }}>EF</div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#292524' }}>Everyday Fluency</div>
            <div style={{ fontSize: '12px', color: '#d97706' }}>English coaching session</div>
          </div>
        </Link>
        <Link href="/" style={{ fontSize: '14px', color: '#d97706', textDecoration: 'none' }}>← На главную</Link>
      </header>

      {/* Content */}
      <main style={{ maxWidth: '720px', margin: '0 auto', padding: '40px 20px 60px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 700, color: '#292524', marginBottom: '12px' }}>Тарифы</h1>
        <p style={{ fontSize: '16px', color: '#57534e', marginBottom: '32px', lineHeight: 1.6 }}>
          Первый урок каждого уровня — бесплатно, без регистрации.
          Платная подписка открывает все остальные уровни — A2, B1, B2, C1 и C2.
          Курс готов целиком: 180 уроков, шесть уровней CEFR, от первого «Hello» до свободного владения языком.
          Разговорный английский с виртуальным преподавателем Sophie.
        </p>

        {hasSubscription && (
          <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: '12px', padding: '16px 20px', marginBottom: '24px' }}>
            <div style={{ fontWeight: 600, color: '#166534', marginBottom: '4px' }}>✓ У вас активная подписка</div>
            <div style={{ fontSize: '14px', color: '#15803d' }}>
              Тариф: {currentPlan === 'monthly' ? 'Месяц' : currentPlan === 'annual' ? 'Год' : currentPlan === 'launch_annual' ? 'Стартовый годовой' : currentPlan}
            </div>
          </div>
        )}

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '12px', padding: '16px 20px', marginBottom: '24px', color: '#991b1b', fontSize: '14px' }}>
            {error}
          </div>
        )}

        {/* Monthly */}
        <PricingCard
          title="Месяц"
          price="990 ₽"
          period="/ месяц"
          description="Полный доступ ко всем уровням от A2 до C2 на 30 дней. Разовый платёж — автопродления нет, ничего не списывается повторно."
          isCurrentPlan={currentPlan === 'monthly'}
          isLoading={loading === 'monthly'}
          disabled={hasSubscription || loading !== null}
          onClick={() => handleSubscribe('monthly')}
        />

        {/* Annual — featured */}
        <PricingCard
          title="Год"
          price="7 990 ₽"
          period="/ год"
          description="Полный доступ ко всем уровням от A2 до C2 на 12 месяцев. Экономия 33 % по сравнению с помесячной оплатой."
          subtext="Стартовое предложение до 31 августа — 4 990 ₽ за год."
          subtextLink={{ label: 'Воспользоваться', plan: 'launch_annual' }}
          featured
          isCurrentPlan={currentPlan === 'annual' || currentPlan === 'launch_annual'}
          isLoading={loading === 'annual'}
          disabled={hasSubscription || loading !== null}
          onClick={() => handleSubscribe('annual')}
          onSubtextClick={() => handleSubscribe('launch_annual')}
          subtextLoading={loading === 'launch_annual'}
        />

        {/* What's included */}
        <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#292524', marginTop: '40px', marginBottom: '16px' }}>Что входит в подписку</h2>
        <ul style={{ listStyle: 'none', padding: 0, color: '#57534e', fontSize: '15px', lineHeight: 1.8 }}>
          <li>✓ Все 180 уроков от A1 до C2 — курс готов целиком</li>
          <li>✓ Виртуальный преподаватель Sophie с памятью и характером</li>
          <li>✓ Озвучка всех диалогов — живой темп и британский акцент</li>
          <li>✓ Распознавание речи — отвечайте голосом</li>
          <li>✓ Трекер выученных выражений</li>
        </ul>
      </main>
    </div>
  )
}

// ----- PricingCard component -----

type PricingCardProps = {
  title: string
  price: string
  period: string
  description: string
  subtext?: string
  subtextLink?: { label: string; plan: PlanKey }
  featured?: boolean
  isCurrentPlan?: boolean
  isLoading?: boolean
  disabled?: boolean
  onClick: () => void
  onSubtextClick?: () => void
  subtextLoading?: boolean
}

function PricingCard({
  title, price, period, description, subtext, featured,
  isCurrentPlan, isLoading, disabled, onClick,
  onSubtextClick, subtextLoading,
}: PricingCardProps) {
  return (
    <div style={{
      position: 'relative',
      background: 'white',
      borderRadius: '16px',
      padding: '24px',
      marginBottom: '16px',
      border: featured ? '2px solid #f59e0b' : '1px solid #e7e5e4',
      boxShadow: featured ? '0 4px 12px rgba(245, 158, 11, 0.15)' : '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      {featured && (
        <div style={{
          position: 'absolute',
          top: '-10px',
          right: '20px',
          background: '#f59e0b',
          color: 'white',
          fontSize: '11px',
          fontWeight: 700,
          padding: '4px 10px',
          borderRadius: '8px',
          letterSpacing: '0.5px',
        }}>ВЫГОДНО</div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
        <div style={{ fontSize: '20px', fontWeight: 700, color: '#292524' }}>{title}</div>
        <div>
          <span style={{ fontSize: '28px', fontWeight: 700, color: '#292524' }}>{price}</span>
          <span style={{ fontSize: '14px', color: '#a8a29e', marginLeft: '4px' }}>{period}</span>
        </div>
      </div>
      <p style={{ fontSize: '14px', color: '#57534e', lineHeight: 1.6, marginBottom: '16px' }}>{description}</p>
      {subtext && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#92400e' }}>
          {subtext}
          {onSubtextClick && (
            <button
              onClick={onSubtextClick}
              disabled={disabled}
              style={{
                background: 'none', border: 'none', color: '#d97706',
                fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
                padding: 0, marginLeft: '6px', fontSize: '13px',
              }}
            >
              {subtextLoading ? '...' : '→'}
            </button>
          )}
        </div>
      )}
      <button
        onClick={onClick}
        disabled={disabled || isCurrentPlan}
        style={{
          width: '100%',
          padding: '12px',
          borderRadius: '12px',
          border: 'none',
          background: isCurrentPlan ? '#dcfce7' : (featured ? 'linear-gradient(135deg, #f59e0b, #f97316)' : '#292524'),
          color: isCurrentPlan ? '#166534' : 'white',
          fontSize: '15px',
          fontWeight: 600,
          cursor: (disabled || isCurrentPlan) ? 'not-allowed' : 'pointer',
          opacity: (disabled && !isCurrentPlan) ? 0.5 : 1,
          fontFamily: 'inherit',
        }}
      >
        {isCurrentPlan ? '✓ Ваш текущий тариф' : (isLoading ? 'Создаю платёж...' : 'Оформить подписку')}
      </button>
    </div>
  )
}
