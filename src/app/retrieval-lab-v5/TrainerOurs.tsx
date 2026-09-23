'use client'

import { useMemo, useRef, useState } from 'react'
import type { Pattern } from '../retrieval-lab/retrievalTypes'
import { ALL_PATTERNS } from './contrastSets'

type ErrorItem = {
  span?: string
  correction?: string
  severity?: 'minor' | 'important' | 'blocking'
  target_relevance?: 'inside_target' | 'off_target'
  message_ru?: string
}

type JudgeResult = {
  meaning_ok: boolean
  target_ok: boolean
  language_ok: boolean
  naturalness: 'natural' | 'acceptable' | 'marked' | 'unacceptable'
  errors: ErrorItem[]
  corrected_utterance?: string
  note_ru?: string
  evaluator_available: boolean
}

type AttemptRecord = {
  stepIndex: number
  answer: string
  targetOk: boolean
  meaningOk: boolean
  languageOk: boolean
  retryCount: number
  accepted: boolean
}

type Feedback = {
  kind: 'accept' | 'note' | 'retry' | 'technical'
  title: string
  body: string
  correction?: string
  retryRequired?: boolean
}

const css = `
:root{--navy:#101c3f;--amber:#f59e0b;--cream:#fff8ed;--ink:#14213d;--muted:#68758d;--line:#e8dece;--green:#16803d;--red:#b42318;--blue:#2563eb}*{box-sizing:border-box}.v5a{min-height:100vh;background:var(--cream);color:var(--ink);font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}.wrap{max-width:980px;margin:auto;padding:28px 20px 70px}.eyebrow{font-size:12px;font-weight:900;letter-spacing:1.2px;text-transform:uppercase;color:var(--amber)}h1{font-size:clamp(38px,6vw,62px);line-height:1.04;margin:10px 0 14px;color:var(--navy)}h2{color:var(--navy)}.lead{font-size:18px;line-height:1.55;color:var(--muted);max-width:820px}.tabs{display:flex;gap:9px;flex-wrap:wrap;margin:22px 0}.tab,.btn{border:0;border-radius:12px;padding:0 16px;font-size:15px;font-weight:850;cursor:pointer}.tab{height:44px;background:#fff;border:1px solid var(--line);color:var(--navy)}.tab.on{background:var(--navy);color:#fff}.btn{height:50px!important;min-height:50px!important;max-height:50px!important;width:auto!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;flex:0 0 auto!important;white-space:nowrap}.btn.primary{background:var(--amber);color:var(--navy)}.btn.dark{background:var(--navy);color:#fff}.btn.red{background:var(--red);color:#fff}.btn.ghost{background:transparent;border:1px solid #d7d3ca;color:var(--muted)}.section{margin-top:28px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px;align-items:start}.card,.panel{background:#fff;border:1px solid var(--line);border-radius:17px;padding:17px}.card{text-align:left;cursor:pointer;height:auto;min-height:0;align-self:start}.card:hover{transform:translateY(-1px);box-shadow:0 5px 18px rgba(16,28,63,.06)}.chip{display:inline-block;background:#edf4ff;color:var(--navy);padding:4px 9px;border-radius:999px;font-size:11px;font-weight:900}.card strong{display:block;margin-top:9px;font-size:18px;color:var(--navy)}.small{font-size:13px;line-height:1.45;color:var(--muted)}.top{display:flex;align-items:center;justify-content:space-between;gap:12px}.badge{background:#edf4ff;border-radius:999px;padding:6px 10px;font-size:12px;font-weight:900}.progress{height:7px;background:#e8dece;border-radius:999px;overflow:hidden;margin:20px 0 26px}.progress>div{height:100%;background:var(--amber)}.stage{font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:1px;color:var(--amber)}.cue{font-size:20px;color:var(--muted);line-height:1.5;margin-top:13px}.prompt{font-size:clamp(28px,5vw,44px);line-height:1.1;color:var(--navy);margin:9px 0 18px}.targetbox{background:#fff4d8;border:1px solid #f4cf76;border-radius:16px;padding:15px;margin:13px 0}.targetbox b{color:var(--navy)}.form{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:19px;margin-top:7px}.transcript{margin-top:16px;background:#f6f9ff;border:1px solid #bfd3ff;border-left:5px solid var(--blue);border-radius:16px;padding:16px;min-height:92px}.transcript b{color:var(--navy)}.heard{font-size:20px;line-height:1.45;margin-top:7px}.placeholder{color:#8b95a6}.actions{display:flex;gap:9px;flex-wrap:wrap;align-items:flex-start;margin-top:14px;min-height:0}.status{font-size:14px;font-weight:800;margin-top:8px}.status.red{color:var(--red)}.status.amber{color:#9a6700}textarea{width:100%;min-height:100px;border:1px solid #d6d3d1;border-radius:12px;padding:12px;font:inherit;background:#fff;resize:vertical}.feedback{margin-top:15px}.feedback.accept{border-left:5px solid var(--green)}.feedback.note{border-left:5px solid var(--blue)}.feedback.retry{border-left:5px solid var(--amber)}.feedback.technical{border-left:5px solid var(--red)}.feedback h3{margin:0 0 6px;color:var(--navy)}.models{background:#fff7df;border-color:#f4d182;margin-top:13px}.model{font-size:18px;line-height:1.45;margin-top:7px}.spinner{display:inline-block;width:15px;height:15px;border:2px solid #ddd;border-top-color:var(--navy);border-radius:50%;animation:spin .8s linear infinite;vertical-align:-2px;margin-right:7px}@keyframes spin{to{transform:rotate(360deg)}}.dark{min-height:100vh;background:var(--navy);color:#fff}.dark .wrap h1{color:#fff}.scorecard{margin-top:22px;background:#172858;border:1px solid #33456e;border-radius:20px;padding:7px 18px}.scorerow{display:flex;justify-content:space-between;gap:18px;padding:15px 0;border-bottom:1px solid rgba(255,255,255,.11)}.scorerow:last-child{border-bottom:0}.scorerow .desc{font-size:13px;color:#cbd5e1;margin-top:4px;line-height:1.4}.scorerow strong{font-size:23px;white-space:nowrap}.summary{margin-top:15px;border:1px solid #33456e;border-radius:17px;background:#13214c;padding:17px;line-height:1.55}@media(max-width:640px){.wrap{padding:20px 16px 54px}h1{font-size:34px}.lead{font-size:16px}.cue{font-size:18px}.prompt{font-size:32px}.targetbox,.transcript,.panel{padding:14px;border-radius:14px}.form{font-size:18px}.heard{font-size:19px}.btn{height:48px!important;min-height:48px!important;max-height:48px!important;padding:0 14px}.scorerow strong{font-size:21px}}
`

