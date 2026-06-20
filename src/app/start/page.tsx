'use client'

import { useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

// Этот лендинг — точка приземления для рекламного трафика EF.
// Главный аргумент: ЗВУЧАНИЕ. Школа учит читать — мы учим звучать.
// UTM-параметры из URL сохраняем в localStorage для атрибуции.

function StartContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

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
          Школа дала тебе чтение.<br/>
          <span style={{ color: '#f59e0b' }}>Мы даём звук.</span>
        </h1>

        <p style={{
          fontSize: 'clamp(16px, 3vw, 19px)',
          lineHeight: 1.6,
          color: '#b8c5d6',
          maxWidth: '560px',
          margin: '0 auto 32px',
        }}>
          Курс английского, где Sophie из Лондона говорит живым голосом носителя — со связками, ритмом и реальным акцентом. Не как Google Translate. 180 уроков, 30 минут в день.
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
          Послушать первый урок →
        </button>

        <p style={{
          marginTop: '14px',
          fontSize: '13px',
          color: '#8896aa',
        }}>
          Без регистрации. Бесплатно.
        </p>
      </section>

      {/* THE GAP — главный новый блок */}
      <section style={{
        maxWidth: '640px',
        margin: '0 auto',
        padding: '32px 20px',
      }}>
        <p style={{
          textAlign: 'center',
          color: '#8896aa',
          fontSize: '13px',
          letterSpacing: '1.5px',
          marginBottom: '24px',
        }}>
          ВОТ ПОЧЕМУ ШКОЛЬНЫЙ АНГЛИЙСКИЙ НЕ РАБОТАЕТ
        </p>

        <h2 style={{
          fontFamily: 'var(--font-display, Georgia, serif)',
          fontSize: '24px',
          fontWeight: 700,
          textAlign: 'center',
          marginBottom: '28px',
          color: '#f5f0e0',
          lineHeight: 1.3,
        }}>
          Понимаешь каждое слово в учебнике,<br/>
          но не понимаешь ни одного в разговоре?
        </h2>

        <GapRow
          school='"I have got to go now."'
          schoolPhonetic="— ай хэв гот ту гоу нау —"
          real='"I&apos;vegoddagonow."'
          realPhonetic="айвгодагонау — одно слово, 0.7 секунды"
        />
        <GapRow
          school='"What are you doing?"'
          schoolPhonetic="— уот ар ю дуинг —"
          real='"Whatcha doin&apos;?"'
          realPhonetic="уача доин — один слог"
        />
        <GapRow
          school='"Did you eat?"'
          schoolPhonetic="— дид ю ит —"
          real='"Jeet?"'
          realPhonetic="джит — один звук"
        />

        <p style={{
          textAlign: 'center',
          fontSize: '15px',
          color: '#b8c5d6',
          marginTop: '24px',
          fontStyle: 'italic',
          lineHeight: 1.6,
        }}>
          Это называется <strong style={{ color: '#f59e0b', fontStyle: 'normal' }}>connected speech</strong> — реальная фонетика английского.<br/>
          В школе её нет. У нас — на каждом уроке.
        </p>
      </section>

      {/* DIALOGUE PREVIEW */}
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
          ВОТ КАК ЗВУЧИТ ОДИН УРОК
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
          Реальные диалоги, живой акцент, настоящая скорость. Никаких «Hello, my name is John».
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
          Что внутри курса
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '20px',
        }}>
          <Feature icon="🎙" title="Живой голос Sophie" text="Не синтезатор. Живой британский акцент со связками, ритмом и реальной скоростью" />
          <Feature icon="🎭" title="Connected speech" text="Wanna, gonna, hafta, jeet — реальная фонетика, которой не учат в школе" />
          <Feature icon="🗣" title="Распознавание речи" text="Говоришь — приложение слышит и понимает. Тренировка произношения в одиночку" />
          <Feature icon="📈" title="180 уроков, 6 уровней" text="От первых фраз до свободной речи. Каждый урок — новая ситуация" />
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
            ПОЧЕМУ Я СДЕЛАЛ ЭТОТ КУРС
          </p>
          <p style={{
            fontSize: '16px',
            lineHeight: 1.7,
            color: '#d6dde8',
            margin: 0,
          }}>
            Я учил английский больше десяти лет. Школа, репетиторы, учебники, приложения. Знал грамматику. Читал статьи без словаря.
            <br/><br/>
            А когда приехал в Лондон — не понял ни одной фразы в первом разговоре. Звуки шли — слов не было. Будто язык, которому меня учили, и язык, на котором говорят, — это два разных языка.
            <br/><br/>
            Через несколько месяцев я понял: они и правда разные. Школа учит, <strong>как слова пишутся</strong>. А носители говорят, <strong>как они звучат вместе</strong>. И этой второй системе в России не учат — ни в школе, ни в большинстве курсов.
            <br/><br/>
            Everyday Fluency — это то, чего мне самому не хватало все эти годы. Курс, где ты слышишь язык таким, какой он есть. И постепенно начинаешь сам звучать так же.
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
          3 урока A1 — бесплатно. Дальше один тариф открывает все уровни A1–C2.
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
          <Price label="Месяц" value="1 500 ₽" period="в мес" />
          <Price label="Год" value="7 990 ₽" period="экономия 25%" highlight />
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
          marginBottom: '12px',
          color: '#f5f0e0',
        }}>
          Услышь, как звучит английский на самом деле
        </h2>
        <p style={{
          fontSize: '15px',
          color: '#b8c5d6',
          marginBottom: '24px',
          lineHeight: 1.5,
        }}>
          Первый урок — два клика, без регистрации.
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
          Послушать Sophie →
        </button>

        <p style={{
          marginTop: '14px',
          fontSize: '13px',
          color: '#8896aa',
        }}>
          3 урока A1 — бесплатно, без регистрации.
        </p>
      </section>

      {/* TELEGRAM CHANNEL */}
      <section style={{
        maxWidth: '600px',
        margin: '0 auto',
        padding: '0 20px 56px',
      }}>
        <div style={{
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          borderRadius: '12px',
          padding: '20px 24px',
          textAlign: 'center',
        }}>
          <p style={{
            fontSize: '14px',
            color: '#b8c5d6',
            marginBottom: '12px',
            lineHeight: 1.5,
          }}>
            Не готовы начать сегодня? Подписывайтесь на канал —<br />
            живая фраза, разбор звука или диалог раз в несколько дней.
          </p>
          <a
            href="https://t.me/everyday_fluency"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              color: '#f59e0b',
              fontSize: '15px',
              fontWeight: 700,
              textDecoration: 'none',
              borderBottom: '1px solid rgba(245, 158, 11, 0.4)',
              paddingBottom: '2px',
            }}
          >
            @everyday_fluency →
          </a>
        </div>
      </section>
    </div>
  )
}

