'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { FREE_A1_LESSONS, checkLessonAccess, hasActiveSubscription } from '@/lib/access'
import { MEETING_DISAGREEMENT_LESSON } from '@/lib/entryScenes'
import ReactMarkdown from 'react-markdown'
import SiteFooter from './components/SiteFooter'
import { track, trackOnce } from '@/lib/analytics'

type LessonSummary = {
  id: number
  level: string
  lesson_number: number
  title_en: string
  title_ru: string
  is_published?: boolean
  is_free_teaser?: boolean
}

type Lesson = {
  id: number | string
  level: string
  lesson_number: number
  title_en: string
  title_ru: string
  content: any
  is_free_teaser?: boolean
}

type Message = {
  role: 'user' | 'assistant'
  content: string
}

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

let gAudio: HTMLAudioElement | null = null
let gAudioIdx = -1

// Таймаут на запрос уроков. Если supabase молчит дольше — считаем
// что запрос потерян и пытаемся ещё раз.
const LESSONS_FETCH_TIMEOUT = 5000

// Сколько реплик студента считаем признаком «втянулся, а не заглянул».
// Порог — рабочая гипотеза, будем корректировать по первым данным Метрики.
const LESSON_ENGAGED_TURNS = 4

function HomeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [level, setLevel] = useState('A1')
  const [lessons, setLessons] = useState<LessonSummary[]>([])
  const [lessonsLoaded, setLessonsLoaded] = useState(false)
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [msgs, setMsgs] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [tts, setTts] = useState<'idle' | 'load' | 'play'>('idle')
  const [ttsIdx, setTtsIdx] = useState(-1)
  const endRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const recRef = useRef<any>(null)

  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [hasSubscription, setHasSubscription] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)

  // Флаг автозапуска первого урока — чтобы не запустить дважды
  const [autostartDone, setAutostartDone] = useState(false)

  // Счётчик попыток загрузки уроков. Если запрос завис — увеличиваем
  // счётчик, useEffect перезапускается и делает свежий запрос.
  const [lessonsRetry, setLessonsRetry] = useState(0)

  // ───────── AUTH ─────────
  useEffect(() => {
    let cancelled = false

    const authPromise = supabase.auth.getUser().then(({ data: { user } }) => user)
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500))

    Promise.race([authPromise, timeoutPromise]).then(async (user) => {
      if (cancelled) return
      if (user) {
        setUserEmail(user.email ?? null)
        setUserId(user.id)
        hasActiveSubscription(user.id).then(has => {
          if (!cancelled) setHasSubscription(has)
        })
        supabase.from('admins').select('user_id').eq('user_id', user.id).maybeSingle()
          .then(({ data }) => { if (!cancelled) setIsAdmin(!!data) })
      }
      setAuthChecked(true)
    }).catch(() => {
      if (!cancelled) setAuthChecked(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return
      if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION' || event === 'SIGNED_IN') return

      const newEmail = session?.user?.email ?? null
      const newUserId = session?.user?.id ?? null
      setUserEmail(prev => (prev === newEmail ? prev : newEmail))
      setUserId(prev => (prev === newUserId ? prev : newUserId))

      if (session?.user) {
        hasActiveSubscription(session.user.id).then(has => {
          if (!cancelled) setHasSubscription(has)
        })
        const { data } = await supabase.from('admins').select('user_id').eq('user_id', session.user.id).maybeSingle()
        if (!cancelled) {
          const newAdmin = !!data
          setIsAdmin(prev => (prev === newAdmin ? prev : newAdmin))
        }
      } else {
        setIsAdmin(prev => (prev === false ? prev : false))
        setHasSubscription(prev => (prev === false ? prev : false))
      }
    })

    return () => { cancelled = true; subscription.unsubscribe() }
  }, [])

  // ───────── ЗАГРУЗКА УРОКОВ ─────────
  useEffect(() => {
    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    setLessonsLoaded(false)
    setLessons([])

    if (!authChecked) return

    timeoutId = setTimeout(() => {
      if (cancelled) return
      setLessonsRetry(r => r + 1)
    }, LESSONS_FETCH_TIMEOUT)

    let query = supabase.from('lessons_v2')
      .select('id,level,lesson_number,title_en,title_ru,is_published,is_free_teaser')
      .eq('level', level)
      .order('lesson_number')

    if (level === 'A1' && !hasSubscription && !isAdmin) {
      query = query.lte('lesson_number', FREE_A1_LESSONS)
    }

    query
      .then(({ data }) => {
        if (cancelled) return
        if (timeoutId) { clearTimeout(timeoutId); timeoutId = null }
        setLessons((data as LessonSummary[]) ?? [])
        setLessonsLoaded(true)
      })

    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [level, lessonsRetry, authChecked, hasSubscription, isAdmin])

  useEffect(() => {
    if (!authChecked) return
    setLessonsRetry(r => r + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail, isAdmin, hasSubscription])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible' && !lessonsLoaded) {
        setLessonsRetry(r => r + 1)
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [lessonsLoaded])

  // ───────── АВТОЗАПУСК ПЕРВОГО УРОКА ─────────
  // Если в URL есть ?lesson=1 (приход с лендинга /start) — автоматически
  // открываем первый урок A1. Срабатывает один раз, после загрузки списка уроков.
  useEffect(() => {
    if (autostartDone) return
    const lessonParam = searchParams.get('lesson')
    if (lessonParam === 'meeting-disagreement') {
      const entryLesson: Lesson = {
        id: MEETING_DISAGREEMENT_LESSON.slug,
        level: MEETING_DISAGREEMENT_LESSON.level,
        lesson_number: 0,
        title_en: MEETING_DISAGREEMENT_LESSON.title,
        title_ru: '',
        content: MEETING_DISAGREEMENT_LESSON,
      }
      setAutostartDone(true)
      setLesson(entryLesson)
      setMsgs([])
      kill()
      void chat(entryLesson, [])
      return
    }
    if (!lessonsLoaded) return
    if (lessons.length === 0) return
    const requestedLevel = searchParams.get('level')
    const targetLevel = requestedLevel && LEVELS.includes(requestedLevel) ? requestedLevel : 'A1'
    if (level !== targetLevel) {
      setLevel(targetLevel)
      return
    }
    const targetLesson = requestedLevel
      ? lessons.find((item) => String(item.id) === lessonParam)
      : lessonParam === '1' ? lessons[0] : undefined
    if (!targetLesson) return
    setAutostartDone(true)
    open(targetLesson.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonsLoaded, lessons, level, searchParams, autostartDone])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  useEffect(() => {
    if (!lesson) return
    const userTurns = msgs.filter((message) => message.role === 'user').length
    if (userTurns >= LESSON_ENGAGED_TURNS) {
      trackOnce('lesson_50', `lesson50_${lesson.id}`, { level: lesson.level, lesson_id: lesson.id })
    }
  }, [msgs, lesson])

  useEffect(() => {
    if (taRef.current) {
      taRef.current.style.height = '48px'
      taRef.current.style.height = Math.min(taRef.current.scrollHeight, 160) + 'px'
    }
  }, [input])

  async function open(id: number) {
    const { data } = await supabase.from('lessons_v2').select('*').eq('id', id).single()
    if (!data) return
    const lessonData = data as Lesson
    const access = isAdmin || hasSubscription
      ? { allowed: true }
      : await checkLessonAccess(userId, {
        id: Number(lessonData.id),
        level: lessonData.level,
        lesson_number: lessonData.lesson_number,
        is_free_teaser: lessonData.is_free_teaser,
      })
    if (!access.allowed) {
      router.push(userEmail ? '/pricing' : '/auth?return=/pricing')
      return
    }
    track('lesson_start', { level: lessonData.level, lesson_id: lessonData.id })
    setLesson(lessonData)
    setMsgs([])
    kill()
    await chat(lessonData, [])
  }

  async function chat(l: Lesson, h: Message[], u?: string) {
    setLoading(true)
    const m = u ? [...h, { role: 'user' as const, content: u }] : h
    if (u) { setMsgs(m); setInput('') }
    try {
      const r = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lesson: l.content, lessonTitle: l.title_en, lessonLevel: l.level, lessonNumber: l.lesson_number, entryScene: l.content?.slug === 'meeting-disagreement' ? 'meeting-disagreement' : undefined, messages: m })
      })
      if (!r.ok) throw 0
      const rd = r.body?.getReader(), dc = new TextDecoder()
      let txt = ''
      setMsgs([...m, { role: 'assistant', content: '' }])
      while (rd) {
        const { done, value } = await rd.read()
        if (done) break
        txt += dc.decode(value, { stream: true })
        setMsgs([...m, { role: 'assistant', content: txt }])
      }
    } catch { setMsgs([...m, { role: 'assistant', content: 'Ошибка. Попробуйте ещё раз.' }]) }
    setLoading(false)
  }

  function send() {
    if (!input.trim() || !lesson || loading) return
    chat(lesson, msgs, input.trim())
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  function kill() {
    if (gAudio) { gAudio.pause(); gAudio.src = ''; gAudio = null }
    gAudioIdx = -1; setTts('idle'); setTtsIdx(-1)
  }

  async function speak(text: string, idx: number) {
    if (gAudioIdx === idx && gAudio) {
      if (tts === 'play') { gAudio.pause(); setTts('idle'); return }
      if (tts === 'idle') { gAudio.play(); setTts('play'); return }
    }
    kill(); setTts('load'); setTtsIdx(idx); gAudioIdx = idx
    try {
      const r = await fetch('/api/tts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      })
      if (!r.ok) throw 0
      const b = await r.blob(), u = URL.createObjectURL(b), a = new Audio(u)
      gAudio = a
      a.onended = () => kill()
      a.onerror = () => kill()
      a.play(); setTts('play')
    } catch { kill() }
  }

  function mic() {
    if (recording) {
      recRef.current?.stop()
      setRecording(false)
      return
    }
    const S = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!S) { alert('Браузер не поддерживает речь'); return }
    const r = new S()
    r.lang = 'en-US'
    r.continuous = false
    r.interimResults = false
    r.maxAlternatives = 1

    r.onresult = (e: any) => {
      if (e.results.length > 0 && e.results[0].length > 0) {
        const transcript = e.results[0][0].transcript
        setInput(prev => prev ? prev + ' ' + transcript : transcript)
      }
    }
    r.onend = () => { setRecording(false) }
    r.onerror = () => { setRecording(false) }

    recRef.current = r
    r.start()
    setRecording(true)
  }

  function back() { kill(); setLesson(null); setMsgs([]) }

  async function logout() {
    await supabase.auth.signOut()
    setLesson(null)
    setMsgs([])
  }

  if (lesson) return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ padding: '12px 16px', background: 'white', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button onClick={back} style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: '14px' }}>← Back</button>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '18px', color: '#1a1a2e' }}>
            {lesson.level}-{String(lesson.lesson_number).padStart(2, '0')}: {lesson.title_en}
          </div>
          <div style={{ fontSize: '13px', color: '#999' }}>{lesson.title_ru}</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 16px' }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: '12px' }}>
            {m.role === 'assistant' ? (
              <div style={{ background: 'white', borderLeft: '3px solid #f59e0b', borderRadius: '0 12px 12px 0', padding: '16px 20px', maxWidth: '85%', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', position: 'relative' }}>
                <ReactMarkdown components={{ p: ({children}) => <p style={{marginBottom:"8px"}}>{children}</p>, strong: ({children}) => <strong style={{color:"#f59e0b"}}>{children}</strong> }}>{m.content.replace(/\n/g, "  \n")}</ReactMarkdown>
                {m.content.length > 10 && (
                  <button onClick={() => speak(m.content, i)} style={{
                    marginTop: '8px', padding: '6px 14px', borderRadius: '16px', border: 'none', cursor: 'pointer', fontSize: '13px',
                    background: ttsIdx === i && tts === 'load' ? '#FEF3C7' : ttsIdx === i && tts === 'play' ? '#f59e0b' : '#f3f4f6',
                    color: ttsIdx === i && tts === 'play' ? 'white' : '#555'
                  }}>
                    {ttsIdx === i && tts === 'load' ? '⏳ Загрузка...' : ttsIdx === i && tts === 'play' ? '⏸ Пауза' : '🔊 Слушать'}
                  </button>
                )}
              </div>
            ) : (
              <div style={{ background: '#f59e0b', color: 'white', borderRadius: '12px 0 0 12px', padding: '16px 20px', maxWidth: '85%' }}>
                <p style={{ margin: 0 }}>{m.content}</p>
              </div>
            )}
          </div>
        ))}
        {loading && msgs[msgs.length - 1]?.role !== 'assistant' && (
          <div style={{ padding: '16px 20px', background: 'white', borderLeft: '3px solid #f59e0b', borderRadius: '0 12px 12px 0', maxWidth: '85%' }}>
            <span style={{ animation: 'pulse 1s infinite' }}>...</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div style={{ borderTop: '1px solid #eee', background: 'white', padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
          <textarea ref={taRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKey}
            placeholder="Type here..." rows={1}
            style={{ flex: 1, padding: '12px 16px', border: '1px solid #ddd', borderRadius: '12px', fontSize: '14px', resize: 'none', minHeight: '48px', maxHeight: '160px', overflowY: 'auto', outline: 'none', fontFamily: 'inherit' }}
          />
          <button onClick={mic} style={{
            width: '44px', height: '44px', borderRadius: '50%', border: 'none', cursor: 'pointer', fontSize: '20px',
            background: recording ? '#ED2939' : '#f3f4f6', color: recording ? 'white' : '#555'
          }}>🎤</button>
          <button onClick={send} disabled={!input.trim() || loading} style={{
            width: '44px', height: '44px', borderRadius: '50%', border: 'none', cursor: 'pointer', fontSize: '18px',
            background: '#f59e0b', color: 'white', opacity: !input.trim() || loading ? 0.3 : 1
          }}>▲</button>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px', marginBottom: '24px', minHeight: '32px' }}>
        {authChecked && userEmail ? (
          <>
            {isAdmin && (
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#f59e0b', background: '#FEF3C7', padding: '4px 10px', borderRadius: '12px', letterSpacing: '0.5px' }}>
                ADMIN
              </span>
            )}
            <span style={{ fontSize: '13px', color: '#888' }}>{userEmail}</span>
            <button onClick={logout} style={{
              background: 'none', border: '1px solid #ddd', color: '#666', cursor: 'pointer',
              fontSize: '13px', padding: '6px 12px', borderRadius: '12px', fontFamily: 'inherit'
            }}>
              Выйти
            </button>
          </>
        ) : authChecked ? (
          <button onClick={() => router.push('/auth')} style={{
            background: '#f59e0b', border: 'none', color: 'white', cursor: 'pointer',
            fontSize: '13px', fontWeight: 600, padding: '8px 16px', borderRadius: '12px', fontFamily: 'inherit'
          }}>
            Войти
          </button>
        ) : null}
      </div>

      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '36px', fontWeight: 700, color: '#1a1a2e', marginBottom: '10px' }}>Everyday Fluency</h1>
        <p style={{ color: '#f59e0b', fontSize: '15px', fontWeight: 600, letterSpacing: '0.3px', marginBottom: '20px' }}>
          Школа дала чтение — мы даём звук
        </p>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: 700, color: '#1a1a2e', lineHeight: 1.25, marginBottom: '14px', maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto' }}>
          Ты знаешь английский глазами.<br />Начни узнавать его на слух — и в речи.
        </h2>
        <p style={{ color: '#555', fontSize: '16px', lineHeight: 1.55, maxWidth: '560px', margin: '0 auto 8px' }}>
          Читаешь, знаешь грамматику, работаешь на английском. Но стоит людям заговорить в живом темпе —
          знакомый язык вдруг труднее. А когда отвечать твоя очередь, нужная фраза приходит слишком поздно
          или звучит как из учебника.
        </p>
        <p style={{ color: '#888', fontSize: '15px', lineHeight: 1.5, maxWidth: '560px', margin: '0 auto' }}>
          «Я ведь это знаю. Почему не услышал?» · «Я ведь знаю, как сказать. Почему фраза не пришла?» —
          Everyday Fluency тренирует именно этот разрыв. Живой диалог → разбор → второе прослушивание →
          выражения, которые ты забираешь в свою речь.
        </p>
        <p style={{ color: '#aaa', fontSize: '13px', marginTop: '18px' }}>
          Выбери урок своего уровня ↓
        </p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '32px', flexWrap: 'wrap' }}>
        {LEVELS.map(l => (
          <button key={l} onClick={() => setLevel(l)} style={{
            padding: '8px 20px', borderRadius: '20px', border: level === l ? '2px solid #f59e0b' : '2px solid transparent', cursor: 'pointer', fontWeight: 600, fontSize: '14px',
            background: level === l ? '#f59e0b' : 'white', color: level === l ? 'white' : '#555'
          }}>{l}</button>
        ))}
      </div>

      <div>
        {!lessonsLoaded ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', color: '#999' }}>
            <div style={{ display: 'inline-flex', gap: '6px' }}>
              {[0, 1, 2].map(n => (
                <span key={n} style={{
                  width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b',
                  animation: 'pulse 1.4s ease-in-out infinite',
                  animationDelay: `${n * 0.16}s`,
                }} />
              ))}
            </div>
          </div>
   ) : lessons.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 24px' }}>
            {level === 'A1' ? (
              <p style={{ color: '#999' }}>Уроки уровня {level} скоро появятся.</p>
            ) : !userEmail ? (
              <div style={{
                background: 'white', border: '1px solid #f59e0b30', borderRadius: '16px',
                padding: '32px 24px', maxWidth: '480px', margin: '0 auto',
                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.08)'
              }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔓</div>
                <h2 style={{
                  fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700,
                  color: '#1a1a2e', marginBottom: '12px'
                }}>
                  Все уровни от A2 до C2 — по подписке
                </h2>
                <p style={{ color: '#666', fontSize: '15px', marginBottom: '24px', lineHeight: 1.5 }}>
                  150 уроков-диалогов. Один тариф открывает все уровни. Войдите, чтобы оформить подписку.
                </p>
                <button onClick={() => router.push('/auth')} style={{
                  background: '#f59e0b', border: 'none', color: 'white', cursor: 'pointer',
                  fontSize: '15px', fontWeight: 700, padding: '14px 32px',
                  borderRadius: '12px', fontFamily: 'inherit',
                  boxShadow: '0 4px 12px rgba(245, 158, 11, 0.25)'
                }}>
                  Войти и подписаться →
                </button>
              </div>
            ) : (
              <div style={{
                background: 'white', border: '1px solid #f59e0b30', borderRadius: '16px',
                padding: '32px 24px', maxWidth: '480px', margin: '0 auto',
                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.08)'
              }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔓</div>
                <h2 style={{
                  fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700,
                  color: '#1a1a2e', marginBottom: '12px'
                }}>
                  Один урок — это проба. Разница начинается на объёме
                </h2>
                <p style={{ color: '#666', fontSize: '15px', marginBottom: '20px', lineHeight: 1.5 }}>
                  Знакомое перестаёт проскакивать мимо не за один диалог, а когда таких диалогов
                  набирается несколько десятков. Дальше — 30 уроков на твоём уровне и все остальные
                  уровни в придачу: рабочие разговоры, споры, неловкие паузы, живой темп.
                </p>

                <div style={{
                  background: '#FEF3C7', borderRadius: '10px', padding: '12px 16px',
                  marginBottom: '20px', fontSize: '14px', color: '#92400e'
                }}>
                  🎁 <strong>Старт-оффер до 31 августа:</strong> год за 4 990 ₽ вместо 7 990 ₽
                </div>

                <button onClick={() => router.push('/pricing')} style={{
                  background: '#f59e0b', border: 'none', color: 'white', cursor: 'pointer',
                  fontSize: '15px', fontWeight: 700, padding: '14px 32px',
                  borderRadius: '12px', fontFamily: 'inherit', width: '100%',
                  boxShadow: '0 4px 12px rgba(245, 158, 11, 0.25)'
                }}>
                  Выбрать тариф →
                </button>

                <p style={{ fontSize: '13px', color: '#999', marginTop: '14px' }}>
                  От 990 ₽/мес · Год 7 990 ₽
                </p>

                <p style={{ fontSize: '12px', color: '#bbb', marginTop: '8px', fontStyle: 'italic' }}>
                  Один тариф — все уровни, без доплат за переход выше
                </p>
              </div>
            )}
          </div>
        ) : (
          lessons.map(ls => {
            const teaserOpen = ls.level === 'A1' || !!ls.is_free_teaser || hasSubscription || isAdmin
            return (
            <button key={ls.id} onClick={() => open(ls.id)} style={{
              display: 'block', width: '100%', textAlign: 'left', padding: '16px 20px', background: 'white', borderRadius: '12px', border: teaserOpen ? '1px solid #f59e0b55' : '1px solid #eee', cursor: 'pointer', marginBottom: '8px', fontFamily: 'inherit', opacity: teaserOpen ? 1 : 0.78
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#999' }}>{String(ls.lesson_number).padStart(2, '0')}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {ls.title_en}
                    {ls.is_free_teaser && !hasSubscription && !isAdmin && (
                      <span style={{ fontSize: '10px', fontWeight: 700, color: '#92400e', background: '#fef3c7', padding: '3px 8px', borderRadius: '8px', letterSpacing: '0.3px' }}>
                        Бесплатный урок
                      </span>
                    )}
                    {!teaserOpen && (
                      <span style={{ fontSize: '12px', color: '#999' }}>🔒</span>
                    )}
                    {isAdmin && ls.is_published === false && (
                      <span style={{ fontSize: '10px', fontWeight: 600, color: '#999', background: '#f3f4f6', padding: '2px 8px', borderRadius: '8px', letterSpacing: '0.5px' }}>
                        DRAFT
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '13px', color: '#999', marginTop: '2px' }}>{ls.title_ru}</div>
                </div>
              </div>
            </button>
          )})
        )}
      </div>
      <SiteFooter />
    </div>
  )
}

export default function Home() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'white' }} />}>
      <HomeContent />
    </Suspense>
  )
}
