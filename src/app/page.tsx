'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import ReactMarkdown from 'react-markdown'

type LessonSummary = {
  id: number
  level: string
  lesson_number: number
  title_fr: string
  title_ru: string
}

type Lesson = {
  id: number
  level: string
  lesson_number: number
  title_fr: string
  title_ru: string
  content: any
}

type Message = {
  role: 'user' | 'assistant'
  content: string
}

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

function normalizeMarkdown(text: string): string {
  return text.replace(/\*\*\s+/g, '**').replace(/\s+\*\*/g, '**')
}

// Global audio element - survives React re-renders
let globalAudio: HTMLAudioElement | null = null

export default function Home() {
  const [selectedLevel, setSelectedLevel] = useState<string>('A1')
  const [lessons, setLessons] = useState<LessonSummary[]>([])
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [ttsState, setTtsState] = useState<'idle' | 'loading' | 'playing'>('idle')
  const [playingIdx, setPlayingIdx] = useState<number>(-1)

  const chatEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    async function fetchLessons() {
      const { data } = await supabase
        .from('lessons')
        .select('id, level, lesson_number, title_fr, title_ru')
        .eq('level', selectedLevel)
        .order('lesson_number')
      if (data) setLessons(data as LessonSummary[])
    }
    fetchLessons()
  }, [selectedLevel])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '48px'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px'
    }
  }, [inputText])

  async function startLesson(lessonId: number) {
    const { data } = await supabase
      .from('lessons')
      .select('*')
      .eq('id', lessonId)
      .single()
    if (data) {
      setCurrentLesson(data as Lesson)
      setMessages([])
      killAudio()
      await sendToAPI(data as Lesson, [])
    }
  }

  async function sendToAPI(lesson: Lesson, history: Message[], userMsg?: string) {
    setIsLoading(true)
    const msgs = userMsg ? [...history, { role: 'user' as const, content: userMsg }] : history
    if (userMsg) { setMessages(msgs); setInputText('') }
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lesson: lesson.content,
          lessonTitle: lesson.title_fr,
          lessonLevel: lesson.level,
          lessonNumber: lesson.lesson_number,
          messages: msgs,
        }),
      })
      if (!res.ok) throw new Error('API error')
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let text = ''
      setMessages([...msgs, { role: 'assistant', content: '' }])
      while (reader) {
        const { done, value } = await reader.read()
        if (done) break
        text += decoder.decode(value, { stream: true })
        setMessages([...msgs, { role: 'assistant', content: text }])
      }
    } catch {
      setMessages([...msgs, { role: 'assistant', content: 'Ошибка подключения. Попробуйте ещё раз.' }])
    }
    setIsLoading(false)
  }

  function handleSend() {
    if (!inputText.trim() || !currentLesson || isLoading) return
    sendToAPI(currentLesson, messages, inputText.trim())
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  function killAudio() {
    if (globalAudio) {
      globalAudio.pause()
      globalAudio.src = ''
      globalAudio = null
    }
    setTtsState('idle')
    setPlayingIdx(-1)
  }

  async function handleTTS(text: string, idx: number) {
    // Same message playing — toggle pause/play
    if (playingIdx === idx && globalAudio) {
      if (ttsState === 'playing') {
        globalAudio.pause()
        setTtsState('idle')
        return
      }
      if (ttsState === 'idle' && globalAudio.src) {
        globalAudio.play()
        setTtsState('playing')
        return
      }
    }

    killAudio()
    setTtsState('loading')
    setPlayingIdx(idx)

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) throw new Error('TTS fail')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      globalAudio = audio
      audio.onended = () => killAudio()
      audio.onerror = () => killAudio()
      audio.play()
      setTtsState('playing')
    } catch {
      killAudio()
    }
  }

  function toggleRecording() {
    if (isRecording) { recognitionRef.current?.stop(); setIsRecording(false); return }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { alert('Браузер не поддерживает распознавание речи'); return }
    const rec = new SR()
    rec.lang = 'fr-FR'
    rec.continuous = true
    rec.interimResults = true
    let timer: any
    rec.onresult = (e: any) => {
      clearTimeout(timer)
      let t = ''
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript
      setInputText(t)
      timer = setTimeout(() => { rec.stop(); setIsRecording(false) }, 4000)
    }
    rec.onend = () => { clearTimeout(timer); setIsRecording(false) }
    rec.onerror = () => { clearTimeout(timer); setIsRecording(false) }
    recognitionRef.current = rec
    rec.start()
    setIsRecording(true)
  }

  function backToLessons() { killAudio(); setCurrentLesson(null); setMessages([]) }

  // ===== LESSON VIEW =====
  if (currentLesson) {
    return (
      <div className="flex flex-col h-screen max-w-3xl mx-auto">
        <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100">
          <button onClick={backToLessons} className="text-gray-400 hover:text-gray-600">← Retour</button>
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-lg font-semibold truncate" style={{ color: '#1a1a2e' }}>
              {currentLesson.level}-{String(currentLesson.lesson_number).padStart(2, '0')}: {currentLesson.title_fr}
            </h2>
            <p className="text-sm text-gray-400">{currentLesson.title_ru}</p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={msg.role === 'assistant' ? '' : 'flex justify-end'}>
              {msg.role === 'assistant' ? (
                <div className="chat-bubble-ai" style={{ position: 'relative' }}>
                  <ReactMarkdown>{normalizeMarkdown(msg.content)}</ReactMarkdown>
                  {msg.content.length > 10 && (
                    <button
                      onClick={() => handleTTS(msg.content, i)}
                      style={{
                        position: 'absolute',
                        right: '-44px',
                        top: '8px',
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '18px',
                        background: playingIdx === i && ttsState === 'loading' ? '#FEF3C7'
                          : playingIdx === i && ttsState === 'playing' ? '#002395'
                          : '#f3f4f6',
                        color: playingIdx === i && ttsState === 'playing' ? 'white' : '#666',
                      }}
                    >
                      {playingIdx === i && ttsState === 'loading' ? '⏳'
                        : playingIdx === i && ttsState === 'playing' ? '⏸'
                        : '🔊'}
                    </button>
                  )}
                </div>
              ) : (
                <div className="chat-bubble-user"><p>{msg.content}</p></div>
              )}
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="chat-bubble-ai">
              <span className="animate-pulse">...</span>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="border-t border-gray-100 bg-white px-4 py-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Écrivez ici..."
              className="input-expand flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none text-sm"
              rows={1}
            />
            <button
              onClick={toggleRecording}
              style={{
                padding: '12px',
                borderRadius: '50%',
                border: 'none',
                cursor: 'pointer',
                background: isRecording ? '#ED2939' : '#f3f4f6',
                color: isRecording ? 'white' : '#666',
              }}
            >
              🎤
            </button>
            <button
              onClick={handleSend}
              disabled={!inputText.trim() || isLoading}
              style={{
                padding: '12px',
                borderRadius: '50%',
                border: 'none',
                cursor: 'pointer',
                background: '#002395',
                color: 'white',
                opacity: !inputText.trim() || isLoading ? 0.3 : 1,
              }}
            >
              ▲
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ===== MAIN SCREEN =====
  return (
    <div className="min-h-screen max-w-3xl mx-auto px-4 py-8">
      <div className="text-center mb-10">
        <h1 className="font-display text-4xl font-bold mb-2" style={{ color: '#1a1a2e' }}>Français au Quotidien</h1>
        <p className="text-gray-500 text-lg">Разговорный французский каждый день</p>
      </div>
      <div className="flex justify-center gap-2 mb-8 flex-wrap">
        {LEVELS.map((level) => (
          <button
            key={level}
            onClick={() => setSelectedLevel(level)}
            className={`level-btn px-5 py-2 rounded-full text-sm font-semibold ${
              selectedLevel === level ? 'active' : 'bg-white text-gray-600'
            }`}
          >
            {level}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {lessons.map((lesson) => (
          <button
            key={lesson.id}
            onClick={() => startLesson(lesson.id)}
            className="w-full text-left px-5 py-4 bg-white rounded-xl hover:shadow-md transition-all"
          >
            <div className="flex items-baseline gap-3">
              <span className="text-xs font-mono text-gray-400">{String(lesson.lesson_number).padStart(2, '0')}</span>
              <div>
                <p className="font-display font-semibold" style={{ color: '#1a1a2e' }}>{lesson.title_fr}</p>
                <p className="text-sm text-gray-400 mt-0.5">{lesson.title_ru}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