function cleanSpaces(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function mergeSpeech(baseRaw: string, nextRaw: string) {
  const base = cleanSpaces(baseRaw)
  const next = cleanSpaces(nextRaw)
  if (!base) return next
  if (!next) return base
  const a = base.toLowerCase()
  const b = next.toLowerCase()
  if (a === b) return base
  if (b.startsWith(a + ' ')) return next
  if (a.startsWith(b + ' ')) return base

  const aw = base.split(' ')
  const bw = next.split(' ')
  const max = Math.min(aw.length, bw.length)
  for (let n = max; n >= 1; n--) {
    const tail = aw.slice(-n).join(' ').toLowerCase()
    const head = bw.slice(0, n).join(' ').toLowerCase()
    if (tail === head) return [...aw, ...bw.slice(n)].join(' ')
  }
  return `${base} ${next}`
}

function norm(value: string) {
  return value.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9' ]/g, ' ').replace(/\s+/g, ' ').trim()
}

function parseJudge(text: string): JudgeResult | null {
  try {
    const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim()
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start < 0 || end < start) return null
    const data = JSON.parse(cleaned.slice(start, end + 1))
    return {
      meaning_ok: Boolean(data.meaning_ok),
      target_ok: Boolean(data.target_ok),
      language_ok: Boolean(data.language_ok),
      naturalness: ['natural', 'acceptable', 'marked', 'unacceptable'].includes(data.naturalness) ? data.naturalness : 'acceptable',
      errors: Array.isArray(data.errors) ? data.errors : [],
      corrected_utterance: typeof data.corrected_utterance === 'string' ? data.corrected_utterance : '',
      note_ru: typeof data.note_ru === 'string' ? data.note_ru : '',
      evaluator_available: true,
    }
  } catch {
    return null
  }
}

