'use client'

import { useState, useRef, useEffect } from 'react'
import { track, trackOnce } from '@/lib/analytics'

/**
 * Аудио-микротест EF — /proverit-sluh
 *
 * НАЗНАЧЕНИЕ. Единица маркетинга: реклама САМА является первым упражнением продукта.
 * Формула: symptom → proof → lesson. Человек слышит реальный фрагмент реального урока,
 * не узнаёт знакомые слова на слух, видит транскрипт, переживает «я же это всё знаю» —
 * и уходит в бесплатный урок своего уровня.
 *
 * ЧЕСТНОСТЬ (критично, не менять без причины):
 * - Фрагменты — ДОСЛОВНО из уроков B1/B2/C1 (id 63/93/123). Человек получит внутри ровно
 *   то, что услышал здесь. Никакого mismatch между рекламой и продуктом.
 * - НЕ строим на «Jeet?»/редукциях: проверено — тексты уроков написаны орфографически
 *   чисто, ElevenLabs (stability 0.5) даёт естественный темп, но НЕ гарантирует слияния
 *   типа «Did you eat → Jeet». Обещать редукции = создать второй mismatch.
 * - Продаём то, что продукт правда делает: успевать за живым темпом и ловить смысл.
 * - НЕ обещаем говорение, произношение, снятие акцента.
 *
 * АУДИО. Ожидает готовые mp3 по путям ниже (генерируются через /api/tts голосом Sophie,
 * тем же, что в уроках). Если файла нет — блок покажет честную заглушку, не сломается.
 */

const NAVY = '#1a1a2e'
const AMBER = '#f59e0b'
const ORANGE = '#f97316'
const CREAM = '#fdf6ec'
const INK = '#2b2b3d'
const MUTED = '#7a7a8c'

interface Clip {
  id: string
  level: 'B1' | 'B2' | 'C1'
  lessonId: number
  lessonTitle: string
  audioSrc: string
  transcript: string
  /** Что именно проскакивает мимо на слух — честный разбор, не мистика. */
  slip: string
  /** Ситуация — чтобы человек видел: это рабочий контекст, не абстракция. */
  context: string
}

const CLIPS: Clip[] = [
  {
    id: 'b1',
    level: 'B1',
    lessonId: 63,
    lessonTitle: 'The Manchester Offer',
    audioSrc: '/audio/hearing-check/b1.mp3',
    transcript: "But that's what it is, isn't it? You'd be three hours away. Minimum.",
    slip: '«You\'d be» сжимается почти в один слог, а «Minimum» падает отдельным ударом в конце — и часто теряется целиком. При этом ни одного сложного слова здесь нет.',
    context: 'Подруга узнала, что ты уезжаешь в другой город.',
  },
  {
    id: 'b2',
    level: 'B2',
    lessonId: 93,
    lessonTitle: 'The Equity Track',
    audioSrc: '/audio/hearing-check/b2.mp3',
    transcript: 'Both can be true. Right. The partners had their quarterly meeting on Monday. Your name came up.',
    slip: 'Главное в реплике — последние четыре слова. «Your name came up» проходит на том же ровном тоне, что и остальное, без выделения. Именно их чаще всего и не слышат.',
    context: 'Руководитель закрыла дверь и говорит о твоём будущем в компании.',
  },
  {
    id: 'c1',
    level: 'C1',
    lessonId: 123,
    lessonTitle: 'The Omission',
    audioSrc: '/audio/hearing-check/c1.mp3',
    transcript: 'You absolutely do. The standard is: constantly. So when it drops to zero, I notice.',
    slip: 'Каждое слово входит в первую тысячу самых частотных. Но смысл собирается только к концу фразы — если отстал на «the standard is», дальше уже не догонишь.',
    context: 'Сестра заметила, что ты перестала упоминать одного человека.',
  },
]

