'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { FR_PATTERNS } from './catalog'

const C = {
  navy: '#0f1b3d', amber: '#f59e0b', pale: '#fff8ed', ink: '#17213f',
  muted: '#667085', green: '#15803d', red: '#b42318', line: '#eadfce', blue: '#2563eb',
}

const PROGRESS_KEY = 'ef_retrieval_fr_v2_progress'
const SESSION_KEY = 'ef_retrieval_fr_v2_resume'

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function meaningScore(drill, raw) {
  const text = normalize(raw)
  if (!text) return 0
  const hits = drill.meaningGroups.filter((group) =>
    group.some((entry) => entry.split('|').some((part) => text.includes(normalize(part))))
  ).length
  const ratio = hits / Math.max(1, drill.meaningGroups.length)
  if (ratio >= 0.72) return 2
  if (ratio >= 0.34) return 1
  return 0
}

function evaluate(pattern, drill, transcript, firstAttempt, hintLevel, latencyMs) {
  const text = normalize(transcript)
  const targetScore = pattern.targetFull.test(text) ? 2 : pattern.targetPartial.test(text) ? 1 : 0
  const meaning = meaningScore(drill, transcript)
  let outcome = 'MEANING_MISS'

  if (meaning === 2 && targetScore === 2) {
    outcome = firstAttempt && hintLevel === 0 ? 'TARGET_INDEPENDENT' : 'TARGET_SUPPORTED'
  } else if (meaning === 2) {
    outcome = 'MEANING_ALTERNATIVE'
  } else if (meaning === 1) {
    outcome = 'MEANING_PARTIAL'
  } else if (targetScore > 0) {
    outcome = 'TARGET_NEEDS_REPAIR'
  }

  return {
    patternId: pattern.id,
    drillId: drill.id,
    phase: drill.phase,
    transcript,
    firstAttempt,
    hintLevel,
    latencyMs,
    meaningScore: meaning,
    targetScore,
    outcome,
    independent: outcome === 'TARGET_INDEPENDENT',
  }
}

function feedbackCopy(outcome) {
  switch (outcome) {
    case 'TARGET_INDEPENDENT':
      return ['Смысл и нужная французская форма получились', 'Это самостоятельное извлечение без подсказки.', C.green]
    case 'TARGET_SUPPORTED':
      return ['Получилось с поддержкой', 'Это полезная практика, но пока не доказательство самостоятельного retrieval.', C.blue]
    case 'MEANING_ALTERNATIVE':
      return ['Смысл передан естественно', 'Но сейчас мы тренируем другой французский способ выразить эту мысль.', C.amber]
    case 'MEANING_PARTIAL':
      return ['Смысл передан частично', 'Уточним смысл и попробуем ещё раз.', C.amber]
    case 'TARGET_NEEDS_REPAIR':
      return ['Форма появилась, но смысл съехал', 'Сохраним конструкцию и поправим содержание.', C.amber]
    default:
      return ['Пока не получилось', 'Сначала поправим смысл, не показывая готовый ответ.', C.red]
  }
}

