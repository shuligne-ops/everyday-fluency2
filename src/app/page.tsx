'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import ReactMarkdown from 'react-markdown'

type LessonSummary = {
  id: number
  level: string
  lesson_number: number
  title_en: string
  title_ru: string
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

function normalizeMd(t: string) {
  return t.replace(/\*\*\s+/g, '**').replace(/\s+\*\*/g, '**')
}

let gAudio: HTMLAudioElement | null = null
let gAudioIdx = -1

export default function Home() {
  const [level, setLevel] = useState('A1')
  const [lessons, setLessons] = useState<LessonSummary[]>([])
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
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const finalTranscriptRef = useRef<string>('')
  const baseInputRef = useRef<string>('')

  useEffect(() => {
    supabase.from("lessons_v2").select('id,level,lesson_number,title_en,title_ru')
      .eq('level', level).order('lesson_number')
      .then(({ data }) => { if (data) setLessons(data as LessonSummary[]) })
  }, [level])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  useEffect(() => {
    if (taRef.current) {
      taRef.current.style.height = '48px'
      taRef.current.style.height = Math.min(taRef.current.scrollHeight, 160) + 'px'
    }
  }, [input])

  async function open(id: number) {
    const { data } = await supabase.from("lessons_v2").select('*').eq('id', id).single()
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

  function stopMic() {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
    try { recRef.current?.stop() } catch {}
    setRecording(false)
  }

  function resetSilenceTimer() {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    silenceTimerRef.current = setTimeout(() => {
      try { recRef.current?.stop() } catch {}
    }, 10000)
  }

  function mic() {
    if (recording) {
      stopMic()
      return
    }
    const S = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!S) { alert('Браузер не поддерживает речь. Используйте Chrome.'); return }
    const r = new S()
    r.lang = 'en-US'
    r.continuous = true
    r.interimResults = true
    r.maxAlternatives = 1

    baseInputRef.current = input ? input + ' ' : ''
    finalTranscriptRef.current = ''

    r.onstart = () => {
      setRecording(true)
      resetSilenceTimer()
    }

    r.onresult = (e: any) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) {
          finalTranscriptRef.current += t + ' '
        } else {
          interim += t
        }
      }
      setInput(baseInputRef.current + finalTranscriptRef.current + interim)
      resetSilenceTimer()
    }

    r.onend = () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current)
        silenceTimerRef.current = null
      }
      setRecording(false)
      setInput((baseInputRef.current + finalTranscriptRef.current).trim())
    }

    r.onerror = (e: any) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        console.error('Speech recognition error:', e.error)
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current)
        silenceTimerRef.current = null
      }
      setRecording(false)
    }

    recRef.current = r
    try {
      r.start()
    } catch (err) {
      console.error('Failed to start recognition:', err)
      setRecording(false)
    }
  }

  function back() { kill(); stopMic(); setLesson(null); setMsgs([]) }

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
            placeholder={recording ? 'Слушаю…' : 'Type here...'} rows={1}
            style={{ flex: 1, padding: '12px 16px', border: recording ? '1px solid #ED2939' : '1px solid #ddd', borderRadius: '12px', fontSize: '14px', resize: 'none', minHeight: '48px', maxHeight: '160px', overflowY: 'auto', outline: 'none', fontFamily: 'inherit' }}
          />
          <button onClick={mic} title={recording ? 'Остановить запись' : 'Говорить'} style={{
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
        {lessons.map(ls => (
          <button key={ls.id} onClick={() => open(ls.id)} style={{
            display: 'block', width: '100%', textAlign: 'left', padding: '16px 20px', background: 'white', borderRadius: '12px', border: 'none', cursor: 'pointer', marginBottom: '8px', fontFamily: 'inherit'
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
              <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#999' }}>{String(ls.lesson_number).padStart(2, '0')}</span>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: '#1a1a2e' }}>{ls.title_en}</div>
                <div style={{ fontSize: '13px', color: '#999', marginTop: '2px' }}>{ls.title_ru}</div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