async function judgeAnswer(pattern: Pattern, cue: string, models: string[], answer: string): Promise<JudgeResult> {
  const n = norm(answer)
  if (models.some((m) => norm(m) === n)) {
    return { meaning_ok: true, target_ok: true, language_ok: true, naturalness: 'natural', errors: [], evaluator_available: true }
  }

  const system = `Evaluate a learner's spoken English. Return JSON only. Check three things independently: (1) does the sentence convey the requested meaning, including polarity/negation; (2) is the requested target structure correctly used; (3) is the English grammatically and lexically correct. Accept natural synonyms, pronouns, anaphora, ellipsis and word-order variation. Never mark a sentence wrong merely because it differs from the model. A wrong negation or reversed meaning must fail meaning_ok. Return: {"meaning_ok":true,"target_ok":true,"language_ok":true,"naturalness":"natural|acceptable|marked|unacceptable","errors":[{"span":"...","correction":"...","severity":"minor|important|blocking","target_relevance":"inside_target|off_target","message_ru":"коротко по-русски"}],"corrected_utterance":"...","note_ru":"..."}`
  const user = `TASK MEANING: ${cue}\nTARGET: ${pattern.form}\nTARGET FUNCTION: ${pattern.meaning}\nMODEL EXAMPLES: ${models.join(' | ')}\nLEARNER ANSWER: ${answer}`
  try {
    const res = await fetch('/api/lesson-eval', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ system, user }),
    })
    if (!res.ok) throw new Error('eval failed')
    const payload = await res.json()
    const parsed = parseJudge(String(payload.text || ''))
    if (parsed) return parsed
  } catch {}

  return { meaning_ok: false, target_ok: false, language_ok: false, naturalness: 'acceptable', errors: [], evaluator_available: false, note_ru: 'Не удалось запустить полную проверку.' }
}