export default function FrenchLab() {
  const [view, setView] = useState('library')
  const [patternId, setPatternId] = useState(FR_PATTERNS[0].id)
  const [reviewMode, setReviewMode] = useState(false)
  const [turnIndex, setTurnIndex] = useState(0)
  const [events, setEvents] = useState([])
  const [progress, setProgress] = useState({})
  const [retryCount, setRetryCount] = useState(0)
  const [hintLevel, setHintLevel] = useState(0)
  const [typed, setTyped] = useState('')
  const [showTyped, setShowTyped] = useState(false)
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState('')
  const [resumeReady, setResumeReady] = useState(false)

  const shownAt = useRef(Date.now())
  const speechAt = useRef(null)
  const recognition = useRef(null)

  useEffect(() => {
    try {
      const p = localStorage.getItem(PROGRESS_KEY)
      if (p) setProgress(JSON.parse(p))
      if (localStorage.getItem(SESSION_KEY)) setResumeReady(true)
    } catch {}
  }, [])

  useEffect(() => {
    shownAt.current = Date.now()
    speechAt.current = null
    setTyped('')
    setShowTyped(false)
    setError('')
    try { recognition.current?.abort() } catch {}
    recognition.current = null
    setRecording(false)
  }, [turnIndex, retryCount, view])

  const focus = useMemo(
    () => FR_PATTERNS.find((p) => p.id === patternId) || FR_PATTERNS[0],
    [patternId]
  )

  const oldPattern = useMemo(() => {
    const id = Object.keys(progress).find((key) => key !== patternId)
    return id ? FR_PATTERNS.find((p) => p.id === id) || null : null
  }, [progress, patternId])

  const turns = useMemo(() => {
    const drills = reviewMode
      ? focus.drills.filter((d) => ['contrast', 'transfer', 'delayed'].includes(d.phase))
      : focus.drills
    const list = drills.map((drill) => ({ pattern: focus, drill }))

    if (!reviewMode && oldPattern) {
      const oldDrill = oldPattern.drills.find((d) => d.phase === 'delayed') || oldPattern.drills[oldPattern.drills.length - 1]
      list.splice(Math.min(4, list.length), 0, { pattern: oldPattern, drill: oldDrill, interleaved: true })
    }

    if (!reviewMode) list.push({ pattern: focus, free: true })
    return list
  }, [focus, oldPattern, reviewMode])

  const turn = turns[turnIndex]
  const drill = turn?.drill
  const currentEvents = drill
    ? events.filter((e) => e.patternId === turn.pattern.id && e.drillId === drill.id)
    : events.filter((e) => e.patternId === turn?.pattern.id && e.drillId === 'free')
  const last = currentEvents[currentEvents.length - 1]

  useEffect(() => {
    if (view !== 'practice') return
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ patternId, turnIndex, events, reviewMode }))
      setResumeReady(true)
    } catch {}
  }, [view, patternId, turnIndex, events, reviewMode])

  function saveProgress(next) {
    setProgress(next)
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(next)) } catch {}
  }

  function startPattern(id) {
    const existing = progress[id]
    const due = !!existing && new Date(existing.nextDueAt).getTime() <= Date.now()
    setPatternId(id)
    setReviewMode(due)
    setTurnIndex(0)
    setEvents([])
    setRetryCount(0)
    setHintLevel(0)
    setView('practice')
  }

  function startRecommended() {
    const due = FR_PATTERNS.find((p) => progress[p.id] && new Date(progress[p.id].nextDueAt).getTime() <= Date.now())
    const fresh = FR_PATTERNS.find((p) => !progress[p.id])
    startPattern((due || fresh || FR_PATTERNS[0]).id)
  }

  function resumeSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY)
      if (!raw) return
      const state = JSON.parse(raw)
      if (!FR_PATTERNS.some((p) => p.id === state.patternId)) return
      setPatternId(state.patternId)
      setTurnIndex(state.turnIndex || 0)
      setEvents(state.events || [])
      setReviewMode(!!state.reviewMode)
      setRetryCount(0)
      setHintLevel(0)
      setView('practice')
    } catch {}
  }

  function submit(text, latencyMs) {
    if (!turn) return

    if (turn.free) {
      const t = normalize(text)
      const targetScore = turn.pattern.targetFull.test(t) ? 2 : turn.pattern.targetPartial.test(t) ? 1 : 0
      setEvents((prev) => [...prev, {
        patternId: turn.pattern.id,
        drillId: 'free',
        phase: 'free',
        transcript: text,
        firstAttempt: true,
        hintLevel: 0,
        latencyMs,
        meaningScore: 2,
        targetScore,
        outcome: targetScore === 2 ? 'TARGET_INDEPENDENT' : 'MEANING_ALTERNATIVE',
        independent: targetScore === 2,
      }])
      return
    }

    if (!drill) return
    const event = evaluate(turn.pattern, drill, text, retryCount === 0, hintLevel, latencyMs)
    setEvents((prev) => [...prev, event])
  }

  function submitTyped() {
    const text = typed.trim()
    if (text) submit(text, Math.max(0, Date.now() - shownAt.current))
  }

  function startVoice() {
    setError('')
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      setShowTyped(true)
      setError('Голосовой ввод здесь не поддерживается. Можно пройти текстом.')
      return
    }

    try {
      const rec = new SR()
      recognition.current = rec
      rec.lang = 'fr-FR'
      rec.interimResults = false
      rec.continuous = false
      rec.maxAlternatives = 1
      rec.onstart = () => setRecording(true)
      rec.onspeechstart = () => { speechAt.current = Date.now() }
      rec.onresult = (event) => {
        const item = event.results[event.results.length - 1]
        const text = item?.[0]?.transcript?.trim()
        setRecording(false)
        if (text) submit(text, Math.max(0, (speechAt.current || Date.now()) - shownAt.current))
        else setError('Не расслышал. Попробуй ещё раз.')
      }
      rec.onerror = () => {
        setRecording(false)
        setShowTyped(true)
        setError('Голосовой ввод не сработал. Используй текст.')
      }
      rec.onend = () => setRecording(false)
      rec.start()
    } catch {
      setShowTyped(true)
      setError('Не удалось запустить микрофон. Используй текст.')
    }
  }

  function stopVoice() {
    try { recognition.current?.stop() } catch {}
    setRecording(false)
  }

  function retryNow() {
    setRetryCount((v) => v + 1)
    setHintLevel((v) => Math.min(2, v + 1))
  }

  function nextTurn() {
    if (turnIndex < turns.length - 1) {
      setTurnIndex((v) => v + 1)
      setRetryCount(0)
      setHintLevel(0)
    } else {
      finish()
    }
  }

  function finish() {
    const focusEvents = events.filter((e) => e.patternId === patternId)
    const delayed = [...focusEvents].reverse().find((e) => e.phase === 'delayed')
    const passed = delayed?.outcome === 'TARGET_INDEPENDENT'
    const old = progress[patternId]
    const delayedSuccesses = (old?.delayedSuccesses || 0) + (passed ? 1 : 0)
    const days = !passed ? 1 : delayedSuccesses <= 1 ? 1 : delayedSuccesses === 2 ? 3 : delayedSuccesses === 3 ? 7 : delayedSuccesses === 4 ? 14 : 30
    const next = {
      ...progress,
      [patternId]: {
        sessions: (old?.sessions || 0) + 1,
        nextDueAt: new Date(Date.now() + days * 86400000).toISOString(),
        delayedSuccesses,
        lastOutcome: focusEvents[focusEvents.length - 1]?.outcome || null,
        lastValidProbeAt: focusEvents.some((e) => e.independent) ? new Date().toISOString() : old?.lastValidProbeAt || null,
      },
    }
    saveProgress(next)
    try { localStorage.removeItem(SESSION_KEY) } catch {}
    setResumeReady(false)
    setView('result')
  }

  if (view === 'library') {
    const dueCount = FR_PATTERNS.filter((p) => progress[p.id] && new Date(progress[p.id].nextDueAt).getTime() <= Date.now()).length
    return (
      <main style={page}>
        <div style={shell}>
          <p style={kicker}>Français au Quotidien · Retrieval Lab V2</p>
          <h1 style={hero}>Смысл → французская форма → self-repair → transfer.</h1>
          <p style={lead}>Параллельная французская версия: 6 конструкций A2–B2, ситуации по-французски, минимальные подсказки, повторная попытка до model answer, blind transfer и короткие delayed-review.</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 20 }}>
            <button onClick={startRecommended} style={primary}>Начать рекомендуемую →</button>
            {resumeReady && <button onClick={resumeSession} style={ghost}>Продолжить незавершённую</button>}
          </div>
          <p style={{ fontSize: 13, color: C.muted }}>На повтор сегодня: {dueCount}. Просроченные навыки идут раньше новых.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12, marginTop: 24 }}>
            {FR_PATTERNS.map((p) => {
              const pr = progress[p.id]
              const isDue = pr && new Date(pr.nextDueAt).getTime() <= Date.now()
              return (
                <button key={p.id} onClick={() => startPattern(p.id)} style={patternCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={chip}>{isDue ? 'Повторить сегодня' : pr ? `Проверка ${new Date(pr.nextDueAt).toLocaleDateString('ru-RU')}` : 'Новый'}</span>
                    <span style={{ fontSize: 12, color: C.muted }}>{p.level}</span>
                  </div>
                  <strong style={{ display: 'block', marginTop: 12, fontSize: 18, color: C.navy }}>{p.name}</strong>
                  <span style={{ display: 'block', marginTop: 6, fontSize: 13, color: C.muted, lineHeight: 1.5 }}>{p.meaning}</span>
                  <code style={{ display: 'block', marginTop: 10, fontSize: 12 }}>{p.form}</code>
                </button>
              )
            })}
          </div>
        </div>
      </main>
    )
  }

  if (view === 'result') {
    const focusEvents = events.filter((e) => e.patternId === patternId)
    const first = focusEvents.filter((e) => e.firstAttempt && e.phase !== 'free')
    const meaningOk = first.filter((e) => e.meaningScore === 2).length
    const targetOk = first.filter((e) => e.outcome === 'TARGET_INDEPENDENT').length
    const delayed = [...focusEvents].reverse().find((e) => e.phase === 'delayed')
    const supported = focusEvents.filter((e) => e.outcome === 'TARGET_SUPPORTED').length
    const free = focusEvents.find((e) => e.phase === 'free')
    const pr = progress[patternId]

    return (
      <main style={{ ...page, background: C.navy, color: 'white' }}>
        <div style={shell}>
          <p style={{ ...kicker, color: '#fbbf24' }}>FR V2 · {focus.name}</p>
          <h1 style={{ ...hero, color: 'white' }}>Что действительно получилось без подсказки?</h1>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12, marginTop: 22 }}>
            <div style={resultCard}><small>Смысл с первой попытки</small><strong>{meaningOk}/{first.length}</strong><span>мысль соответствовала ситуации</span></div>
            <div style={resultCard}><small>Нужная форма сама</small><strong>{targetOk}/{first.length}</strong><span>без подсказки и без показанной модели</span></div>
            <div style={resultCard}><small>Delayed-in-session probe</small><strong>{delayed?.outcome === 'TARGET_INDEPENDENT' ? 'Получился' : 'Не подтверждён'}</strong><span>важный сигнал внутри этой сессии</span></div>
            <div style={resultCard}><small>С поддержкой</small><strong>{supported}</strong><span>полезная практика, но не mastery evidence</span></div>
          </div>
          {free && <div style={summaryCard}><strong>Свободная речь</strong><p style={{ margin: '8px 0 0', color: '#cbd5e1' }}>{free.targetScore === 2 ? 'Target появился спонтанно.' : 'Target не появился — и это не ошибка: в free task он не обязателен.'}</p></div>}
          <div style={summaryCard}><strong>Сохранение навыка ещё не доказано.</strong><p style={{ margin: '8px 0 0', color: '#cbd5e1' }}>Следующая короткая проверка: {pr ? new Date(pr.nextDueAt).toLocaleDateString('ru-RU') : '—'}. Только delayed success расширяет интервал.</p></div>
          <button onClick={() => setView('library')} style={{ ...primary, marginTop: 20 }}>Закончить</button>
        </div>
      </main>
    )
  }

  if (!turn) return null

  const success = !!last && (last.outcome === 'TARGET_INDEPENDENT' || last.outcome === 'TARGET_SUPPORTED')
  const canRetry = !!last && !success && retryCount < 2
  const reveal = !!last && !success && retryCount >= 2
  const copy = last ? feedbackCopy(last.outcome) : null
  const phase = turn.interleaved ? 'Interleaving · старый навык' : turn.free ? 'Free production · target не обязателен' : reviewMode ? 'Короткий delayed review' : drill?.phase === 'cold' ? 'Cold probe · target скрыт' : drill?.phase === 'runway' ? 'Blocked runway' : drill?.phase === 'contrast' ? 'Contrast boundary' : drill?.phase === 'transfer' ? 'Blind transfer' : drill?.phase === 'delayed' ? 'Delayed-in-session' : 'Varied retrieval'

  return (
    <main style={page}>
      <div style={shell}>
        <button onClick={() => setView('library')} style={ghost}>← Библиотека</button>
        <p style={{ ...kicker, marginTop: 24 }}>{phase}</p>
        <h2 style={{ fontSize: 20, color: C.muted, margin: '8px 0' }}>{turn.pattern.name}</h2>

        {!turn.free && drill && <>
          <div style={scenario}>{drill.scenario}</div>
          <h1 style={{ ...hero, fontSize: 'clamp(28px,6vw,42px)' }}>{drill.prompt}</h1>
        </>}

        {turn.free && <>
          <div style={scenario}>Говори свободно 20–30 секунд. Нужная конструкция может появиться сама, но заставлять её не нужно.</div>
          <h1 style={{ ...hero, fontSize: 'clamp(28px,6vw,42px)' }}>{turn.pattern.freePrompt}</h1>
        </>}

        {retryCount > 0 && drill && <div style={hintBox}>
          <b>{retryCount === 1 ? 'Минимальная подсказка' : 'Более явная подсказка'}</b>
          <p>{retryCount === 1 ? drill.meaningHint : turn.pattern.formHint}</p>
          {retryCount >= 2 && <code>{turn.pattern.form}</code>}
        </div>}

        {!last && <div style={{ marginTop: 24 }}>
          <button onClick={recording ? stopVoice : startVoice} style={{ ...primary, background: recording ? C.red : C.navy, color: 'white' }}>{recording ? '■ Остановить' : '🎙 Ответить по-французски'}</button>
          <button onClick={() => setShowTyped((v) => !v)} style={{ ...ghost, marginLeft: 10 }}>Или напечатать</button>
          {showTyped && <div style={{ marginTop: 14 }}>
            <textarea value={typed} onChange={(e) => setTyped(e.target.value)} rows={3} placeholder="Réponse en français…" style={textarea} />
            <button onClick={submitTyped} style={{ ...primary, marginTop: 8 }}>Проверить</button>
          </div>}
          {error && <p style={{ color: C.red }}>{error}</p>}
        </div>}

        {last && copy && <div style={{ marginTop: 24 }}>
          <div style={answerCard}><small>Ты сказал</small><p style={{ fontSize: 19 }}>«{last.transcript}»</p></div>
          <div style={{ ...feedbackCard, borderLeft: `5px solid ${copy[2]}` }}><strong>{copy[0]}</strong><p>{copy[1]}</p></div>
          {canRetry && <button onClick={retryNow} style={{ ...primary, marginTop: 12 }}>Попробовать ещё раз с подсказкой →</button>}
          {(success || reveal) && <>
            <div style={modelCard}>
              <small>Рекомендуемый вариант</small>
              <p><b>«{drill?.models[0] || '—'}»</b></p>
              {drill?.models[1] && <><small>Также естественно</small><p>«{drill.models[1]}»</p></>}
            </div>
            <button onClick={nextTurn} style={{ ...primary, marginTop: 12 }}>{turnIndex < turns.length - 1 ? 'Дальше →' : 'Показать итог →'}</button>
          </>}
        </div>}
      </div>
    </main>
  )
}

