'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

// Этот лендинг — точка приземления для рекламного трафика.
// НЕ показывает селектор уроков. Одна цель: довести до клика "Попробовать первый урок".
// UTM-параметры из URL сохраняем в localStorage, чтобы потом сматчить с регистрацией.

function StartContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Сохраняем UTM в localStorage для последующей атрибуции платежей к рекламной кампании
  useEffect(() => {
    const utms = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content']
    const data: Record<string, string> = {}
    utms.forEach(k => {
      const v = searchParams.get(k)
      if (v) data[k] = v
    })
    if (Object.keys(data).length > 0) {
      try {
        data.first_seen_at = new Date().toISOString()
        localStorage.setItem('ef_attribution', JSON.stringify(data))
      } catch {}
    }
  }, [searchParams])

  function startFirstLesson() {
    // Первый урок A1 — id зависит от данных в Supabase, но ссылка на главную с автозапуском
    // самого первого. Простой путь: редирект на главную, фронт сам подхватит дефолт A1-01.
    router.push('/?lesson=1')
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0a1628 0%, #0d1d35 100%)',
      color: '#f5f0e0',
      fontFamily: 'var(--font-sans, system-ui)',
    }}>
      {/* HERO */}
      <section style={{
        maxWidth: '720px',
        margin: '0 auto',
        padding: '48px 20px 32px',
        textAlign: 'center',
      }}>
        <div style={{
          display: 'inline-block',
          padding: '6px 14px',
          background: 'rgba(245, 158, 11, 0.15)',
          color: '#f59e0b',
          borderRadius: '20px',
          fontSize: '13px',
          fontWeight: 600,
          marginBottom: '20px',
          letterSpacing: '0.5px',
        }}>
          EVERYDAY FLUENCY
        </div>

        <h1 style={{
          fontFamily: 'var(--font-display, Georgia, serif)',
          fontSize: 'clamp(32px, 6vw, 48px)',
          fontWeight: 700,
          lineHeight: 1.15,
          margin: '0 0 20px',
          color: '#f5f0e0',
        }}>
          Перестань стесняться<br/>говорить по-английски
        </h1>

        <p style={{
          fontSize: 'clamp(16px, 3vw, 19px)',
          lineHeight: 1.6,
          color: '#b8c5d6',
          maxWidth: '560px',
          margin: '0 auto 32px',
        }}>
          180 уроков-диалогов с Софи и Мари. Из любого уровня — в свободную речь. 30 минут в день, без зубрёжки.
        </p>

        <button
          onClick={startFirstLesson}
          style={{
            background: '#f59e0b',
            color: '#0a1628',
            border: 'none',
            padding: '16px 40px',
            borderRadius: '12px',
            fontSize: '17px',
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
            boxShadow: '0 8px 24px rgba(245, 158, 11, 0.3)',
          }}
        >
          Попробовать первый урок →
        </button>

        <p style={{
          marginTop: '14px',
          fontSize: '13px',
          color: '#8896aa',
        }}>
          Без регистрации. Бесплатно.
        </p>
      </section>

      {/* DIALOGUE PREVIEW — чтобы человек СРАЗУ увидел что это */}
      <section style={{
        maxWidth: '600px',
        margin: '0 auto',
        padding: '32px 20px',
      }}>
        <p style={{
          textAlign: 'center',
          color: '#8896aa',
          fontSize: '13px',
          letterSpacing: '1.5px',
          marginBottom: '20px',
        }}>
          ВОТ КАК ЭТО ВЫГЛЯДИТ
        </p>

        <div style={{
          background: 'rgba(245, 240, 224, 0.04)',
          borderRadius: '16px',
          padding: '24px',
          border: '1px solid rgba(245, 158, 11, 0.15)',
        }}>
          <DialogueLine speaker="Sophie" text="I missed the bus this morning." />
          <DialogueLine speaker="Marie" text="Again?" />
          <DialogueLine speaker="Sophie" text="Yes, and I spilled coffee on my notes." />
          <DialogueLine speaker="Marie" text="Oh no. What did you do?" />
          <DialogueLine speaker="Sophie" text="I just... laughed. What else can you do?" />
        </div>

        <p style={{
          textAlign: 'center',
          fontSize: '14px',
          color: '#b8c5d6',
          marginTop: '16px',
          fontStyle: 'italic',
        }}>
          Реальные диалоги. Живые ситуации. Никаких «Hello, my name is John».
        </p>
      </section>

      {/* HOW IT WORKS */}
      <section style={{
        maxWidth: '720px',
        margin: '0 auto',
        padding: '40px 20px',
      }}>
        <h2 style={{
          fontFamily: 'var(--font-display, Georgia, serif)',
          fontSize: '26px',
          fontWeight: 700,
          textAlign: 'center',
          marginBottom: '32px',
          color: '#f5f0e0',
        }}>
          Как устроен курс
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '20px',
        }}>
          <Feature icon="🎭" title="Диалоги, не правила" text="Учишься на реальных разговорах между Софи, Мари и их друзьями" />
          <Feature icon="🎙" title="Голос и распознавание" text="Слушаешь, повторяешь, говоришь — приложение услышит и поймёт" />
          <Feature icon="📈" title="6 уровней — 180 уроков" text="От первых фраз до свободной речи. Каждый урок — новая ситуация" />
          <Feature icon="📱" title="Где угодно" text="Браузер на телефоне, планшете, компьютере. Без установки приложения" />
        </div>
      </section>

      {/* FOUNDER STORY */}
      <section style={{
        maxWidth: '600px',
        margin: '0 auto',
        padding: '40px 20px',
      }}>
        <div style={{
          background: 'rgba(245, 240, 224, 0.04)',
          borderRadius: '16px',
          padding: '28px 24px',
          border: '1px solid rgba(245, 240, 224, 0.08)',
        }}>
          <p style={{
            color: '#8896aa',
            fontSize: '13px',
            letterSpacing: '1.5px',
            marginBottom: '16px',
          }}>
            ОТ АВТОРА
          </p>
          <p style={{
            fontSize: '16px',
            lineHeight: 1.7,
            color: '#d6dde8',
            margin: 0,
          }}>
            Я учил английский больше десяти лет — школа, репетиторы, учебники, приложения. Знал грамматику. А когда нужно было говорить — стоял и молчал. Языковой барьер.
            <br/><br/>
            Когда я наконец заговорил — понял, что мешало всё это время: не было живой разговорной практики каждый день.
            <br/><br/>
            EF — это то, чего мне самому не хватало. Полгода я делал курс, который вытаскивает в речь.
          </p>
          <p style={{
            marginTop: '16px',
            fontSize: '14px',
            color: '#8896aa',
          }}>
            — Александр, автор курса
          </p>
        </div>
      </section>

      {/* PRICING */}
      <section style={{
        maxWidth: '600px',
        margin: '0 auto',
        padding: '40px 20px',
      }}>
        <h2 style={{
          fontFamily: 'var(--font-display, Georgia, serif)',
          fontSize: '26px',
          fontWeight: 700,
          textAlign: 'center',
          marginBottom: '8px',
          color: '#f5f0e0',
        }}>
          Сколько это стоит
        </h2>
        <p style={{
          textAlign: 'center',
          color: '#8896aa',
          marginBottom: '24px',
        }}>
          Уровень A1 — навсегда бесплатно. Дальше по подписке.
        </p>

        <div style={{
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '20px',
          textAlign: 'center',
          fontSize: '14px',
        }}>
          🎁 <strong style={{ color: '#f59e0b' }}>Старт-оффер для первых 50:</strong> год за 4 990 ₽ вместо 7 990 ₽
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '12px',
        }}>
          <Price label="Месяц" value="890 ₽" period="в мес" />
          <Price label="Год" value="7 990 ₽" period="экономия 25%" highlight />
          <Price label="Навсегда" value="19 990 ₽" period="один платёж" />
        </div>

        <p style={{
          textAlign: 'center',
          fontSize: '12px',
          color: '#7a869a',
          marginTop: '16px',
        }}>
          Самозанятый Мешалкин А.В., ИНН 540447003201. Оплата через ЮKassa.
        </p>
      </section>

      {/* FINAL CTA */}
      <section style={{
        maxWidth: '600px',
        margin: '0 auto',
        padding: '32px 20px 64px',
        textAlign: 'center',
      }}>
        <h2 style={{
          fontFamily: 'var(--font-display, Georgia, serif)',
          fontSize: '24px',
          fontWeight: 700,
          marginBottom: '20px',
          color: '#f5f0e0',
        }}>
          Начни прямо сейчас
        </h2>

        <button
          onClick={startFirstLesson}
          style={{
            background: '#f59e0b',
            color: '#0a1628',
            border: 'none',
            padding: '16px 40px',
            borderRadius: '12px',
            fontSize: '17px',
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
            boxShadow: '0 8px 24px rgba(245, 158, 11, 0.3)',
          }}
        >
          Открыть первый урок →
        </button>

        <p style={{
          marginTop: '14px',
          fontSize: '13px',
          color: '#8896aa',
        }}>
          Первые 30 уроков — бесплатно, без регистрации.
        </p>
      </section>
    </div>
  )
}

