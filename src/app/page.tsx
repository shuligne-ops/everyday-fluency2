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
  return text
    .replace(/\*\*\s+/g, '**')
    .replace(/\s+\*\*/g, '**')
}

export default function Home() {
  const [selectedLevel, setSelectedLevel] = useState<string>('A1')
  const [lessons, setLessons] = useState<LessonSummary[]>([])
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [ttsState, setTtsState] = useState<'idle' | 'loading' | 'playing'>('idle')
  const [playingIndex, setPlayingIndex] = useState<number | null>(null)

  const chatEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<any>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    async function fetchLessons() {
      const { data } = await supabase
        .from('lessons')
        .select('id, level, lesson_number, title_fr, title_ru')
        .eq('level', selectedLevel)
        .order('lesson_number')
      if (data) setLessons(data)
    }
    fetchLessons()
  }, [selectedLevel])

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
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
      setCurrentLesson(data)
      setMessages([])
      stopAudio()
      await sendToAPI(data, [])
    }
  }

  async function sendToAPI(lesson: Lesson, chatHistory: Message[], userMessage?: string) {
    setIsLoading(true)
    const newMessages = userMessage
      ? [...chatHistory, { role: 'user' as const, content: userMessage }]
      : chatHistory
    if (userMessage) {
      setMessages(newMessages)
      setInputText('')
    }
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lesson: lesson.content,
          lessonTitle: lesson.title_fr,
          lessonLevel: lesson.level,
          lessonNumber: lesson.lesson_number,
          messages: newMessages,
        }),
      })
      if (!response.ok) throw new Error('API error')
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let assistantMessage = ''
      setMessages([...newMessages, { role: 'assistant', content: '' }])
      while (reader) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        assistantMessage += chunk
        setMessages([...newMessages, { role: 'assistant', content: assistantMessage }])
      }
    } catch (err) {
      console.error('Chat error:', err)
      setMessages([...newMessages, { role: 'assistant', content: 'Ошибка подключения. Попробуйте ещё раз.' }])
    }
    setIsLoading(false)
  }

  function handleSend() {
    if (!inputText.trim() || !currentLesson || isLoading) return
    sendToAPI(currentLesson, messages, inputText.trim())
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function stopAudio() {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      URL.revokeObjectURL(audioRef.current.src)
      audioRef.current = null
    }
    setTtsState('idle')
    setPlayingIndex(null)
  }

  async function toggleAudio(text: string, index: number) {
    if (playingIndex === index && audioRef.current) {
      if (ttsState === 'playing') {
        audioRef.current.pause()
        setTtsState('idle')
        return
      } else if (audioRef.current.paused && audioRef.current.currentTime > 0) {
        audioRef.current.play()
        setTtsState('playing')
        return
      }
    }
    stopAudio()
    setTtsState('loading')
    setPlayingIndex(index)
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!response.ok) throw new Error('TTS error')
      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)
      const audio = new Audio(audioUrl)
      audio.onended = () => stopAudio()
      audio.onerror = () => stopAudio()
      audioRef.current = audio
      await audio.play()
      setTtsState('playing')
    } catch (err) {
      console.error('TTS error:', err)
      stopAudio()
    }
  }

  function toggleRecording() {
    if (isRecording) {
      recognitionRef.current?.stop()
      setIsRecording(false)
      return
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Ваш браузер не поддерживает распознавание речи')
      return
    }
    const recognition = new SpeechRecognition()
    recognition.lang = 'fr-FR'
    recognition.continuous = true
    recognition.interimResults = true
    let silenceTimer: NodeJS.Timeout
    recognition.onresult = (event: any) => {
      clearTimeout(silenceTimer)
      let transcript = ''
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }
      setInputText(transcript)
      silenceTimer = setTimeout(() => {
        recognition.stop()
        setIsRecording(false)
      }, 4000)
    }
    recognition.onend = () => { clearTimeout(silenceTimer); setIsRecording(false) }
    recognition.onerror = () => { clearTimeout(silenceTimer); setIsRecording(false) }
    recognitionRef.current = recognition
    recognition.start()
    setIsRecording(true)
  }

  function backToLessons() {
    stopAudio()
    setCurrentLesson(null)
    setMessages([])
  }

  if (currentLesson) {
    return (
      <div className="flex flex-col h-screen max-w-3xl mx-auto">
        <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100">
          <button onClick={backToLessons} className="text-gray-400 hover:text-gray-600 transition-colors">
            ← Retour
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-lg font-semibold text-french-dark truncate">
              {currentLesson.level}-{String(currentLesson.lesson_number).padStart(2, '0')}: {currentLesson.title_fr}
            </h2>
            <p className="text-sm text-gray-400">{currentLesson.title_ru}</p>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-2">
          {messages.map((msg, i) => (
            <div key={i} className={msg.role === 'assistant' ? 'flex' : 'flex justify-end'}>
              <div className={msg.role === 'assistant' ? 'chat-bubble-ai relative group' : 'chat-bubble-user'}>
                {msg.role === 'assistant' ? (
                  <>
                    <ReactMarkdown>{normalizeMarkdown(msg.content)}</ReactMarkdown>
                    {msg.content.length > 0 && (
                      <button
                        onClick={() => toggleAudio(msg.content, i)}
                        className={`absolute -right-10 top-2 w-8 h-8 flex items-center justify-center rounded-full transition-all ${
                          playingIndex === i && ttsState === 'loading'
                            ? 'bg-yellow-100 text-yellow-600 animate-pulse'
                            : playingIndex === i && ttsState === 'playing'
                            ? 'bg-french-blue text-white'
                            : 'bg-gray-100 text-gray-400 opacity-0 group-hover:opacity-100'
                        }`}
                      >
                        {playingIndex === i && ttsState === 'loading' ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeDasharray="30" strokeDashoffset="10"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/></circle></svg>
                        ) : playingIndex === i && ttsState === 'playing' ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                        )}
                      </button>
                    )}
                  </>
                ) : (
                  <p>{msg.content}</p>
                )}
              </div>
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex">
              <div className="chat-bubble-ai">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
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
              className="input-expand flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-french-blue/40 text-sm"
              rows={1}
            />
            <button
              onClick={toggleRecording}
              className={`p-3 rounded-full transition-all ${
                isRecording ? 'bg-french-red text-white animate-pulse' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" x2="12" y1="19" y2="22"/>
              </svg>
            </button>
            <button
              onClick={handleSend}
              disabled={!inputText.trim() || isLoading}
              className="p-3 rounded-full bg-french-blue text-white hover:bg-french-blue/90 transition-colors disabled:opacity-30"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen max-w-3xl mx-auto px-4 py-8">
      <div className="text-center mb-10">
        <h1 className="font-display text-4xl font-bold text-french-dark mb-2">Français au Quotidien</h1>
        <p className="text-gray-500 text-lg">Разговорный французский каждый день</p>
      </div>
      <div className="flex justify-center gap-2 mb-8 flex-wrap">
        {LEVELS.map((level) => (
          <button
            key={level}
            onClick={() => setSelectedLevel(level)}
            className={`level-btn px-5 py-2 rounded-full text-sm font-semibold ${
              selectedLevel === level ? 'active' : 'bg-white text-gray-600 hover:text-french-blue'
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
            className="w-full text-left px-5 py-4 bg-white rounded-xl hover:shadow-md transition-all group"
          >
            <div className="flex items-baseline gap-3">
              <span className="text-xs font-mono text-gray-400 group-hover:text-french-blue transition-colors">
                {String(lesson.lesson_number).padStart(2, '0')}
              </span>
              <div>
                <p className="font-display font-semibold text-french-dark group-hover:text-french-blue transition-colors">
                  {lesson.title_fr}
                </p>
                <p className="text-sm text-gray-400 mt-0.5">{lesson.title_ru}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