export default function TrainerOurs() {
  const [category, setCategory] = useState('Все')
  const [pattern, setPattern] = useState<Pattern | null>(null)
  const [stepIndex, setStepIndex] = useState(0)
  const [retryCount, setRetryCount] = useState(0)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [records, setRecords] = useState<AttemptRecord[]>([])
  const [transcript, setTranscript] = useState('')
  const [voiceState, setVoiceState] = useState<'idle'|'starting'|'listening'>('idle')
  const [voiceMessage, setVoiceMessage] = useState('')
  const [typing, setTyping] = useState(false)
  const [typed, setTyped] = useState('')
  const [checking, setChecking] = useState(false)
  const [finished, setFinished] = useState(false)

  const recognitionRef = useRef<any>(null)
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout>|null>(null)
  const committedRef = useRef('')
  const latestRef = useRef('')
  const stoppedRef = useRef(false)

  const filtered = useMemo(() => category === 'Все' ? ALL_PATTERNS : ALL_PATTERNS.filter((p) => p.category === category), [category])
  const drills = pattern?.drills || []
  const current = drills[stepIndex]

  function clearTimer() {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    silenceTimerRef.current = null
  }

  function stopRecognition(abort = true) {
    stoppedRef.current = true
    clearTimer()
    try { abort ? recognitionRef.current?.abort?.() : recognitionRef.current?.stop?.() } catch {}
    recognitionRef.current = null
  }

  function resetVoice() {
    stopRecognition()
    committedRef.current = ''
    latestRef.current = ''
    setTranscript('')
    setVoiceState('idle')
    setVoiceMessage('')
  }

  function startPattern(p: Pattern) {
    setPattern(p); setStepIndex(0); setRetryCount(0); setFeedback(null); setRecords([]); setFinished(false); setTyped(''); setTyping(false); resetVoice()
  }

  function toLibrary() {
    resetVoice(); setPattern(null); setFinished(false); setFeedback(null); setRecords([])
  }

  function next() {
    resetVoice(); setFeedback(null); setRetryCount(0); setTyped(''); setTyping(false)
    if (stepIndex >= drills.length - 1) setFinished(true)
    else setStepIndex((n) => n + 1)
  }
  function makeFeedback(j: JudgeResult, targetOk: boolean): Feedback {
    const err = j.errors[0]
    const correction = j.corrected_utterance || err?.correction || ''
    if (!j.meaning_ok) return { kind:'retry', title:'Смысл нужно поправить', body: err?.message_ru || 'Фраза не передаёт нужную мысль полностью. Проверь, в том числе, отрицание и направление смысла.', correction, retryRequired: retryCount === 0 }
    if (!targetOk) return { kind:'retry', title:'Используй заданную конструкцию', body:`Сейчас тренируем именно: ${pattern?.form}.`, correction, retryRequired: retryCount === 0 }
    if (!j.language_ok && j.errors.length) return { kind: retryCount === 0 ? 'retry' : 'note', title: retryCount === 0 ? 'Есть языковая ошибка' : 'Принято после исправления', body: err?.message_ru || 'Исправь ошибку и скажи фразу ещё раз.', correction, retryRequired: retryCount === 0 }
    return { kind:'accept', title:'Принято', body:'Смысл передан, конструкция использована правильно, английский корректный.' }
  }

  async function submit(raw: string) {
    if (!pattern || !current || checking) return
    const answer = cleanSpaces(raw)
    if (!answer) return
    setChecking(true); setTranscript(answer); setVoiceState('idle')
    const structural = pattern.full.test(answer)
    const j = await judgeAnswer(pattern, current.cue, current.models, answer)
    if (!j.evaluator_available) {
      setFeedback({ kind:'technical', title:'Не удалось проверить ответ', body:'Транскрипция сохранена. Попробуй проверку ещё раз — говорить заново не нужно. Этот ответ пока не засчитывается.' })
      setChecking(false); return
    }
    const targetOk = structural || j.target_ok
    const fb = makeFeedback(j, targetOk)
    setRecords((r) => [...r, { stepIndex, answer, targetOk, meaningOk:j.meaning_ok, languageOk:j.language_ok, retryCount, accepted:!fb.retryRequired }])
    setFeedback(fb); setChecking(false)
  }

  function retry() {
    resetVoice(); setRetryCount((n) => n + 1); setFeedback(null); setTyped(''); setTyping(false)
  }

  function recheck() {
    if (!transcript || checking) return
    setFeedback(null); void submit(transcript)
  }

  function scheduleFinish() {
    clearTimer()
    silenceTimerRef.current = setTimeout(() => {
      const finalText = cleanSpaces(latestRef.current || committedRef.current)
      stoppedRef.current = true
      try { recognitionRef.current?.stop?.() } catch {}
      recognitionRef.current = null
      setVoiceState('idle')
      if (finalText) void submit(finalText)
    }, 1800)
  }

  function startVoice() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { setVoiceMessage('В этом браузере голосовое распознавание недоступно. Используй ввод текста.'); setTyping(true); return }

    resetVoice()
    stoppedRef.current = false
    committedRef.current = ''
    latestRef.current = ''
    setVoiceState('starting')

    const launch = () => {
      if (stoppedRef.current) return
      const rec = new SR()
      recognitionRef.current = rec
      rec.lang = 'en-US'
      rec.continuous = true
      rec.interimResults = true
      rec.maxAlternatives = 1

      rec.onstart = () => setVoiceState('listening')
      rec.onresult = (event: any) => {
        let finalChunk = ''
        let interimChunk = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const t = cleanSpaces(event.results[i][0]?.transcript || '')
          if (!t) continue
          if (event.results[i].isFinal) finalChunk = mergeSpeech(finalChunk, t)
          else interimChunk = mergeSpeech(interimChunk, t)
        }

        if (finalChunk) committedRef.current = mergeSpeech(committedRef.current, finalChunk)
        latestRef.current = mergeSpeech(committedRef.current, interimChunk)
        if (!latestRef.current) latestRef.current = committedRef.current
        setTranscript(latestRef.current)
        if (finalChunk || interimChunk) scheduleFinish()
      }

      rec.onerror = (event: any) => {
        if (event?.error === 'not-allowed') {
          stoppedRef.current = true; clearTimer(); setVoiceState('idle'); setVoiceMessage('Нет доступа к микрофону. Разреши микрофон для этого сайта.'); return
        }
        if (event?.error !== 'no-speech') setVoiceMessage('Не удалось распознать речь. Попробуй ещё раз.')
      }

      rec.onend = () => {
        if (stoppedRef.current) { setVoiceState('idle'); return }
        setTimeout(() => { if (!stoppedRef.current) launch() }, 120)
      }

      try { rec.start() } catch { setVoiceState('idle'); setVoiceMessage('Не удалось включить микрофон. Попробуй ещё раз.') }
    }

    launch()
  }

  function finishNow() {
    const finalText = cleanSpaces(latestRef.current || committedRef.current || transcript)
    stoppedRef.current = true; clearTimer(); try { recognitionRef.current?.stop?.() } catch {}; recognitionRef.current = null; setVoiceState('idle')
    if (finalText) void submit(finalText)
  }

  if (!pattern && !finished) return <div className="v5a"><style>{css}</style><div className="wrap">
    <div className="eyebrow">Версия A · прямой тренажёр</div><h1>30 конструкций. Формула видна сразу.</h1>
    <p className="lead">Нужная конструкция показана заранее. Твоя задача — быстро построить через неё правильную и естественную фразу. Система проверяет смысл, форму и английский.</p>
    <div className="tabs">{['Все','Времена и aspect','Модальность','Разговорные конструкции'].map((x)=><button key={x} className={`tab ${category===x?'on':''}`} onClick={()=>setCategory(x)}>{x}</button>)}</div>
    {['Времена и aspect','Модальность','Разговорные конструкции'].map((cat)=>{ const items=filtered.filter((p)=>p.category===cat); if(!items.length)return null; return <div className="section" key={cat}><h2>{cat}</h2><div className="grid">{items.map((p)=><button key={p.id} className="card" onClick={()=>startPattern(p)}><span className="chip">{p.level}</span><strong>{p.name}</strong><div className="small" style={{marginTop:6}}>{p.form}</div><div className="small" style={{marginTop:6}}>{p.meaning}</div></button>)}</div></div>})}
  </div></div>

  if (finished && pattern) {
    const first = drills.map((_,i)=>records.find((r)=>r.stepIndex===i && r.retryCount===0)).filter(Boolean) as AttemptRecord[]
    const d = first.length || 1
    const perfect = first.filter((r)=>r.accepted&&r.meaningOk&&r.targetOk&&r.languageOk).length
    const meaning = first.filter((r)=>r.meaningOk).length
    const target = first.filter((r)=>r.targetOk).length
    const lang = first.filter((r)=>r.languageOk).length
    return <div className="v5a dark"><style>{css}</style><div className="wrap"><div className="eyebrow">Итог тренировки</div><h1>{pattern.name}</h1>
      <div className="scorecard">
        <div className="scorerow"><div><div>Полностью с первого раза</div><div className="desc">смысл, конструкция и английский сразу без исправления</div></div><strong>{perfect}/{d}</strong></div>
        <div className="scorerow"><div><div>Смысл с первого раза</div><div className="desc">нужная мысль была передана сразу</div></div><strong>{meaning}/{d}</strong></div>
        <div className="scorerow"><div><div>Конструкция с первого раза</div><div className="desc">форма была собрана правильно сразу</div></div><strong>{target}/{d}</strong></div>
        <div className="scorerow"><div><div>Без языковых ошибок с первого раза</div><div className="desc">грамматика и лексика не требовали исправления</div></div><strong>{lang}/{d}</strong></div>
      </div><div className="summary">Здесь считаются именно первые попытки. Исправленные повторы не превращают исходную ошибку в правильную первую попытку.</div><div className="actions"><button className="btn primary" onClick={toLibrary}>К библиотеке</button></div>
    </div></div>
  }

  if (!pattern || !current) return null
  const progress=((stepIndex+1)/drills.length)*100
  const label=voiceState==='starting'?'● Подключаю микрофон…':voiceState==='listening'?'■ Слушаю — говори':'🎙 Ответить голосом'

  return <div className="v5a"><style>{css}</style><div className="wrap">
    <div className="top"><button className="btn ghost" onClick={toLibrary}>← Библиотека</button><span className="badge">{stepIndex+1}/{drills.length}</span></div>
    <div className="progress"><div style={{width:`${progress}%`}}/></div><div className="stage">Тренировка конструкции</div><div className="cue">{current.cue}</div><div className="prompt">Скажи это по-английски.</div>
    <div className="targetbox"><b>Используй в ответе</b><div className="form">{pattern.form}</div><div className="small" style={{marginTop:7}}>{pattern.meaning}</div></div>
    <div className="transcript"><b>Что распознала система</b><div className={transcript?'heard':'placeholder'}>{transcript?`“${transcript}”`:voiceState==='starting'?'Подключаю микрофон… Пока не говори.':voiceState==='listening'?'Слушаю. Можно спокойно сделать короткую паузу или вдох.':'После ответа здесь будет транскрипция.'}</div></div>
    {checking&&<div className="panel" style={{marginTop:14}}><span className="spinner"/>Проверяю смысл, конструкцию и английский…</div>}
    {!checking&&feedback?<>
      <div className={`panel feedback ${feedback.kind}`}><h3>{feedback.title}</h3><div>{feedback.body}</div>{feedback.correction&&<div style={{marginTop:8}}><b>Правильно:</b> {feedback.correction}</div>}</div>
      {feedback.kind==='technical'?<div className="actions"><button className="btn primary" onClick={recheck}>Проверить ещё раз</button><button className="btn ghost" onClick={next}>Продолжить без зачёта</button></div>:feedback.retryRequired?<div className="actions"><button className="btn primary" onClick={retry}>Исправить и сказать ещё раз →</button></div>:<><div className="panel models"><b>Хороший вариант</b><div className="model">{current.models[0]}</div>{current.models[1]&&<div className="model">Также естественно: {current.models[1]}</div>}</div><div className="actions"><button className="btn primary" onClick={next}>{stepIndex===drills.length-1?'Показать итог':'Дальше →'}</button><button className="btn ghost" onClick={retry}>Распознано неверно? Записать заново</button></div></>}
    </>:!checking?<><div className="actions"><button className={`btn ${voiceState==='idle'?'dark':'red'}`} onClick={()=>voiceState==='idle'?startVoice():finishNow()}>{label}</button><button className="btn ghost" onClick={()=>setTyping((v)=>!v)}>Или напечатать</button></div>{voiceState==='starting'&&<div className="status amber">Пока не говори. Дождись «Слушаю — говори».</div>}{voiceState==='listening'&&<div className="status red">Микрофон включён. После последней речи ждём около 1,8 секунды.</div>}{voiceMessage&&<div className="status red">{voiceMessage}</div>}{typing&&<div style={{marginTop:13}}><textarea value={typed} onChange={(e)=>setTyped(e.target.value)} placeholder="Your answer…"/><div className="actions"><button className="btn primary" onClick={()=>submit(typed)}>Проверить</button></div></div>}</>:null}
  </div></div>
}