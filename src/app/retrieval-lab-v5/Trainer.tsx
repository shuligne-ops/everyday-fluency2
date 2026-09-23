'use client'

import { useMemo, useRef, useState } from 'react'
import type { Pattern } from '../retrieval-lab/retrievalTypes'
import { ALL_PATTERNS, CONTRAST_SETS, getPattern, type ContrastSet } from './contrastSets'

type Mode = 'ours' | 'colleague'

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

type StepPhase = 'visible' | 'cold' | 'anchor' | 'fade' | 'contrast' | 'delayed'

type Step = {
  pattern: Pattern
  drillIndex: number
  phase: StepPhase
  targetVisible: boolean
  candidatePatterns?: Pattern[]
  anchorExample?: string
  hiddenSelection?: boolean
}

type AttemptRecord = {
  stepIndex: number
  phase: StepPhase
  patternId: string
  answer: string
  structuralTarget: boolean
  targetOk: boolean
  meaningOk: boolean
  languageOk: boolean
  naturalness: JudgeResult['naturalness']
  retryCount: number
  accepted: boolean
  selectionSuccess: boolean
  latencyMs: number
  errors: ErrorItem[]
}

type Feedback = {
  kind: 'accept' | 'note' | 'retry' | 'technical'
  title: string
  body: string
  correction?: string
  retryRequired?: boolean
}

const css = `
:root{--navy:#101c3f;--navy2:#1b2b60;--amber:#f59e0b;--cream:#fff8ed;--ink:#14213d;--muted:#68758d;--line:#e8dece;--green:#16803d;--red:#b42318;--blue:#2563eb}*{box-sizing:border-box}.v5{min-height:100vh;background:var(--cream);color:var(--ink);font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}.wrap{max-width:1080px;margin:auto;padding:30px 22px 72px}.eyebrow{font-size:12px;font-weight:900;letter-spacing:1.25px;text-transform:uppercase;color:var(--amber)}h1{font-size:clamp(38px,6.5vw,66px);line-height:1.03;margin:10px 0 14px;color:var(--navy)}h2{color:var(--navy)}.lead{font-size:18px;line-height:1.6;color:var(--muted);max-width:880px}.tabs{display:flex;gap:10px;flex-wrap:wrap;margin:24px 0}.tab,.btn{border:0;border-radius:12px;padding:13px 17px;font-size:15px;font-weight:850;cursor:pointer}.tab{background:#fff;border:1px solid var(--line);color:var(--navy)}.tab.on{background:var(--navy);color:#fff}.btn.primary{background:var(--amber);color:var(--navy)}.btn.dark{background:var(--navy);color:#fff}.btn.red{background:var(--red);color:#fff}.btn.ghost{background:transparent;border:1px solid #d7d3ca;color:var(--muted)}.btn:disabled{opacity:.55;cursor:default}.section{margin-top:30px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(275px,1fr));gap:13px}.card,.panel{background:#fff;border:1px solid var(--line);border-radius:18px;padding:19px}.card{text-align:left;cursor:pointer}.card:hover{transform:translateY(-1px)}.chip{display:inline-block;background:#edf4ff;color:var(--navy);padding:4px 9px;border-radius:999px;font-size:11px;font-weight:900}.card strong{display:block;margin-top:10px;font-size:19px;color:var(--navy)}.small{font-size:13px;line-height:1.45;color:var(--muted)}.top{display:flex;align-items:center;justify-content:space-between;gap:14px}.badge{background:#edf4ff;border-radius:999px;padding:6px 10px;font-size:12px;font-weight:900}.progress{height:8px;background:#e8dece;border-radius:999px;overflow:hidden;margin:22px 0 32px}.progress>div{height:100%;background:var(--amber)}.stage{font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:1px;color:var(--amber)}.cue{font-size:20px;color:var(--muted);line-height:1.5;margin-top:14px}.prompt{font-size:clamp(28px,5vw,46px);line-height:1.1;color:var(--navy);margin:10px 0 20px}.targetbox{background:#fff4d8;border:1px solid #f4cf76;border-radius:16px;padding:16px;margin:14px 0}.targetbox b{color:var(--navy)}.form{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:19px;margin-top:7px}.candidates{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.candidate{background:#eef4ff;border-radius:999px;padding:7px 10px;font-size:13px}.transcript{margin-top:17px;background:#f6f9ff;border:1px solid #bfd3ff;border-left:5px solid var(--blue);border-radius:16px;padding:17px;min-height:96px}.transcript b{color:var(--navy)}.transcript .heard{font-size:21px;line-height:1.45;margin-top:7px}.placeholder{color:#8b95a6}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:15px}.status{font-size:14px;font-weight:800;margin-top:9px}.status.red{color:var(--red)}.status.amber{color:#9a6700}textarea{width:100%;min-height:105px;border:1px solid #d6d3d1;border-radius:12px;padding:12px;font:inherit;background:white;resize:vertical}.feedback{margin-top:16px}.feedback.accept{border-left:5px solid var(--green)}.feedback.note{border-left:5px solid var(--blue)}.feedback.retry{border-left:5px solid var(--amber)}.feedback.technical{border-left:5px solid var(--red)}.feedback h3{margin:0 0 6px;color:var(--navy)}.models{background:#fff7df;border-color:#f4d182;margin-top:14px}.models .model{font-size:18px;line-height:1.45;margin-top:7px}.dark{min-height:100vh;background:var(--navy);color:#fff}.dark .wrap h1{color:white}.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:13px;margin-top:22px}.metric{background:var(--navy2);border-radius:17px;padding:18px}.metric strong{display:block;font-size:34px;margin:7px 0}.metric span{color:#d7dfef;font-size:14px;line-height:1.4}.summary{margin-top:16px;border:1px solid #33456e;border-radius:17px;background:#13214c;padding:18px;line-height:1.6}.compare-note{background:#fff;border:1px solid var(--line);border-radius:17px;padding:17px;margin-top:18px}.spinner{display:inline-block;width:15px;height:15px;border:2px solid #ddd;border-top-color:var(--navy);border-radius:50%;animation:spin .8s linear infinite;vertical-align:-2px;margin-right:7px}@keyframes spin{to{transform:rotate(360deg)}}
`

