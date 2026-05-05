'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ReactMarkdown from 'react-markdown'
import SiteFooter from './components/SiteFooter'

type LessonSummary = {
  id: number
  level: string
  lesson_number: number
  title_en: string
  title_ru: string
  is_published?: boolean
}

type Lesson = {
  id: number
  level: string
  lesson_number: number
  title_en: string
  title_ru: string
  content: any
}

type Message = {
  role: 'user' | 'assistant'
  content: string
}

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

let gAudio: HTMLAudioElement | null = null
let gAudioIdx = -1

export default function Home() {
  const router = useRouter()
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

  // Auth state — догоняется в фоне, не блокирует контент
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)

  // ───────── AUTH (фоновая, с таймаутом) ─────────
  useEffect(() => {
    let cancelled = false

    // getUser с принудительным таймаутом 1.5 сек.
    const authPromise = supabase.auth.getUser().then(({ data: { user } }) => user)
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500))

    Promise.race([authPromise, timeoutPromise]).then(async (user) => {
      if (cancelled) return
      if (user) {
        setUserEmail(user.email ?? null)
        supabase.from('admins').select('user_id').eq('user_id', user.id).maybeSingle()
          .then(({ data }) => { if (!cancelled) setIsAdmin(!!data) })
      }
      setAuthChecked(true)
    }).catch(() => {
      if (!cancelled) setAuthChecked(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return
      // Игнорируем TOKEN_REFRESHED и INITIAL_SESSION — они срабатывают при каждом
      // возврате на вкладку и не несут изменения auth-состояния. Обрабатываем
      // только реальные смены: SIGNED_IN, SIGNED_OUT, USER_UPDATED.
      if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') return

      const newEmail = session?.user?.email ?? null
      setUserEmail(prev => (prev === newEmail ? prev : newEmail))

      if (session?.user) {
        const { data } = await supabase.from('admins').select('user_id').eq('user_id', session.user.id).maybeSingle()
        if (!cancelled) {
          const newAdmin = !!data
          setIsAdmin(prev => (prev === newAdmin ? prev : newAdmin))
        }
      } else {
        setIsAdmin(prev => (prev === false ? prev : false))
      }
    })

    return () => { cancelled = true; subscription.unsubscribe() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ───────── ЗАГРУЗКА УРОКОВ ПРИ СМЕНЕ УРОВНЯ ─────────
  // Зависит только от level. RLS сама определяет видимость по JWT в заголовке
  // запроса (supabase-клиент автоматически прикладывает свежий токен).
  useEffect(() => {
    let cancelled = false
    setLessonsLoaded(false)
    setLessons([])
    supabase.from('lessons_v2')
      .select('id,level,lesson_number,title_en,title_ru,is_published')
      .eq('level', level)
      .order('lesson_number')
      .then(({ data }) => {
        if (cancelled) return
        setLessons((data as LessonSummary[]) ?? [])
        setLessonsLoaded(true)
      })
    return () => { cancelled = true }
  }, [level])

  // ───────── ПЕРЕЗАГРУЗКА ПРИ СМЕНЕ ВХОДА (login/logout) ─────────
  // Не сбрасывает lessonsLoaded — плавная замена списка без отката в loading.
  useEffect(() => {
    if (!authChecked) return
    let cancelled = false
    supabase.from('lessons_v2')
      .select('id,level,lesson_number,title_en,title_ru,is_published')
      .eq('level', level)
      .order('lesson_number')
      .then(({ data }) => {
        if (cancelled) return
        setLessons((data as LessonSummary[]) ?? [])
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail, isAdmin])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  useEffect(() => {
    if (taRef.current) {
      taRef.current.style.height = '48px'
      taRef.current.style.height = Math.min(taRef.current.scrollHeight, 160) + 'px'
    }
  }, [input])

  async function open(id: number) {
    const { data } = await supabase.from('lessons_v2').select('*').eq('id', id).single()
    if (!data) return
    setLesson(data as Lesson)
    setMsgs([])
    kill()
    await chat(data as Lesson, [])
  }

  async function chat(l: Lesson, h: Message[], u?: string) {
    setLoading(true)
    const m = u ? [...h, { role: 'user' as const, content: u }] : h
    if (u) { setMsgs(m); setInput('') }
    try {
      const r = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lesson: l.content, lessonTitle: l.title_en, lessonLevel: l.level, lessonNumber: l.lesson_number, messages: m })
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

  // ───────── LESSON VIEW ─────────
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

  // ───────── HOME / LESSON LIST ─────────
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 16px' }}>
      {/* Top bar with auth state */}
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

      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '36px', fontWeight: 700, color: '#1a1a2e', marginBottom: '8px' }}>Everyday Fluency</h1>
        <p style={{ color: '#888', fontSize: '18px' }}>Разговорный английский каждый день</p>
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
          <div style={{ textAlign: 'center', padding: '48px 24px', color: '#999' }}>
            {level === 'A1' ? (
              <>Уроки уровня {level} скоро появятся.</>
            ) : !userEmail ? (
              <>
                <p style={{ marginBottom: '16px' }}>Уровень {level} — для подписчиков.</p>
                <button onClick={() => router.push('/auth')} style={{
                  background: '#f59e0b', border: 'none', color: 'white', cursor: 'pointer',
                  fontSize: '14px', fontWeight: 600, padding: '10px 20px', borderRadius: '12px', fontFamily: 'inherit'
                }}>
                  Войти, чтобы продолжить
                </button>
              </>
            ) : (
              <>
                <p style={{ marginBottom: '8px' }}>Уровень {level} скоро откроется.</p>
                <p style={{ fontSize: '13px' }}>Подписка на этот уровень ещё не активна.</p>
              </>
            )}
          </div>
        ) : (
          lessons.map(ls => (
            <button key={ls.id} onClick={() => open(ls.id)} style={{
              display: 'block', width: '100%', textAlign: 'left', padding: '16px 20px', background: 'white', borderRadius: '12px', border: 'none', cursor: 'pointer', marginBottom: '8px', fontFamily: 'inherit'
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#999' }}>{String(ls.lesson_number).padStart(2, '0')}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {ls.title_en}
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
          ))
        )}
      </div>
      <SiteFooter />
    </div>
  )
}