function GapRow({ school, schoolPhonetic, real, realPhonetic }: { school: string; schoolPhonetic: string; real: string; realPhonetic: string }) {
  return (
    <div style={{
      background: 'rgba(245, 240, 224, 0.03)',
      borderRadius: '12px',
      padding: '16px 20px',
      marginBottom: '14px',
      border: '1px solid rgba(245, 240, 224, 0.06)',
    }}>
      <div style={{ marginBottom: '10px' }}>
        <p style={{
          fontSize: '12px',
          color: '#7a869a',
          letterSpacing: '1px',
          marginBottom: '4px',
        }}>
          ШКОЛА УЧИТ ТАК
        </p>
        <p style={{
          fontSize: '17px',
          color: '#a8b5c8',
          fontStyle: 'italic',
          marginBottom: '2px',
        }}>
          {school}
        </p>
        <p style={{ fontSize: '13px', color: '#7a869a' }}>{schoolPhonetic}</p>
      </div>
      <div style={{
        height: '1px',
        background: 'rgba(245, 158, 11, 0.15)',
        margin: '12px 0',
      }} />
      <div>
        <p style={{
          fontSize: '12px',
          color: '#f59e0b',
          letterSpacing: '1px',
          marginBottom: '4px',
        }}>
          БРИТАНЕЦ ГОВОРИТ ТАК
        </p>
        <p style={{
          fontSize: '20px',
          color: '#f5f0e0',
          fontWeight: 700,
          fontStyle: 'italic',
          marginBottom: '2px',
        }}>
          {real}
        </p>
        <p style={{ fontSize: '13px', color: '#fcd34d' }}>{realPhonetic}</p>
      </div>
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
        &quot;{text}&quot;
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