function phaseLabel(step: Step, mode: Mode) {
  if (mode === 'ours') return 'Тренировка конструкции'
  if (step.phase === 'cold') return 'Первая проверка без подсказки'
  if (step.phase === 'anchor') return 'Связываем форму со смыслом'
  if (step.phase === 'visible') return 'Собираем форму с опорой'
  if (step.phase === 'fade') return 'Пробуем без видимой формулы'
  if (step.phase === 'contrast') return 'Выбираем подходящую конструкцию'
  return 'Проверка после других примеров'
}

function buildColleagueSteps(set: ContrastSet): Step[] {
  const [a, b, c] = set.patternIds.map(getPattern)
  const candidates = [a, b, c]
  return [
    { pattern: a, drillIndex: 0, phase: 'cold', targetVisible: false, hiddenSelection: true },
    { pattern: a, drillIndex: 1, phase: 'anchor', targetVisible: true, anchorExample: a.drills[0].models[0] },
    { pattern: a, drillIndex: 2, phase: 'visible', targetVisible: true },
    { pattern: a, drillIndex: 3, phase: 'fade', targetVisible: false, hiddenSelection: true },
    { pattern: b, drillIndex: 0, phase: 'contrast', targetVisible: false, candidatePatterns: candidates, hiddenSelection: true },
    { pattern: c, drillIndex: 0, phase: 'contrast', targetVisible: false, candidatePatterns: candidates, hiddenSelection: true },
    { pattern: b, drillIndex: 1, phase: 'contrast', targetVisible: false, candidatePatterns: candidates, hiddenSelection: true },
    { pattern: a, drillIndex: 4, phase: 'delayed', targetVisible: false, hiddenSelection: true },
  ]
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
  const system = `You evaluate spoken English practice. Return JSON only. Be strict about real grammar and meaning, but NEVER reject a correct synonym, anaphora (there/it/one/them), ellipsis, or a natural rephrasing merely because it differs from the model answer. Judge the learner's actual sentence, not style preference.\n\nReturn exactly this shape:\n{\n  "meaning_ok": true,\n  "target_ok": true,\n  "language_ok": true,\n  "naturalness": "natural|acceptable|marked|unacceptable",\n  "errors": [{"span":"...","correction":"...","severity":"minor|important|blocking","target_relevance":"inside_target|off_target","message_ru":"короткое объяснение по-русски"}],\n  "corrected_utterance":"...",\n  "note_ru":"..."\n}\n\nmeaning_ok means the requested communicative meaning is conveyed. target_ok means the requested target form is correctly realized. language_ok is false only for a real language error, not because another wording would be nicer.`
  const user = `TASK CUE (Russian meaning): ${cue}\nTARGET: ${pattern.form}\nTARGET FUNCTION: ${pattern.meaning}\nACCEPTABLE MODEL EXAMPLES: ${models.join(' | ')}\nLEARNER ANSWER: ${answer}`
  try {
    const res = await fetch('/api/lesson-eval', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system, user }),
    })
    if (!res.ok) throw new Error('eval failed')
    const payload = await res.json()
    const parsed = parseJudge(String(payload.text || ''))
    if (parsed) return parsed
  } catch {
    // fall through to conservative local fallback
  }
  const structural = pattern.full.test(answer)
  return {
    meaning_ok: true,
    target_ok: structural,
    language_ok: true,
    naturalness: 'acceptable',
    errors: [],
    corrected_utterance: '',
    note_ru: 'AI-проверка временно недоступна; использована только проверка конструкции.',
    evaluator_available: false,
  }
}