function DialogueLine({ speaker, text }: { speaker: string; text: string }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <span style={{
        color: '#f59e0b',
        fontWeight: 700,
        fontSize: '14px',
        marginRight: '8px',
      }}>
        {speaker}:
      </span>
      <span style={{
        color: '#f5f0e0',
        fontSize: '15px',
        fontStyle: 'italic',
      }}>
        "{text}"
      </span>
    </div>
  )
}

function Feature({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div>
      <div style={{ fontSize: '32px', marginBottom: '8px' }}>{icon}</div>
      <h3 style={{
        fontSize: '16px',
        fontWeight: 700,
        marginBottom: '6px',
        color: '#f5f0e0',
      }}>
        {title}
      </h3>
      <p style={{
        fontSize: '14px',
        lineHeight: 1.5,
        color: '#a8b5c8',
        margin: 0,
      }}>
        {text}
      </p>
    </div>
  )
}

function Price({ label, value, period, highlight }: { label: string; value: string; period: string; highlight?: boolean }) {
  return (
    <div style={{
      background: highlight ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 240, 224, 0.04)',
      border: highlight ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(245, 240, 224, 0.08)',
      borderRadius: '12px',
      padding: '16px',
      textAlign: 'center',
    }}>
      <p style={{ fontSize: '13px', color: '#8896aa', marginBottom: '4px' }}>{label}</p>
      <p style={{ fontSize: '20px', fontWeight: 700, color: '#f5f0e0', marginBottom: '2px' }}>{value}</p>
      <p style={{ fontSize: '12px', color: '#8896aa' }}>{period}</p>
    </div>
  )
}

export default function StartPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0a1628' }} />}>
      <StartContent />
    </Suspense>
  )
}
