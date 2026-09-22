'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { V2_PATTERNS } from './catalog'
import type { Attempt, Drill, EvalOutcome, Pattern, Progress } from './types'

type SessionAttempt = Attempt & { patternId: string }
type ProgressMap = Record<string, Progress>
type Turn = { pattern: Pattern; drill?: Drill; free?: boolean; interleaved?: boolean }
type ResumeState = { patternId: string; turnIndex: number; attempts: SessionAttempt[]; reviewMode: boolean }

type SpeechRecognitionLike = {
  lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number
  start: () => void; stop: () => void; abort: () => void
  onstart: (() => void) | null
  onspeechstart: (() => void) | null
  onresult: ((event: { results: ArrayLike<{ 0?: { transcript?: string } }> }) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onend: (() => void) | null
}

const COLORS = { navy:'#0f1b3d', amber:'#f59e0b', pale:'#fff8ed', ink:'#17213f', muted:'#667085', green:'#15803d', red:'#b42318', line:'#eadfce', blue:'#2563eb' }
const PROGRESS_KEY = 'ef_retrieval_v2_progress'
const SESSION_KEY = 'ef_retrieval_v2_session'

function normalize(text: string) {
  return text.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function phraseHit(text: string, phrase: string) {
  const p = normalize(phrase)
  return p.split('|').some((part) => text.includes(part.trim()))
}

function meaningScore(drill: Drill, raw: string): 0 | 1 | 2 {
  const text = normalize(raw)
  if (!text) return 0
  const hits = drill.meaningGroups.filter((group) => group.some((x) => phraseHit(text, x))).length
  const ratio = hits / Math.max(1, drill.meaningGroups.length)
  if (ratio >= .72) return 2
  if (ratio >= .34) return 1
  return 0
}

function evaluate(pattern: Pattern, drill: Drill, transcript: string, firstAttempt: boolean, hintLevel: number, latencyMs: number): SessionAttempt {
  const text = normalize(transcript)
  const targetScore: 0 | 1 | 2 = pattern.targetFull.test(text) ? 2 : pattern.targetPartial.test(text) ? 1 : 0
  const meaning = meaningScore(drill, transcript)
  let outcome: EvalOutcome
  if (meaning === 2 && targetScore === 2) outcome = firstAttempt && hintLevel === 0 ? 'TARGET_INDEPENDENT' : 'TARGET_SUPPORTED'
  else if (meaning === 2 && targetScore < 2) outcome = 'MEANING_ALTERNATIVE'
  else if (meaning === 1) outcome = 'MEANING_PARTIAL'
  else if (targetScore > 0) outcome = 'TARGET_NEEDS_REPAIR'
  else outcome = 'MEANING_MISS'
  const countsForMastery = outcome === 'TARGET_INDEPENDENT' && ['cold','contrast','transfer','delayed'].includes(drill.phase)
  return { patternId: pattern.id, drillId: drill.id, phase: drill.phase, transcript, firstAttempt, hintLevel, latencyMs, meaningScore: meaning, targetScore, outcome, countsForMastery }
}

function outcomeCopy(a: SessionAttempt) {
  switch (a.outcome) {
    case 'TARGET_INDEPENDENT': return { title:'Да — и смысл, и нужная форма получились', tone:COLORS.green, body:'Это самостоятельное извлечение: без подсказки.' }
    case 'TARGET_SUPPORTED': return { title:'Получилось с поддержкой', tone:COLORS.blue, body:'Это полезная практика, но пока не доказательство самостоятельного retrieval.' }
    case 'MEANING_ALTERNATIVE': return { title:'Смысл передан нормально', tone:COLORS.amber, body:'Но сейчас мы тренируем другой способ выразить эту мысль.' }
    case 'MEANING_PARTIAL': return { title:'Смысл передан частично', tone:COLORS.amber, body:'Уточним смысл и попробуем ещё раз.' }
    case 'TARGET_NEEDS_REPAIR': return { title:'Форма начала появляться', tone:COLORS.amber, body:'Но ответ пока не совпал с нужным смыслом полностью.' }
    default: return { title:'Пока не получилось', tone:COLORS.red, body:'Сначала поправим смысл, не раскрывая готовый ответ.' }
  }
}

function nextInterval(progress: Progress | undefined, delayedPassed: boolean) {
  const successes = (progress?.delayedSuccesses ?? 0) + (delayedPassed ? 1 : 0)
  const days = !delayedPassed ? 1 : successes <= 1 ? 1 : successes === 2 ? 3 : successes === 3 ? 7 : successes === 4 ? 14 : 30
  return { successes, days }
}

export default function V2Lab() {
  const [view, setView] = useState<'library'|'practice'|'result'>('library')
  const [patternId, setPatternId] = useState(V2_PATTERNS[0].id)
  const [turnIndex, setTurnIndex] = useState(0)
  const [attempts, setAttempts] = useState<SessionAttempt[]>([])
  const [progress, setProgress] = useState<ProgressMap>({})
  const [reviewMode, setReviewMode] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [hintLevel, setHintLevel] = useState(0)
  const [typed, setTyped] = useState('')
  const [showTyped, setShowTyped] = useState(false)
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState('')
  const [resume, setResume] = useState<ResumeState | null>(null)
  const shownAtRef = useRef(Date.now())
  const speechAtRef = useRef<number | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)

  useEffect(() => {
    try {
      const p = localStorage.getItem(PROGRESS_KEY); if (p) setProgress(JSON.parse(p))
      const s = localStorage.getItem(SESSION_KEY); if (s) setResume(JSON.parse(s))
    } catch {}
  }, [])

  useEffect(() => {
    shownAtRef.current = Date.now(); speechAtRef.current = null; setTyped(''); setShowTyped(false); setError('')
    try { recognitionRef.current?.abort() } catch {}
    recognitionRef.current = null; setRecording(false)
  }, [turnIndex, retryCount, view])

  const focusPattern = useMemo(() => V2_PATTERNS.find((p) => p.id === patternId)!, [patternId])
  const interleavePattern = useMemo(() => {
    const practiced = Object.keys(progress).find((id) => id !== patternId)
    return practiced ? V2_PATTERNS.find((p) => p.id === practiced) ?? null : null
  }, [progress, patternId])

  const turns = useMemo<Turn[]>(() => {
    const base = reviewMode ? focusPattern.drills.filter((d) => ['contrast','transfer','delayed'].includes(d.phase)) : [...focusPattern.drills]
    const list: Turn[] = base.map((drill) => ({ pattern: focusPattern, drill }))
    if (!reviewMode && interleavePattern) list.splice(Math.min(4, list.length), 0, { pattern: interleavePattern, drill: interleavePattern.drills.find((d) => d.phase === 'delayed') ?? interleavePattern.drills.at(-1), interleaved: true })
    if (!reviewMode) list.push({ pattern: focusPattern, free: true })
    return list
  }, [focusPattern, interleavePattern, reviewMode])

  const turn = turns[turnIndex]
  const drill = turn?.drill
  const turnAttempts = drill ? attempts.filter((a) => a.patternId === turn.pattern.id && a.drillId === drill.id) : []
  const lastAttempt = turnAttempts.at(-1)

  useEffect(() => {
    if (view !== 'practice') return
    const state: ResumeState = { patternId, turnIndex, attempts, reviewMode }
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(state)) } catch {}
  }, [view, patternId, turnIndex, attempts, reviewMode])

  function saveProgress(next: ProgressMap) {
    setProgress(next)
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(next)) } catch {}
  }

  function startPattern(id: string) {
    const p = progress[id]
    const due = !!p && new Date(p.nextDueAt).getTime() <= Date.now()
    setPatternId(id); setReviewMode(due); setTurnIndex(0); setAttempts([]); setRetryCount(0); setHintLevel(0); setView('practice')
  }

  function resumeSession() {
    if (!resume || !V2_PATTERNS.some((p) => p.id === resume.patternId)) return
    setPatternId(resume.patternId); setTurnIndex(resume.turnIndex); setAttempts(resume.attempts); setReviewMode(resume.reviewMode); setRetryCount(0); setHintLevel(0); setView('practice')
  }

  function recommended() {
    const due = V2_PATTERNS.find((p) => progress[p.id] && new Date(progress[p.id].nextDueAt).getTime() <= Date.now())
    startPattern((due ?? V2_PATTERNS.find((p) => !progress[p.id]) ?? V2_PATTERNS[0]).id)
  }

  function startVoice() {
    setError('')
    const w = window as typeof window & { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition
    if (!SR) { setShowTyped(true); setError('Голосовой ввод здесь не поддерживается. Можно пройти текстом.'); return }
    try {
      const rec = new SR(); rec.lang='en-US'; rec.interimResults=false; rec.continuous=false; rec.maxAlternatives=1
      recognitionRef.current=rec
      rec.onstart=()=>setRecording(true)
      rec.onspeechstart=()=>{ speechAtRef.current=Date.now() }
      rec.onresult=(event)=>{ const item=event.results[event.results.length-1]; const text=item?.[0]?.transcript?.trim(); setRecording(false); if (!text) return setError('Не расслышал. Попробуй ещё раз.'); submit(text, Math.max(0,(speechAtRef.current ?? Date.now())-shownAtRef.current)) }
      rec.onerror=()=>{ setRecording(false); setShowTyped(true); setError('Голосовой ввод не сработал. Используй текст.') }
      rec.onend=()=>setRecording(false)
      rec.start()
    } catch { setRecording(false); setShowTyped(true); setError('Не удалось запустить микрофон. Используй текст.') }
  }

  function stopVoice() { try { recognitionRef.current?.stop() } catch {}; setRecording(false) }

  function submit(text: string, latencyMs: number) {
    if (!turn) return
    if (turn.free) {
      const targetScore: 0|1|2 = turn.pattern.targetFull.test(normalize(text)) ? 2 : turn.pattern.targetPartial.test(normalize(text)) ? 1 : 0
      const event: SessionAttempt = { patternId:turn.pattern.id, drillId:'free', phase:'free', transcript:text, firstAttempt:true, hintLevel:0, latencyMs, meaningScore:2, targetScore, outcome: targetScore===2 ? 'TARGET_INDEPENDENT':'MEANING_ALTERNATIVE', countsForMastery:false }
      setAttempts((x)=>[...x,event]); return
    }
    if (!drill) return
    const event = evaluate(turn.pattern, drill, text, retryCount===0, hintLevel, latencyMs)
    setAttempts((x)=>[...x,event])
  }

  function submitTyped() { const text=typed.trim(); if (text) submit(text, Math.max(0,Date.now()-shownAtRef.current)) }

  function retry() {
    setRetryCount((r)=>r+1)
    setHintLevel((h)=>Math.min(2,h+1))
  }

  function advance() {
    if (turnIndex < turns.length-1) { setTurnIndex((i)=>i+1); setRetryCount(0); setHintLevel(0) }
    else finish()
  }

  function finish() {
    const focus = attempts.filter((a)=>a.patternId===patternId)
    const independent = focus.filter((a)=>a.countsForMastery)
    const delayed = focus.filter((a)=>a.phase==='delayed').at(-1)
    const delayedPassed = delayed?.outcome === 'TARGET_INDEPENDENT'
    const old = progress[patternId]
    const { successes, days } = nextInterval(old, delayedPassed)
    const next: ProgressMap = { ...progress, [patternId]: { sessions:(old?.sessions ?? 0)+1, nextDueAt:new Date(Date.now()+days*86400000).toISOString(), delayedSuccesses:successes, lastOutcome:(focus.at(-1)?.outcome ?? null), lastValidProbeAt: independent.length ? new Date().toISOString() : old?.lastValidProbeAt ?? null } }
    saveProgress(next)
    try { localStorage.removeItem(SESSION_KEY) } catch {}
    setResume(null); setView('result')
  }

  if (view === 'library') {
    const dueCount = V2_PATTERNS.filter((p)=>progress[p.id] && new Date(progress[p.id].nextDueAt).getTime()<=Date.now()).length
    return <main style={page}><div style={shell}>
      <p style={kicker}>Everyday Fluency · Retrieval Lab V2</p>
      <h1 style={hero}>Не переводим формулу. Учимся выбирать её в живой ситуации.</h1>
      <p style={lead}>Экспериментальная версия после аудита: 6 конструкций, English-first scenarios, meaning + target evaluation, self-repair до model answer, blind transfer, interleaving старого навыка и короткие due-review.</p>
      <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:20}}><button onClick={recommended} style={primary}>Начать рекомендуемую →</button>{resume&&<button onClick={resumeSession} style={ghost}>Продолжить незавершённую</button>}</div>
      <p style={{fontSize:13,color:COLORS.muted}}>На повтор сегодня: {dueCount}. Просроченные навыки всегда идут раньше новых.</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:12,marginTop:26}}>
        {V2_PATTERNS.map((p)=>{const pr=progress[p.id]; const due=pr&&new Date(pr.nextDueAt).getTime()<=Date.now(); return <button key={p.id} onClick={()=>startPattern(p.id)} style={patternCard}><div style={{display:'flex',justifyContent:'space-between',gap:8}}><span style={chip}>{due?'Повторить сегодня':pr?`Следующая проверка ${new Date(pr.nextDueAt).toLocaleDateString('ru-RU')}`:'Новый'}</span><span style={{fontSize:12,color:COLORS.muted}}>{p.level}</span></div><strong style={{display:'block',fontSize:18,color:COLORS.navy,marginTop:12}}>{p.name}</strong><span style={{display:'block',fontSize:13,color:COLORS.muted,lineHeight:1.5,marginTop:6}}>{p.meaning}</span><code style={{display:'block',marginTop:10,fontSize:12,color:'#475569'}}>{p.form}</code></button>})}
      </div>
      <div style={{...notice,marginTop:26}}><b>Что здесь проверяем:</b> может ли человек передать нужный смысл и самостоятельно выбрать нужную форму — а не просто повторить объявленную заранее конструкцию.</div>
    </div></main>
  }

  if (view === 'result') {
    const focus = attempts.filter((a)=>a.patternId===patternId)
    const independent = focus.filter((a)=>a.countsForMastery)
    const meaningFirst = focus.filter((a)=>a.firstAttempt && a.meaningScore===2).length
    const firstAttempts = focus.filter((a)=>a.firstAttempt && a.phase!=='free')
    const targetIndependent = firstAttempts.filter((a)=>a.outcome==='TARGET_INDEPENDENT').length
    const hints = focus.filter((a)=>a.hintLevel>0).length
    const free = focus.find((a)=>a.phase==='free')
    const delayed = focus.filter((a)=>a.phase==='delayed').at(-1)
    const pr=progress[patternId]
    return <main style={{...page,background:COLORS.navy,color:'white'}}><div style={shell}>
      <p style={{...kicker,color:'#fbbf24'}}>Сессия завершена · {focusPattern.name}</p>
      <h1 style={{...hero,color:'white'}}>Сегодня форма стала доступнее — или пока нет?</h1>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:12,marginTop:24}}>
        <div style={resultCard}><small>Смысл с первой попытки</small><strong>{meaningFirst}/{firstAttempts.length}</strong><span>сколько раз мысль была передана без повторной попытки</span></div>
        <div style={resultCard}><small>Нужная форма без подсказки</small><strong>{targetIndependent}/{firstAttempts.length}</strong><span>только independent attempts; supported retry сюда не входит</span></div>
        <div style={resultCard}><small>Blind / delayed probe</small><strong>{delayed?.outcome==='TARGET_INDEPENDENT'?'Получился':'Ещё не подтверждён'}</strong><span>это самый важный in-session сигнал</span></div>
        <div style={resultCard}><small>Помощь понадобилась</small><strong>{hints} раз</strong><span>подсказка — часть обучения, но не mastery evidence</span></div>
      </div>
      {free&&<div style={summary}><strong>Свободная речь</strong><p style={{margin:'8px 0 0',color:'#cbd5e1'}}>{free.targetScore===2?'Целевая форма появилась спонтанно в свободном ответе.':'Целевая форма в свободном ответе не появилась — и это не считается ошибкой: free task не заставляет использовать target.'}</p></div>}
      <div style={summary}><strong>{independent.length ? 'Есть независимые успешные попытки.' : 'Пока были в основном поддержанные попытки.'}</strong><p style={{margin:'8px 0 0',color:'#cbd5e1'}}>Сохранение навыка ещё не доказано. Следующая короткая проверка: {pr?new Date(pr.nextDueAt).toLocaleDateString('ru-RU'):'—'}.</p></div>
      <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:22}}><button onClick={()=>setView('library')} style={{...primary,background:COLORS.amber}}>Закончить</button><button onClick={()=>startPattern(patternId)} style={{...ghost,color:'white',borderColor:'#64748b'}}>Пройти ещё раз</button></div>
    </div></main>
  }

  if (!turn) return null
  const currentCopy = lastAttempt ? outcomeCopy(lastAttempt) : null
  const isResolved = !!lastAttempt && (lastAttempt.outcome==='TARGET_INDEPENDENT' || lastAttempt.outcome==='TARGET_SUPPORTED')
  const revealModel = !!lastAttempt && !isResolved && retryCount>=2
  const canRetry = !!lastAttempt && !isResolved && retryCount<2
  const label = turn.interleaved ? 'Короткое возвращение к прошлому навыку' : turn.free ? 'Свободная речь · target не обязателен' : reviewMode ? `Короткий повтор · ${drill?.phase}` : drill?.phase==='cold' ? 'Cold probe · без подсказки' : drill?.phase==='runway' ? 'Закрепление' : drill?.phase==='contrast' ? 'Contrast boundary' : drill?.phase==='transfer' ? 'Новый контекст' : drill?.phase==='delayed' ? 'Возврат после интерференции' : 'Varied retrieval'

  return <main style={page}><div style={shell}>
    <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',marginBottom:18}}><button onClick={()=>setView('library')} style={ghost}>← В библиотеку</button><div style={{textAlign:'right'}}><b>{turn.pattern.name}</b><div style={{fontSize:12,color:COLORS.muted}}>{turnIndex+1}/{turns.length}{reviewMode?' · review':''}</div></div></div>
    <div style={{height:5,background:'#eadfce',borderRadius:99,overflow:'hidden'}}><div style={{height:'100%',width:`${((turnIndex+1)/turns.length)*100}%`,background:COLORS.amber}}/></div>
    <p style={{...kicker,marginTop:26}}>{label}</p>
    {turn.free ? <><h1 style={{...hero,fontSize:'clamp(28px,6vw,44px)'}}>{turn.pattern.freePrompt}</h1><div style={notice}>Говори естественно. Мы лишь наблюдаем, появится ли target сам. Его отсутствие не считается ошибкой.</div></> : <><p style={{fontSize:16,color:COLORS.muted,lineHeight:1.55,marginTop:18}}>{drill?.scenario}</p><h1 style={{...hero,fontSize:'clamp(28px,6vw,44px)'}}>{drill?.prompt}</h1></>}

    {!lastAttempt && hintLevel>0 && drill && <div style={hintBox}><div style={small}>Подсказка {hintLevel}/2</div><p style={{margin:'7px 0 0'}}>{hintLevel===1 ? (retryCount===1 && turnAttempts.at(-1)?.meaningScore===2 ? turn.pattern.starterHint : drill.meaningHint) : turn.pattern.formHint}</p>{hintLevel===2&&<code style={{display:'block',marginTop:9,fontWeight:800}}>{turn.pattern.form}</code>}</div>}

    {!lastAttempt && <section style={{marginTop:26}}><button onClick={recording?stopVoice:startVoice} style={{...primary,background:recording?'#dc2626':COLORS.navy,color:'white',minWidth:220}}>{recording?'■ Остановить':'🎙 Ответить голосом'}</button>{!recording&&<button onClick={()=>setShowTyped((v)=>!v)} style={{...ghost,marginLeft:10}}>{showTyped?'Скрыть текст':'Или напечатать'}</button>}{showTyped&&<div style={{marginTop:14}}><textarea rows={4} value={typed} onChange={(e)=>setTyped(e.target.value)} placeholder="Your answer in English…" style={textarea}/><button onClick={submitTyped} disabled={!typed.trim()} style={{...primary,marginTop:9}}>Проверить</button></div>}{error&&<p style={{color:COLORS.red}}>{error}</p>}</section>}

    {lastAttempt&&currentCopy&&<section style={{marginTop:26}}><div style={quote}><div style={small}>Ты сказал</div><p style={{fontSize:19,margin:'7px 0 0'}}>“{lastAttempt.transcript}”</p></div><div style={{...card,borderLeft:`5px solid ${currentCopy.tone}`}}><strong>{currentCopy.title}</strong><p style={{margin:'8px 0 0',color:COLORS.muted,lineHeight:1.5}}>{currentCopy.body}</p><div style={{display:'flex',gap:14,flexWrap:'wrap',marginTop:10,fontSize:13,color:COLORS.muted}}><span>Смысл: {lastAttempt.meaningScore}/2</span><span>Target: {lastAttempt.targetScore}/2</span><span>{(lastAttempt.latencyMs/1000).toFixed(1)} с до начала</span></div></div>
      {canRetry&&drill&&<><div style={hintBox}><div style={small}>Следующий шаг — self-repair</div><p style={{margin:'7px 0 0'}}>{lastAttempt.meaningScore===2 ? turn.pattern.starterHint : drill.meaningHint}</p></div><button onClick={retry} style={{...primary,marginTop:14}}>Попробовать ещё раз →</button></>}
      {revealModel&&drill&&<div style={modelBox}><div style={small}>Теперь можно посмотреть модель</div><p style={{fontSize:19,fontWeight:800,margin:'8px 0'}}>“{drill.models[0]}”</p><p style={{margin:'6px 0'}}>Также естественно: “{drill.models[1]}”</p><code>{turn.pattern.form}</code><button onClick={advance} style={{...primary,display:'block',marginTop:15}}>Продолжить →</button></div>}
      {(isResolved || turn.free)&&<><div style={modelBox}>{drill&&<><div style={small}>После успешной попытки — ориентир, не единственный ответ</div><p style={{fontSize:19,fontWeight:800,margin:'8px 0'}}>“{drill.models[0]}”</p><p style={{margin:'6px 0'}}>Также естественно: “{drill.models[1]}”</p></>}</div><button onClick={advance} style={{...primary,marginTop:14}}>{turnIndex<turns.length-1?'Дальше →':'Показать итог →'}</button></>}
    </section>}
  </div></main>
}