export default function HearingCheck() {
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const [played, setPlayed] = useState<Record<string, boolean>>({})
  useEffect(() => { trackOnce('landing_view', 'landing_sluh') }, [])

  return (
    <main style={{ background: CREAM, minHeight: '100vh', color: INK, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '48px 20px 72px' }}>

        {/* HERO — тезис страницы: сначала звук, потом слова */}
        <p style={{ ...eyebrow, color: AMBER }}>Проверка на слух · 2 минуты</p>
        <h1 style={{
          fontFamily: 'var(--font-display), Georgia, serif',
          fontSize: 'clamp(28px, 5vw, 40px)', lineHeight: 1.15, fontWeight: 700,
          color: NAVY, margin: '0 0 18px',
        }}>
          Ты знаешь все эти слова.<br />Услышишь ли ты их в речи?
        </h1>
        <p style={{ fontSize: 17, lineHeight: 1.6, color: INK, margin: '0 0 10px' }}>
          Ниже три фрагмента из настоящих уроков Everyday Fluency. Ни одного редкого слова —
          всё, что там есть, ты проходил.
        </p>
        <p style={{ fontSize: 17, lineHeight: 1.6, color: MUTED, margin: '0 0 40px' }}>
          Сначала слушай. Отвечай себе честно: понял с первого раза или пришлось догадываться.
          Текст откроется, когда сам захочешь.
        </p>

        {CLIPS.map((clip, i) => (
          <ClipCard
            key={clip.id}
            clip={clip}
            index={i + 1}
            revealed={!!revealed[clip.id]}
            played={!!played[clip.id]}
            onPlayed={() => { track('audio_play', { level: clip.level }); setPlayed(p => ({ ...p, [clip.id]: true })) }}
            onReveal={() => { track('reveal', { level: clip.level }); setRevealed(r => ({ ...r, [clip.id]: true })) }}
          />
        ))}

        {/* ВЫВОД — честный, без обещаний */}
        <section style={{
          marginTop: 40, padding: '28px 24px', borderRadius: 16,
          background: 'white', border: `1px solid ${AMBER}33`,
        }}>
          <h2 style={{
            fontFamily: 'var(--font-display), Georgia, serif',
            fontSize: 22, fontWeight: 700, color: NAVY, margin: '0 0 14px',
          }}>
            Если что-то проскочило мимо — дело не в словарном запасе
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.6, margin: '0 0 12px' }}>
            Слова ты знаешь: только что видел их в тексте и узнал все до одного. Разрыв не
            между «знаю» и «не знаю», а между <b>знаю глазами</b> и <b>узнаю на слух в темпе</b>.
          </p>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: MUTED, margin: '0 0 12px' }}>
            Тот же механизм работает и в обратную сторону: когда отвечать твоя очередь, нужная
            фраза приходит с опозданием — хотя ты её знаешь.
          </p>
          <p style={{ fontSize: 16, lineHeight: 1.6, margin: 0 }}>
            Это не лечится чтением и не лечится грамматикой. Нужен объём живой речи, разобранной
            и прослушанной заново, — пока знакомое перестанет проскакивать мимо.
          </p>
        </section>

        {/* CTA — вход в урок своего уровня */}
        <section style={{ marginTop: 28, textAlign: 'center' }}>
          <p style={{ fontSize: 15, color: MUTED, margin: '0 0 16px' }}>
            Первый урок каждого уровня открыт бесплатно — без регистрации.
            Тот самый, из которого фрагменты выше.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            {CLIPS.map(c => (
              <a
                key={c.id}
                href={`/?level=${c.level}&lesson=${c.lessonId}`}
                style={{
                  padding: '14px 24px', borderRadius: 12, textDecoration: 'none',
                  fontSize: 15, fontWeight: 700, color: 'white',
                  background: `linear-gradient(135deg, ${AMBER}, ${ORANGE})`,
                }}
              >
                Открыть урок {c.level}
              </a>
            ))}
          </div>
          <p style={{ fontSize: 14, color: AMBER, fontWeight: 600, marginTop: 22 }}>
            Школа дала чтение — мы даём звук
          </p>
        </section>

      </div>
    </main>
  )
}

function ClipCard({
  clip, index, revealed, played, onReveal, onPlayed,
}: {
  clip: Clip; index: number; revealed: boolean; played: boolean
  onReveal: () => void; onPlayed: () => void
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [failed, setFailed] = useState(false)

  return (
    <article style={{
      background: 'white', borderRadius: 16, padding: '24px 22px', marginBottom: 18,
      border: '1px solid rgba(0,0,0,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
        <span style={{ fontFamily: 'monospace', fontSize: 12, color: MUTED }}>
          {String(index).padStart(2, '0')}
        </span>
        <span style={{
          fontSize: 11, fontWeight: 700, letterSpacing: 1, color: AMBER,
          textTransform: 'uppercase',
        }}>
          Уровень {clip.level}
        </span>
      </div>

      <p style={{ fontSize: 15, color: MUTED, margin: '0 0 16px', lineHeight: 1.5 }}>
        {clip.context}
      </p>

      {failed ? (
        <p style={{ fontSize: 14, color: MUTED, margin: '0 0 16px' }}>
          Аудио сейчас недоступно — текст фрагмента ниже.
        </p>
      ) : (
        <audio
          ref={audioRef}
          controls
          preload="none"
          src={clip.audioSrc}
          onPlay={onPlayed}
          onError={() => setFailed(true)}
          style={{ width: '100%', marginBottom: 16 }}
        />
      )}

      {!revealed ? (
        <button
          onClick={onReveal}
          style={{
            width: '100%', padding: '13px 18px', borderRadius: 10, cursor: 'pointer',
            border: `1.5px solid ${AMBER}`, background: 'transparent',
            color: NAVY, fontSize: 15, fontWeight: 600, fontFamily: 'inherit',
          }}
        >
          {played || failed ? 'Показать текст' : 'Сначала послушай — потом открывай текст'}
        </button>
      ) : (
        <div>
          <p style={{
            fontSize: 18, lineHeight: 1.55, color: NAVY, margin: '0 0 14px',
            padding: '14px 16px', background: CREAM, borderRadius: 10,
            fontStyle: 'italic',
          }}>
            «{clip.transcript}»
          </p>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: INK, margin: '0 0 10px' }}>
            {clip.slip}
          </p>
          <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>
            Урок {clip.level} · «{clip.lessonTitle}»
          </p>
        </div>
      )}
    </article>
  )
}

const eyebrow: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, letterSpacing: 1.5,
  textTransform: 'uppercase', margin: '0 0 12px',
}