function highestSeverity(errors: ErrorItem[]) {
  if (errors.some((e) => e.severity === 'blocking')) return 'blocking'
  if (errors.some((e) => e.severity === 'important')) return 'important'
  if (errors.some((e) => e.severity === 'minor')) return 'minor'
  return null
}

export default function Trainer({ mode }: { mode: Mode }) {
  const [category, setCategory] = useState('Все')
  const [pattern, setPattern] = useState<Pattern | null>(null)
  const [contrastSet, setContrastSet] = useState<ContrastSet | null>(null)
  const [steps, setSteps] = useState<Step[]>([])
  const [stepIndex, setStepIndex] = useState(0)
  const [retryCount, setRetryCount] = useState(0)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [records, setRecords] = useState<AttemptRecord[]>([])
  const [transcript, setTranscript] = useState('')
  const [interim, setInterim] = useState('')
  const [voiceState, setVoiceState] = useState<'idle' | 'starting' | 'listening'>('idle')
  const [voiceMessage, setVoiceMessage] = useState('')
  const [typing, setTyping] = useState(false)
  const [typed, setTyped] = useState('')
  const [checking, setChecking] = useState(false)
  const [revealTarget, setRevealTarget] = useState(false)
  const [finished, setFinished] = useState(false)
  const recognitionRef = useRef<any>(null)
  const stepStartedRef = useRef(Date.now())

  const filteredPatterns = useMemo(() => {
    if (category === 'Все') return ALL_PATTERNS
    return ALL_PATTERNS.filter((p) => p.category === category)
  }, [category])

  const currentStep = steps[stepIndex]
  const currentDrill = currentStep ? currentStep.pattern.drills[currentStep.drillIndex] : null

  function resetInput() {
    try { recognitionRef.current?.abort?.() } catch {}
    recognitionRef.current = null
    setTranscript('')
    setInterim('')
    setVoiceState('idle')
    setVoiceMessage('')
    setTyping(false)
    setTyped('')
    setChecking(false)
    setFeedback(null)
    setRevealTarget(false)
    setRetryCount(0)
    stepStartedRef.current = Date.now()
  }

  function startOurs(p: Pattern) {
    setPattern(p)
    setContrastSet(null)
    setSteps(p.drills.map((_, i) => ({ pattern: p, drillIndex: i, phase: 'visible' as const, targetVisible: true })))
    setStepIndex(0)
    setRecords([])
    setFinished(false)
    resetInput()
  }

  function startColleague(set: ContrastSet) {
    setContrastSet(set)
    setPattern(null)
    setSteps(buildColleagueSteps(set))
    setStepIndex(0)
    setRecords([])
    setFinished(false)
    resetInput()
  }

  function backToLibrary() {
    try { recognitionRef.current?.abort?.() } catch {}
    setPattern(null)
    setContrastSet(null)
    setSteps([])
    setFinished(false)
    setFeedback(null)
    setTranscript('')
  }

  function nextStep() {
    if (stepIndex >= steps.length - 1) {
      setFinished(true)
      return
    }
    setStepIndex((n) => n + 1)
    setRetryCount(0)
    setFeedback(null)
    setTranscript('')
    setInterim('')
    setVoiceMessage('')
    setTyping(false)
    setTyped('')
    setRevealTarget(false)
    stepStartedRef.current = Date.now()
  }

  function makeFeedback(step: Step, judge: JudgeResult, targetOk: boolean, attempt: number): Feedback {
    const severity = highestSeverity(judge.errors)
    const firstError = judge.errors[0]
    const correction = judge.corrected_utterance || firstError?.correction || ''

    if (!judge.meaning_ok) {
      return {
        kind: 'retry',
        title: 'Смысл нужно поправить',
        body: 'Фраза пока не передаёт нужную мысль полностью. Скажи именно то, что требует ситуация.',
        correction,
        retryRequired: attempt === 0,
      }
    }

    if (mode === 'ours') {
      if (!targetOk) {
        return {
          kind: 'retry',
          title: 'Используй заданную конструкцию',
          body: `Смысл понятен, но сейчас мы тренируем именно: ${step.pattern.form}.`,
          correction,
          retryRequired: attempt === 0,
        }
      }
      if (!judge.language_ok && judge.errors.length) {
        return {
          kind: attempt === 0 ? 'retry' : 'note',
          title: attempt === 0 ? 'Есть реальная языковая ошибка' : 'Принято после исправления',
          body: firstError?.message_ru || 'Исправь ошибку и скажи фразу ещё раз.',
          correction,
          retryRequired: attempt === 0,
        }
      }
      return {
        kind: 'accept',
        title: 'Принято',
        body: 'Нужный смысл передан, конструкция использована правильно, английский корректный.',
      }
    }

    const visibleBuild = step.phase === 'anchor' || step.phase === 'visible'
    const targetErrorInside = judge.errors.some((e) => e.target_relevance === 'inside_target')
    if (visibleBuild && !targetOk) {
      return {
        kind: attempt === 0 ? 'retry' : 'note',
        title: attempt === 0 ? 'Сейчас строим именно эту форму' : 'Зафиксировали уровень помощи',
        body: `На этом этапе цель — правильно собрать ${step.pattern.form}.`,
        correction,
        retryRequired: attempt === 0,
      }
    }
    if (!judge.language_ok && (severity === 'blocking' || severity === 'important' || targetErrorInside)) {
      return {
        kind: attempt === 0 ? 'retry' : 'note',
        title: attempt === 0 ? 'Исправь это и повтори один раз' : 'Идём дальше',
        body: firstError?.message_ru || 'Ошибка мешает форме или смыслу.',
        correction,
        retryRequired: attempt === 0,
      }
    }
    if (!judge.language_ok && severity === 'minor') {
      return {
        kind: 'note',
        title: 'Принято. Небольшая правка',
        body: firstError?.message_ru || 'Есть небольшая побочная ошибка, но повторять всю реплику не нужно.',
        correction,
      }
    }
    if (step.hiddenSelection && !targetOk) {
      return {
        kind: 'note',
        title: 'Смысл передан',
        body: `Фраза работает, но ${step.pattern.form} самостоятельно не активировалась. Это записываем как промах выбора, без принудительного повтора.`,
      }
    }
    return {
      kind: 'accept',
      title: 'Принято',
      body: step.hiddenSelection ? 'Смысл передан, и нужная форма появилась без показа.' : 'Смысл и форма получились.',
    }
  }

  async function submit(raw: string) {
    if (!currentStep || !currentDrill || checking) return
    const answer = raw.trim()
    if (!answer) return
    setChecking(true)
    setTranscript(answer)
    setInterim('')
    setVoiceState('idle')
    const structuralTarget = currentStep.pattern.full.test(answer)
    const judge = await judgeAnswer(currentStep.pattern, currentDrill.cue, currentDrill.models, answer)
    const targetOk = structuralTarget || judge.target_ok
    const fb = makeFeedback(currentStep, judge, targetOk, retryCount)
    const accepted = !fb.retryRequired
    const selectionSuccess = currentStep.hiddenSelection ? targetOk : true
    const record: AttemptRecord = {
      stepIndex,
      phase: currentStep.phase,
      patternId: currentStep.pattern.id,
      answer,
      structuralTarget,
      targetOk,
      meaningOk: judge.meaning_ok,
      languageOk: judge.language_ok,
      naturalness: judge.naturalness,
      retryCount,
      accepted,
      selectionSuccess,
      latencyMs: Math.max(0, Date.now() - stepStartedRef.current),
      errors: judge.errors,
    }
    setRecords((r) => [...r, record])
    setFeedback({ ...fb, body: judge.evaluator_available ? fb.body : `${fb.body} ${judge.note_ru || ''}` })
    setChecking(false)
  }

  function retry() {
    setRetryCount((n) => n + 1)
    setFeedback(null)
    setTranscript('')
    setInterim('')
    setVoiceMessage('')
    setTyping(false)
    setTyped('')
    if (mode === 'colleague' && currentStep && !currentStep.targetVisible) setRevealTarget(true)
    stepStartedRef.current = Date.now()
  }

  function startVoice() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      setVoiceMessage('В этом браузере голосовое распознавание недоступно. Используй ввод текста.')
      setTyping(true)
      return
    }
    try { recognitionRef.current?.abort?.() } catch {}
    const rec = new SR()
    recognitionRef.current = rec
    rec.lang = 'en-US'
    rec.continuous = false
    rec.interimResults = true
    rec.maxAlternatives = 1
    setTranscript('')
    setInterim('')
    setVoiceMessage('')
    setVoiceState('starting')
    rec.onstart = () => setVoiceState('listening')
    rec.onresult = (event: any) => {
      let interimText = ''
      let finalText = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0]?.transcript || ''
        if (event.results[i].isFinal) finalText += text
        else interimText += text
      }
      if (interimText) setInterim(interimText)
      if (finalText.trim()) {
        const finalValue = finalText.trim()
        setTranscript(finalValue)
        setInterim('')
        setVoiceState('idle')
        setTimeout(() => submit(finalValue), 120)
      }
    }
    rec.onerror = (event: any) => {
      setVoiceState('idle')
      setVoiceMessage(event?.error === 'not-allowed' ? 'Нет доступа к микрофону. Разреши микрофон для этого сайта.' : 'Не удалось распознать речь. Попробуй ещё раз.')
    }
    rec.onend = () => setVoiceState('idle')
    rec.start()
  }

  if (!pattern && !contrastSet && !finished) {
    return (
      <div className="v5">
        <style>{css}</style>
        <div className="wrap">
          <div className="eyebrow">{mode === 'ours' ? 'Версия A · прямой тренажёр' : 'Версия B · Contrastive Activation Ladder'}</div>
          <h1>{mode === 'ours' ? '30 конструкций. Target виден всегда.' : '10 contrast sets. Подсказка постепенно исчезает.'}</h1>
          <p className="lead">
            {mode === 'ours'
              ? 'Моя версия: ученик не угадывает педагогическое намерение. Формула показана заранее, а система тренирует быстрое и правильное построение разных фраз через неё. Реальная языковая ошибка вызывает одно исправление и повтор.'
              : 'Версия по логике коллеги: сначала проверяем исходный выбор формы, затем показываем опору, после двух сборок убираем её и смешиваем соседние конструкции. Хороший английский другой формой не наказывается — это записывается как selection miss.'}
          </p>
          {mode === 'ours' ? (
            <>
              <div className="tabs">
                {['Все', 'Времена и aspect', 'Модальность', 'Разговорные конструкции'].map((item) => (
                  <button key={item} className={`tab ${category === item ? 'on' : ''}`} onClick={() => setCategory(item)}>{item}</button>
                ))}
              </div>
              {['Времена и aspect', 'Модальность', 'Разговорные конструкции'].map((cat) => {
                const items = filteredPatterns.filter((p) => p.category === cat)
                if (!items.length) return null
                return <div className="section" key={cat}><h2>{cat}</h2><div className="grid">{items.map((p) => (
                  <button className="card" key={p.id} onClick={() => startOurs(p)}>
                    <span className="chip">{p.level}</span><strong>{p.name}</strong><div className="small" style={{ marginTop: 7 }}>{p.form}</div><div className="small" style={{ marginTop: 7 }}>{p.meaning}</div>
                  </button>
                ))}</div></div>
              })}
            </>
          ) : (
            <div className="grid" style={{ marginTop: 26 }}>{CONTRAST_SETS.map((set) => (
              <button className="card" key={set.id} onClick={() => startColleague(set)}>
                <span className="chip">3 формы · 8 шагов</span><strong>{set.title}</strong><div className="small" style={{ marginTop: 7 }}>{set.subtitle}</div>
              </button>
            ))}</div>
          )}
        </div>
      </div>
    )
  }

  if (finished) {
    const lastByStep = steps.map((_, i) => [...records].reverse().find((r) => r.stepIndex === i)).filter(Boolean) as AttemptRecord[]
    const firstTry = lastByStep.filter((r) => r.retryCount === 0 && r.accepted).length
    const hidden = lastByStep.filter((r) => ['cold', 'fade', 'contrast', 'delayed'].includes(r.phase))
    const selection = hidden.filter((r) => r.selectionSuccess).length
    const functional = lastByStep.filter((r) => r.meaningOk).length
    const languageClean = lastByStep.filter((r) => r.languageOk).length
    return (
      <div className="v5 dark">
        <style>{css}</style>
        <div className="wrap">
          <div className="eyebrow">Итог экспериментальной сессии</div>
          <h1>{mode === 'ours' ? pattern?.name : contrastSet?.title}</h1>
          <div className="metrics">
            <div className="metric"><div>С первого раза</div><strong>{firstTry}/{steps.length}</strong><span>без принудительного исправления</span></div>
            <div className="metric"><div>Смысл передан</div><strong>{functional}/{steps.length}</strong><span>коммуникативная задача выполнена</span></div>
            <div className="metric"><div>Без языковой ошибки</div><strong>{languageClean}/{steps.length}</strong><span>по финальной попытке каждого шага</span></div>
            {mode === 'colleague' && <div className="metric"><div>Форма выбрана без показа</div><strong>{selection}/{hidden.length || 1}</strong><span>отдельно от общей успешности фразы</span></div>}
          </div>
          <div className="summary">
            {mode === 'ours'
              ? 'Эта версия измеряет execution: можешь ли ты, зная нужную конструкцию, быстро собрать через неё правильную фразу в разных контекстах.'
              : 'Эта версия разводит functional success и selection: хорошая фраза может быть принята даже тогда, когда нужная форма сама не активировалась.'}
          </div>
          <div className="actions"><button className="btn primary" onClick={backToLibrary}>К библиотеке</button></div>
        </div>
      </div>
    )
  }

  if (!currentStep || !currentDrill) return null

  const showTarget = currentStep.targetVisible || revealTarget
  const liveText = interim || transcript
  const progress = ((stepIndex + 1) / steps.length) * 100
  const label = voiceState === 'starting' ? '● Подключаю микрофон…' : voiceState === 'listening' ? '■ Слушаю — говори' : '🎙 Ответить голосом'

  return (
    <div className="v5">
      <style>{css}</style>
      <div className="wrap">
        <div className="top"><button className="btn ghost" onClick={backToLibrary}>← Библиотека</button><span className="badge">{stepIndex + 1}/{steps.length}</span></div>
        <div className="progress"><div style={{ width: `${progress}%` }} /></div>
        <div className="stage">{phaseLabel(currentStep, mode)}</div>
        <div className="cue">{currentDrill.cue}</div>
        <div className="prompt">Скажи это по-английски.</div>

        {mode === 'ours' && <div className="targetbox"><b>Используй в ответе</b><div className="form">{currentStep.pattern.form}</div><div className="small" style={{ marginTop: 7 }}>{currentStep.pattern.meaning}</div></div>}

        {mode === 'colleague' && currentStep.phase === 'anchor' && <div className="targetbox"><b>Опора</b><div className="form">{currentStep.pattern.form}</div><div className="small" style={{ marginTop: 7 }}>Пример связи формы со смыслом: {currentStep.anchorExample}</div></div>}
        {mode === 'colleague' && currentStep.phase === 'visible' && <div className="targetbox"><b>Используй в ответе</b><div className="form">{currentStep.pattern.form}</div></div>}
        {mode === 'colleague' && !currentStep.targetVisible && currentStep.candidatePatterns && <div className="targetbox"><b>Выбери форму по смыслу</b><div className="candidates">{currentStep.candidatePatterns.map((p) => <span className="candidate" key={p.id}>{p.form}</span>)}</div></div>}
        {mode === 'colleague' && !currentStep.targetVisible && !currentStep.candidatePatterns && !revealTarget && <div className="actions"><button className="btn ghost" onClick={() => setRevealTarget(true)}>Показать конструкцию</button></div>}
        {mode === 'colleague' && showTarget && !currentStep.targetVisible && <div className="targetbox"><b>Подсказка</b><div className="form">{currentStep.pattern.form}</div></div>}

        <div className="transcript"><b>Что распознала система</b><div className={liveText ? 'heard' : 'placeholder'}>{liveText ? `“${liveText}”` : voiceState === 'starting' ? 'Подключаю микрофон… Пока не говори.' : voiceState === 'listening' ? 'Микрофон включён. Говори — текст появится здесь.' : 'После ответа здесь будет транскрипция.'}</div></div>

        {checking && <div className="panel" style={{ marginTop: 14 }}><span className="spinner" />Проверяю смысл, конструкцию и английский…</div>}

        {!checking && feedback ? (
          <>
            <div className={`panel feedback ${feedback.kind}`}>
              <h3>{feedback.title}</h3><div>{feedback.body}</div>
              {feedback.correction && <div style={{ marginTop: 9 }}><b>Исправленный вариант:</b> {feedback.correction}</div>}
            </div>
            {feedback.retryRequired ? (
              <div className="actions"><button className="btn primary" onClick={retry}>Исправить и сказать ещё раз →</button></div>
            ) : (
              <>
                <div className="panel models"><b>Один хороший ориентир</b><div className="model">{currentDrill.models[0]}</div>{mode === 'ours' && currentDrill.models[1] && <div className="model">Также естественно: {currentDrill.models[1]}</div>}</div>
                <div className="actions"><button className="btn primary" onClick={nextStep}>{stepIndex === steps.length - 1 ? 'Показать итог' : 'Дальше →'}</button><button className="btn ghost" onClick={retry}>Распознано неверно? Записать заново</button></div>
              </>
            )}
          </>
        ) : !checking ? (
          <>
            <div className="actions"><button className={`btn ${voiceState === 'idle' ? 'dark' : 'red'}`} onClick={() => voiceState === 'idle' ? startVoice() : recognitionRef.current?.stop?.()}>{label}</button><button className="btn ghost" onClick={() => setTyping((v) => !v)}>Или напечатать</button></div>
            {voiceState === 'starting' && <div className="status amber">Пока не говори. Дождись «Слушаю — говори».</div>}
            {voiceState === 'listening' && <div className="status red">Микрофон включён.</div>}
            {voiceMessage && <div className="status red">{voiceMessage}</div>}
            {typing && <div style={{ marginTop: 14 }}><textarea value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Your answer…" /><div className="actions"><button className="btn primary" onClick={() => submit(typed)}>Проверить</button></div></div>}
          </>
        ) : null}
      </div>
    </div>
  )
}
