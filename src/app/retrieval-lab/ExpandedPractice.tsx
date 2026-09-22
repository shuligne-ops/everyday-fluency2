'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Pattern } from './retrievalTypes'
import { TIMES_PATTERNS } from './catalogTimes'
import { MODALITY_PATTERNS } from './catalogModality'
import { CONVERSATION_PATTERNS } from './catalogConversation'

const PATTERNS: Pattern[] = [...TIMES_PATTERNS, ...MODALITY_PATTERNS, ...CONVERSATION_PATTERNS]
const SESSION_SIZE = 10
const STORAGE_KEY = 'ef_language_retrieval_expanded_v1'

const COLORS = {
  navy: '#0f1b3d', amber: '#f59e0b', pale: '#fff8ed', ink: '#17213f', muted: '#667085',
  green: '#15803d', red: '#b42318', line: '#eadfce', bluePale: '#eef4ff',
}

type Attempt = { transcript: string; latencyMs: number; score: 0 | 1 | 2 }
type Progress = { sessions: number; strength: number; medianLatencyMs: number | null; nextDueAt: string }
type ProgressMap = Record<string, Progress>
type SpeechRecognitionLike = {
  lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number
  start: () => void; stop: () => void; abort: () => void
  onstart: (() => void) | null
  onspeechstart: (() => void) | null
  onresult: ((event: { results: ArrayLike<{ 0?: { transcript?: string } }> }) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onend: (() => void) | null
}

function normalize(text: string) {
  return text.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function score(pattern: Pattern, raw: string): 0 | 1 | 2 {
  const t = normalize(raw)
  if (pattern.full.test(t)) return 2
  if (pattern.partial.test(t)) return 1
  return 0
}

function median(values: number[]) {
  if (!values.length) return null
  const s = [...values].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2)
}

function dueLabel(progress?: Progress) {
  if (!progress) return 'Новый'
  const due = new Date(progress.nextDueAt).getTime()
  if (due <= Date.now()) return 'Пора повторить'
  return `Через ${Math.max(1, Math.ceil((due - Date.now()) / 86400000))} дн.`
}

function scoreWords(value: number) {
  if (value === 2) return { short: 'Да', detail: 'нужная конструкция появилась сама, без подсказки' }
  if (value === 1) return { short: 'Почти', detail: 'конструкция вспомнилась, но форма была неполной' }
  return { short: 'Нет', detail: 'нужная конструкция сама не пришла в голову' }
}

function latencyWords(ms: number | null) {
  if (ms == null) return 'нет данных'
  const s = ms / 1000
  if (s < 3) return 'ответ обычно начинается почти сразу'
  if (s < 6) return 'перед ответом есть небольшая пауза'
  return 'перед ответом пока есть заметная пауза'
}

export default function ExpandedPractice() {
  const [view, setView] = useState<'library' | 'practice' | 'result'>('library')
  const [patternId, setPatternId] = useState(PATTERNS[0].id)
  const [index, setIndex] = useState(0)
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [progress, setProgress] = useState<ProgressMap>({})
  const [typed, setTyped] = useState('')
  const [showTyped, setShowTyped] = useState(false)
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState('')
  const [levelFilter, setLevelFilter] = useState<'Все' | 'A2' | 'B1–B2'>('Все')
  const shownAtRef = useRef(Date.now())
  const speechAtRef = useRef<number | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setProgress(JSON.parse(raw) as ProgressMap)
    } catch {}
  }, [])

  useEffect(() => {
    shownAtRef.current = Date.now()
    speechAtRef.current = null
    setTyped('')
    setShowTyped(false)
    setError('')
    try { recognitionRef.current?.abort() } catch {}
    recognitionRef.current = null
    setRecording(false)
  }, [index, patternId, view])

  const pattern = useMemo(() => PATTERNS.find((p) => p.id === patternId) ?? PATTERNS[0], [patternId])
  const drill = pattern.drills[index]
  const attempt = attempts[index]

  function persist(next: ProgressMap) {
    setProgress(next)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
  }

  function choosePattern(id: string) {
    setPatternId(id)
    setIndex(0)
    setAttempts([])
    setView('practice')
  }

  function chooseRecommended() {
    const now = Date.now()
    const ranked = [...PATTERNS].sort((a, b) => {
      const pa = progress[a.id], pb = progress[b.id]
      const ad = !pa || new Date(pa.nextDueAt).getTime() <= now ? 0 : 1
      const bd = !pb || new Date(pb.nextDueAt).getTime() <= now ? 0 : 1
      if (ad !== bd) return ad - bd
      return (pa?.strength ?? -1) - (pb?.strength ?? -1)
    })
    choosePattern(ranked[0].id)
  }

  function startVoice() {
    setError('')
    const w = window as typeof window & {
      SpeechRecognition?: new () => SpeechRecognitionLike
      webkitSpeechRecognition?: new () => SpeechRecognitionLike
    }
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition
    if (!SR) {
      setError('Голосовой ввод здесь не поддерживается. Используй Chrome или текст.')
      setShowTyped(true)
      return
    }
    try {
      const rec = new SR()
      rec.lang = 'en-US'; rec.interimResults = false; rec.continuous = false; rec.maxAlternatives = 1
      recognitionRef.current = rec
      rec.onstart = () => setRecording(true)
      rec.onspeechstart = () => { speechAtRef.current = Date.now() }
      rec.onresult = (event) => {
        const last = event.results[event.results.length - 1]
        const transcript = last?.[0]?.transcript?.trim()
        setRecording(false)
        if (!transcript) { setError('Не расслышал. Попробуй ещё раз.'); return }
        submitAnswer(transcript, Math.max(0, (speechAtRef.current ?? Date.now()) - shownAtRef.current))
      }
      rec.onerror = () => {
        setRecording(false)
        setShowTyped(true)
        setError('Голосовой ввод не сработал. Можно пройти упражнение текстом.')
      }
      rec.onend = () => setRecording(false)
      rec.start()
    } catch {
      setRecording(false); setShowTyped(true); setError('Не удалось запустить голосовой ввод. Используй текст.')
    }
  }

  function stopVoice() { try { recognitionRef.current?.stop() } catch {}; setRecording(false) }

  function submitAnswer(transcript: string, latencyMs: number) {
    const next = [...attempts]
    next[index] = { transcript, latencyMs, score: score(pattern, transcript) }
    setAttempts(next)
  }

  function submitTyped() {
    const text = typed.trim()
    if (!text) return
    submitAnswer(text, Math.max(0, Date.now() - shownAtRef.current))
  }

  function finish() {
    const rows = attempts.filter(Boolean)
    const total = rows.reduce((sum, row) => sum + row.score, 0)
    const accuracy = rows.length ? total / (rows.length * 2) : 0
    const lastThree = rows.slice(-3)
    const lastThreeAccuracy = lastThree.length ? lastThree.reduce((s, row) => s + row.score, 0) / (lastThree.length * 2) : 0
    const strength = Math.max(0, Math.min(5, Math.round((accuracy * .4 + lastThreeAccuracy * .6) * 5)))
    const med = median(rows.map((row) => row.latencyMs))
    const days = strength <= 1 ? 1 : strength === 2 ? 2 : strength === 3 ? 3 : strength === 4 ? 7 : 14
    const old = progress[pattern.id]
    persist({
      ...progress,
      [pattern.id]: {
        sessions: (old?.sessions ?? 0) + 1,
        strength,
        medianLatencyMs: med,
        nextDueAt: new Date(Date.now() + days * 86400000).toISOString(),
      },
    })
    setView('result')
  }

  function nextDrill() {
    if (index < SESSION_SIZE - 1) setIndex(index + 1)
    else finish()
  }

  function resetAll() {
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
    setProgress({})
  }

  if (view === 'library') {
    const categories = ['Времена и aspect', 'Модальность', 'Разговорные конструкции'] as const
    const completed = Object.keys(progress).length
    const visible = (p: Pattern) => levelFilter === 'Все' || (levelFilter === 'A2' ? p.level.includes('A2') : !p.level.includes('A2') || p.level.includes('B1'))

    return <main style={pageStyle}><div style={shellStyle}>
      <p style={kicker}>Everyday Fluency · Language Retrieval Lab</p>
      <h1 style={hero}>Ты это знаешь. Теперь достань это быстро и без подсказки.</h1>
      <p style={lead}><b>30 конструкций · 10 в каждом разделе.</b> Есть простые A2 и более плотные B1–B2. Одна тренировка — 10 разных ситуаций на одну конструкцию, после каждого ответа показываются два естественных варианта.</p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 20 }}>
        <button onClick={chooseRecommended} style={primaryButton}>Начать рекомендуемую →</button>
        <button onClick={resetAll} style={ghostButton}>Сбросить прогресс</button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 18 }}>
        {(['Все', 'A2', 'B1–B2'] as const).map((value) => <button key={value} onClick={() => setLevelFilter(value)} style={{ ...chipButton, background: levelFilter === value ? COLORS.navy : 'white', color: levelFilter === value ? 'white' : COLORS.navy }}>{value}</button>)}
      </div>
      <p style={{ fontSize: 13, color: COLORS.muted }}>Уже тренировал: {completed}/{PATTERNS.length}. Прогресс хранится в этом браузере.</p>

      {categories.map((category) => {
        const items = PATTERNS.filter((p) => p.category === category && visible(p))
        return <section key={category} style={{ marginTop: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
            <h2 style={{ color: COLORS.navy, fontSize: 22, margin: 0 }}>{category}</h2>
            <span style={{ color: COLORS.muted, fontSize: 13 }}>{PATTERNS.filter((p) => p.category === category).length} конструкций</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 12, marginTop: 12 }}>
            {items.map((p) => {
              const pr = progress[p.id]
              return <button key={p.id} onClick={() => choosePattern(p.id)} style={patternCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><span style={{ ...chip, background: pr ? COLORS.bluePale : '#f6f1e9' }}>{dueLabel(pr)}</span><span style={{ fontSize: 12, color: COLORS.muted }}>{p.level}</span></div>
                <strong style={{ display: 'block', fontSize: 17, color: COLORS.navy, marginTop: 12 }}>{p.name}</strong>
                <span style={{ display: 'block', fontSize: 13, color: COLORS.muted, lineHeight: 1.45, marginTop: 6 }}>{p.meaning}</span>
                <span style={{ display: 'block', marginTop: 10, fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace', fontSize: 12, color: '#475569' }}>{p.form}</span>
                {pr && <span style={{ display: 'block', marginTop: 12, fontSize: 13, color: COLORS.green }}>Закрепление {pr.strength}/5 · сессий {pr.sessions}</span>}
              </button>
            })}
          </div>
        </section>
      })}
    </div></main>
  }

  if (view === 'result') {
    const pr = progress[pattern.id]
    const first = attempts[0]
    const last = attempts[attempts.length - 1]
    const firstWords = scoreWords(first?.score ?? 0)
    const lastWords = scoreWords(last?.score ?? 0)
    const blind = attempts.slice(-3)
    const blindFull = blind.filter((a) => a?.score === 2).length
    const med = pr?.medianLatencyMs ?? null
    const strength = pr?.strength ?? 0
    const strengthText = strength >= 5 ? 'Очень уверенно' : strength >= 4 ? 'Уверенно' : strength >= 3 ? 'Неровно' : strength >= 2 ? 'Пока слабо' : 'Пока не закрепилось'

    return <main style={{ ...pageStyle, background: COLORS.navy, color: 'white' }}><div style={shellStyle}>
      <p style={{ ...kicker, color: '#fbbf24' }}>Серия завершена · {pattern.name}</p>
      <h1 style={{ ...hero, color: 'white' }}>Что изменилось за 10 примеров?</h1>
      <p style={{ ...lead, color: '#cbd5e1' }}>Главный вопрос: <b style={{ color: 'white' }}>приходит ли нужная конструкция в голову сама, без подсказки?</b></p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12, marginTop: 24 }}>
        <div style={resultCard}><small>До тренировки · вспомнил сам?</small><strong>{firstWords.short}</strong><span>{firstWords.detail}.</span></div>
        <div style={resultCard}><small>После 10 примеров · всплывает сама?</small><strong>{lastWords.short}</strong><span>{lastWords.detail}.</span></div>
        <div style={resultCard}><small>Последние 3 · без подсказки</small><strong>{blindFull}/3</strong><span>{blindFull === 3 ? 'три раза подряд конструкция появилась полностью' : blindFull === 2 ? 'два из трёх ответов — уверенно' : blindFull === 1 ? 'пока только один из трёх ответов — уверенно' : 'в последних трёх ответах форма ещё не появилась полностью'}.</span></div>
        <div style={resultCard}><small>Скорость извлечения</small><strong>{med == null ? '—' : `${(med / 1000).toFixed(1)} с`}</strong><span>{latencyWords(med)}.</span></div>
      </div>

      <div style={summaryCard}>
        <strong style={{ display: 'block', fontSize: 18 }}>Итог по всей серии: {strengthText}</strong>
        <p style={{ margin: '8px 0 0', color: '#cbd5e1', lineHeight: 1.6 }}>Внутренняя оценка закрепления: {strength}/5. Она учитывает все 10 ответов, но сильнее — последние три без подсказки.</p>
      </div>

      <p style={{ color: '#cbd5e1', lineHeight: 1.6, marginTop: 18 }}>Повторить {pr ? new Date(pr.nextDueAt).toLocaleDateString('ru-RU') : 'позже'} — не чтобы заново учить правило, а чтобы проверить, всплывает ли конструкция спустя время без подсказки.</p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 22 }}>
        <button onClick={() => { setAttempts([]); setIndex(0); setView('practice') }} style={{ ...primaryButton, background: COLORS.amber }}>Ещё 10 на эту конструкцию</button>
        <button onClick={() => setView('library')} style={{ ...ghostButton, color: 'white', borderColor: '#64748b' }}>К библиотеке</button>
      </div>
    </div></main>
  }

  const guided = index >= 1 && index <= 3
  const blind = index >= 7
  const phaseLabel = index === 0 ? '1 · Без подсказки' : guided ? `${index + 1} · Подсказка + закрепление` : blind ? `${index + 1} · Без подсказки` : `${index + 1} · Новый контекст`

  return <main style={pageStyle}><div style={shellStyle}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 20 }}>
      <button onClick={() => setView('library')} style={ghostButton}>← Библиотека</button>
      <div style={{ textAlign: 'right' }}><div style={{ fontWeight: 800, color: COLORS.navy }}>{pattern.name}</div><div style={{ fontSize: 12, color: COLORS.muted }}>{pattern.level} · {index + 1}/{SESSION_SIZE}</div></div>
    </div>
    <div style={{ height: 5, background: '#eadfce', borderRadius: 9, overflow: 'hidden', marginBottom: 28 }}><div style={{ width: `${((index + 1) / SESSION_SIZE) * 100}%`, height: '100%', background: COLORS.amber }} /></div>
    <p style={kicker}>{phaseLabel}</p>
    <h1 style={{ ...hero, fontSize: 'clamp(27px,6vw,42px)' }}>{drill.cue}</h1>

    {guided && !attempt && <div style={repairCard}><div style={smallLabel}>Подсказка</div><p style={{ margin: '6px 0 8px' }}>{pattern.repair}</p><div style={formula}>{pattern.form}</div></div>}
    {blind && !attempt && <div style={{ ...notice, background: '#eef4ff' }}>Без формулы и без примера. Попробуй вытащить конструкцию из памяти сразу.</div>}

    {!attempt && <section style={{ marginTop: 26 }}>
      <button onClick={recording ? stopVoice : startVoice} style={{ ...primaryButton, minWidth: 220, background: recording ? '#dc2626' : COLORS.navy, color: 'white' }}>{recording ? '■ Остановить' : '🎙 Ответить голосом'}</button>
      {!recording && <button onClick={() => setShowTyped((v) => !v)} style={{ ...ghostButton, marginLeft: 10 }}>{showTyped ? 'Скрыть текст' : 'Или напечатать'}</button>}
      {recording && <p style={{ color: COLORS.green, fontWeight: 700 }}>Слушаю…</p>}
      {showTyped && <div style={{ marginTop: 14 }}><textarea rows={3} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Your answer in English…" style={textarea} /><button onClick={submitTyped} disabled={!typed.trim()} style={{ ...primaryButton, marginTop: 9 }}>Проверить</button></div>}
      {error && <p style={{ color: COLORS.red }}>{error}</p>}
    </section>}

    {attempt && <section style={{ marginTop: 28 }}>
      <div style={quoteCard}><div style={smallLabel}>Ты сказал</div><div style={{ marginTop: 6, fontSize: 19 }}>“{attempt.transcript}”</div></div>
      <div style={{ ...card, borderLeft: `5px solid ${attempt.score === 2 ? COLORS.green : attempt.score === 1 ? COLORS.amber : COLORS.red}` }}>
        <strong>{attempt.score === 2 ? 'Конструкция появилась сама' : attempt.score === 1 ? 'Почти: конструкция узнаваема, но форма неполная' : 'Эта конструкция пока не пришла сама'}</strong>
        <p style={{ color: COLORS.muted, margin: '10px 0 0' }}>До начала ответа: {(attempt.latencyMs / 1000).toFixed(1)} с</p>
      </div>

      <div style={answerCard}>
        <div style={smallLabel}>Рекомендуемый вариант</div>
        <p style={{ margin: '8px 0 0', fontSize: 19, fontWeight: 800 }}>“{drill.models[0]}”</p>
        {drill.models.slice(1).map((m) => <div key={m} style={{ marginTop: 12 }}><div style={smallLabel}>Также естественно</div><p style={{ margin: '6px 0 0', fontSize: 17 }}>“{m}”</p></div>)}
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${COLORS.line}` }}><span style={smallLabel}>Модель конструкции</span><div style={{ ...formula, marginTop: 6 }}>{pattern.form}</div></div>
      </div>
      <button onClick={nextDrill} style={{ ...primaryButton, marginTop: 18 }}>{index < SESSION_SIZE - 1 ? `Следующий пример · ${index + 2}/${SESSION_SIZE} →` : 'Показать итог серии →'}</button>
    </section>}
  </div></main>
}

const pageStyle: React.CSSProperties = { minHeight: '100vh', background: COLORS.pale, color: COLORS.ink, fontFamily: 'system-ui,-apple-system,sans-serif' }
const shellStyle: React.CSSProperties = { maxWidth: 980, margin: '0 auto', padding: '42px 20px 72px' }
const kicker: React.CSSProperties = { margin: 0, textTransform: 'uppercase', letterSpacing: 1.3, color: COLORS.amber, fontSize: 12, fontWeight: 850 }
const hero: React.CSSProperties = { color: COLORS.navy, fontSize: 'clamp(34px,7vw,54px)', lineHeight: 1.08, margin: '10px 0 18px', letterSpacing: '-0.02em' }
const lead: React.CSSProperties = { fontSize: 17, lineHeight: 1.62, margin: '0 0 14px' }
const primaryButton: React.CSSProperties = { border: 0, borderRadius: 10, background: COLORS.amber, color: COLORS.navy, padding: '13px 18px', fontWeight: 800, fontSize: 15, cursor: 'pointer' }
const ghostButton: React.CSSProperties = { border: '1px solid #d6d3d1', borderRadius: 10, background: 'transparent', color: COLORS.muted, padding: '10px 13px', fontWeight: 700, cursor: 'pointer' }
const chipButton: React.CSSProperties = { border: '1px solid #d6d3d1', borderRadius: 999, padding: '7px 12px', fontWeight: 750, cursor: 'pointer' }
const patternCard: React.CSSProperties = { textAlign: 'left', border: `1px solid ${COLORS.line}`, background: 'white', borderRadius: 14, padding: 16, cursor: 'pointer', fontFamily: 'inherit' }
const chip: React.CSSProperties = { display: 'inline-block', borderRadius: 999, padding: '4px 8px', fontSize: 11, fontWeight: 800, color: COLORS.navy }
const smallLabel: React.CSSProperties = { textTransform: 'uppercase', letterSpacing: 1, color: COLORS.muted, fontSize: 11, fontWeight: 850 }
const repairCard: React.CSSProperties = { marginTop: 18, background: '#fff7df', border: '1px solid #f5d487', borderRadius: 14, padding: 17, lineHeight: 1.5 }
const notice: React.CSSProperties = { marginTop: 16, border: '1px solid #bfd3ff', borderRadius: 12, padding: '13px 15px', fontSize: 14, lineHeight: 1.5 }
const quoteCard: React.CSSProperties = { background: 'white', border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 17 }
const card: React.CSSProperties = { background: 'white', border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 17, marginTop: 12 }
const answerCard: React.CSSProperties = { background: '#fff7df', border: '1px solid #f5d487', borderRadius: 14, padding: 17, marginTop: 12 }
const formula: React.CSSProperties = { fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace', fontWeight: 800, fontSize: 16 }
const textarea: React.CSSProperties = { width: '100%', boxSizing: 'border-box', borderRadius: 10, border: '1px solid #d6d3d1', padding: 12, fontSize: 16, fontFamily: 'inherit', resize: 'vertical' }
const resultCard: React.CSSProperties = { background: '#172554', borderRadius: 14, padding: 18, display: 'grid', gap: 8, minHeight: 145 }
const summaryCard: React.CSSProperties = { marginTop: 18, padding: 20, border: '1px solid #334155', borderRadius: 14, background: '#111c3f' }