const page = { minHeight: '100vh', background: C.pale, color: C.ink, fontFamily: 'system-ui,-apple-system,sans-serif' }
const shell = { maxWidth: 900, margin: '0 auto', padding: '42px 20px 72px' }
const kicker = { margin: 0, textTransform: 'uppercase', letterSpacing: 1.2, color: C.amber, fontSize: 12, fontWeight: 850 }
const hero = { color: C.navy, fontSize: 'clamp(34px,7vw,54px)', lineHeight: 1.08, margin: '10px 0 18px' }
const lead = { fontSize: 17, lineHeight: 1.6, color: C.muted }
const primary = { border: 0, borderRadius: 10, background: C.amber, color: C.navy, padding: '13px 18px', fontWeight: 800, fontSize: 15, cursor: 'pointer' }
const ghost = { border: '1px solid #d6d3d1', borderRadius: 10, background: 'transparent', color: C.muted, padding: '10px 13px', fontWeight: 700, cursor: 'pointer' }
const patternCard = { textAlign: 'left', border: `1px solid ${C.line}`, background: 'white', borderRadius: 14, padding: 16, cursor: 'pointer', fontFamily: 'inherit' }
const chip = { background: '#eef4ff', borderRadius: 999, padding: '4px 8px', fontSize: 11, fontWeight: 800, color: C.navy }
const scenario = { marginTop: 18, padding: 16, border: `1px solid ${C.line}`, background: 'white', borderRadius: 14, fontSize: 17, lineHeight: 1.55 }
const hintBox = { marginTop: 16, padding: 16, border: '1px solid #f5d487', background: '#fff7df', borderRadius: 14, lineHeight: 1.5 }
const textarea = { width: '100%', boxSizing: 'border-box', border: '1px solid #d6d3d1', borderRadius: 10, padding: 12, fontSize: 16 }
const answerCard = { background: 'white', border: `1px solid ${C.line}`, borderRadius: 14, padding: 16 }
const feedbackCard = { background: 'white', border: `1px solid ${C.line}`, borderRadius: 14, padding: 16, marginTop: 10 }
const modelCard = { background: '#fff7df', border: '1px solid #f5d487', borderRadius: 14, padding: 16, marginTop: 12 }
const resultCard = { background: '#172554', borderRadius: 14, padding: 16, display: 'grid', gap: 8 }
const summaryCard = { marginTop: 16, padding: 18, border: '1px solid #334155', borderRadius: 14, background: '#111c3f' }