const page: React.CSSProperties={minHeight:'100vh',background:COLORS.pale,color:COLORS.ink,fontFamily:'system-ui,-apple-system,sans-serif'}
const shell: React.CSSProperties={maxWidth:900,margin:'0 auto',padding:'42px 20px 72px'}
const kicker: React.CSSProperties={margin:0,textTransform:'uppercase',letterSpacing:1.2,color:COLORS.amber,fontWeight:850,fontSize:12}
const hero: React.CSSProperties={color:COLORS.navy,fontSize:'clamp(34px,7vw,56px)',lineHeight:1.08,margin:'10px 0 16px',letterSpacing:'-.02em'}
const lead: React.CSSProperties={fontSize:17,lineHeight:1.65,maxWidth:760}
const primary: React.CSSProperties={border:0,borderRadius:11,background:COLORS.amber,color:COLORS.navy,padding:'13px 18px',fontWeight:800,fontSize:15,cursor:'pointer'}
const ghost: React.CSSProperties={border:'1px solid #d6d3d1',borderRadius:10,background:'transparent',color:COLORS.muted,padding:'10px 13px',fontWeight:700,cursor:'pointer'}
const patternCard: React.CSSProperties={textAlign:'left',border:`1px solid ${COLORS.line}`,background:'white',borderRadius:15,padding:17,cursor:'pointer',fontFamily:'inherit'}
const chip: React.CSSProperties={display:'inline-block',borderRadius:999,padding:'4px 8px',fontSize:11,fontWeight:800,background:'#eef4ff',color:COLORS.navy}
const notice: React.CSSProperties={border:'1px solid #bfd3ff',background:'#eef4ff',borderRadius:13,padding:'14px 16px',lineHeight:1.55}
const hintBox: React.CSSProperties={marginTop:16,border:'1px solid #f5d487',background:'#fff7df',borderRadius:14,padding:16,lineHeight:1.5}
const modelBox: React.CSSProperties={marginTop:14,border:'1px solid #f5d487',background:'#fff7df',borderRadius:14,padding:17,lineHeight:1.5}
const quote: React.CSSProperties={background:'white',border:`1px solid ${COLORS.line}`,borderRadius:14,padding:17}
const card: React.CSSProperties={background:'white',border:`1px solid ${COLORS.line}`,borderRadius:14,padding:17,marginTop:12}
const small: React.CSSProperties={textTransform:'uppercase',letterSpacing:1,color:COLORS.muted,fontSize:11,fontWeight:850}
const textarea: React.CSSProperties={width:'100%',boxSizing:'border-box',borderRadius:10,border:'1px solid #d6d3d1',padding:12,fontSize:16,fontFamily:'inherit',resize:'vertical'}
const resultCard: React.CSSProperties={background:'#172554',borderRadius:14,padding:17,display:'grid',gap:8}
const summary: React.CSSProperties={marginTop:16,border:'1px solid #334155',background:'#111c3f',borderRadius:14,padding:18,lineHeight:1.6}
