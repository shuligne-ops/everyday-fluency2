'use client'

import { useEffect, useRef, useState } from 'react'

type Stage = 'baseline' | 'retry' | 'transfer' | 'delayed' | 'done'
type ActiveStage = Exclude<Stage, 'done'>
type PatternId = 'wish_past' | 'end_up' | 'about_to' | 'might_as_well' | 'mixed_conditional'

type SpeechRecognitionLike = {
  lang: string
  interimResults: boolean
  continuous: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  abort: () => void
  onstart: (() => void) | null
  onspeechstart: (() => void) | null
  onresult: ((event: { results: ArrayLike<{ 0?: { transcript?: string } }> }) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onend: (() => void) | null
}

type Prompt = {
  title: string
  body: string
  instruction: string
  model: string
}

type Pattern = {
  id: PatternId
  chooser: string
  level: string
  form: string
  repair: string
  prompts: Record<ActiveStage, Prompt>
}

type Attempt = {
  transcript: string
  latencyMs: number
  score: 0 | 1 | 2
}

type Attempts = Partial<Record<ActiveStage, Attempt>>

const COLORS = {
  navy: '#0f1b3d', amber: '#f59e0b', pale: '#fff8ed', ink: '#17213f',
  muted: '#667085', green: '#15803d', red: '#b42318', line: '#eadfce',
}

const STORAGE_KEY = 'ef_language_retrieval_lab_v1'

const PATTERNS: Pattern[] = [
  {
    id: 'wish_past',
    chooser: 'Сожаление о прошлом',
    level: 'B1–B2',
    form: 'I wish + had + V3',
    repair: 'Когда жалеешь о прошлом, отодвинь действие ещё на один шаг назад: wish + past perfect.',
    prompts: {
      baseline: {
        title: 'Ты отказался от работы год назад. Сейчас жалеешь.',
        body: 'Та работа была интереснее и лучше оплачивалась. Сейчас ты всё ещё на старом месте.',
        instruction: 'Скажи по-английски: «Жаль, что я тогда не принял ту работу».',
        model: "I wish I'd taken that job.",
      },
      retry: {
        title: 'Вчера ты лёг слишком поздно.',
        body: 'Сегодня весь день сонный и ничего не соображаешь.',
        instruction: 'Скажи: «Жаль, что я не лёг раньше».',
        model: "I wish I'd gone to bed earlier.",
      },
      transfer: {
        title: 'Вы выбрали дешёвый ноутбук.',
        body: 'Теперь он постоянно тормозит, и вы уже пожалели об экономии.',
        instruction: 'Скажи естественно: «Жаль, что мы купили более дешёвый вариант».',
        model: "I wish we hadn't bought the cheaper one.",
      },
      delayed: {
        title: 'Цена билета выросла вдвое.',
        body: 'Неделю назад он стоил дёшево, но ты отложил покупку.',
        instruction: 'Скажи: «Жаль, что я не забронировал его раньше».',
        model: "I wish I'd booked it earlier.",
      },
    },
  },
  {
    id: 'end_up',
    chooser: 'Как всё вышло в итоге',
    level: 'B1–B2',
    form: 'end up + -ing',
    repair: 'Когда реальный итог отличается от плана или ожидания: end up + действие с -ing.',
    prompts: {
      baseline: {
        title: 'Вы собирались зайти на час.',
        body: 'Разговор затянулся, и в гостях вы просидели почти до полуночи.',
        instruction: 'Скажи: «В итоге мы просидели там три часа».',
        model: 'We ended up staying there for three hours.',
      },
      retry: {
        title: 'Ты зашёл в магазин только за хлебом.',
        body: 'Но увидел скидки и купил ещё кучу продуктов.',
        instruction: 'Скажи: «В итоге я купил гораздо больше, чем собирался».',
        model: 'I ended up buying much more than I planned.',
      },
      transfer: {
        title: 'Она хотела работать в маркетинге.',
        body: 'После университета всё сложилось иначе: теперь она преподаёт английский.',
        instruction: 'Скажи: «В итоге она стала преподавать английский».',
        model: 'She ended up teaching English.',
      },
      delayed: {
        title: 'Ты искал комнату в квартире.',
        body: 'После недели поисков нашёл маленькую студию и снял её.',
        instruction: 'Скажи: «В итоге я снял студию».',
        model: 'I ended up renting a studio.',
      },
    },
  },
  {
    id: 'about_to',
    chooser: 'Прямо собирался что-то сделать',
    level: 'B1',
    form: 'be about to + verb',
    repair: 'Для действия, которое вот-вот должно было произойти: be about to + базовая форма глагола.',
    prompts: {
      baseline: {
        title: 'Ты уже стоял у двери в пальто.',
        body: 'И тут тебе позвонил старый друг.',
        instruction: 'Скажи: «Я как раз собирался уходить, когда ты позвонил».',
        model: 'I was about to leave when you called.',
      },
      retry: {
        title: 'Она взяла телефон в руки.',
        body: 'В этот момент сообщение от тебя пришло первым.',
        instruction: 'Скажи: «Она как раз собиралась тебе позвонить».',
        model: 'She was about to call you.',
      },
      transfer: {
        title: 'Вы почти отменили поездку.',
        body: 'За минуту до отмены авиакомпания прислала хорошие новости.',
        instruction: 'Скажи: «Мы уже собирались отменить поездку».',
        model: 'We were about to cancel the trip.',
      },
      delayed: {
        title: 'Ты открыл чат со мной.',
        body: 'Но моё сообщение пришло раньше, чем ты успел написать.',
        instruction: 'Скажи: «Я как раз собирался тебе написать».',
        model: 'I was about to message you.',
      },
    },
  },
  {
    id: 'might_as_well',
    chooser: 'Раз уж так — можно и…',
    level: 'B2',
    form: 'might as well + verb',
    repair: 'Когда обстоятельства уже сложились и разумно воспользоваться ситуацией: might as well + глагол.',
    prompts: {
      baseline: {
        title: 'Автобус только что ушёл.',
        body: 'Следующий через двадцать минут, а пешком идти пятнадцать.',
        instruction: 'Скажи: «Можно тогда и пешком пойти».',
        model: 'We might as well walk.',
      },
      retry: {
        title: 'Уже поздно готовить.',
        body: 'Все остальные всё равно заказывают пиццу.',
        instruction: 'Скажи: «Тогда можно и нам заказать».',
        model: 'We might as well order some too.',
      },
      transfer: {
        title: 'Вы приехали на встречу на сорок минут раньше.',
        body: 'Через дорогу есть хорошее кафе.',
        instruction: 'Скажи: «Раз уж мы здесь, можно выпить кофе».',
        model: 'We might as well grab a coffee.',
      },
      delayed: {
        title: 'До дождя осталось минут десять.',
        body: 'Вы уже почти у магазина, который собирались посетить позже.',
        instruction: 'Скажи: «Можно зайти туда сейчас».',
        model: 'We might as well go in now.',
      },
    },
  },
  {
    id: 'mixed_conditional',
    chooser: 'Прошлое → результат сейчас',
    level: 'B2–C1',
    form: 'If + had + V3 → would + verb now',
    repair: 'Причина нереальна в прошлом, а последствие относится к настоящему: past perfect в if-части + would сейчас.',
    prompts: {
      baseline: {
        title: 'Ты лёг очень поздно вчера.',
        body: 'Сейчас сидишь совершенно разбитый.',
        instruction: 'Скажи: «Если бы я вчера лёг раньше, я бы сейчас не был таким уставшим».',
        model: "If I'd gone to bed earlier, I wouldn't be so tired now.",
      },
      retry: {
        title: 'Она отказалась от работы в Лондоне.',
        body: 'Если бы согласилась тогда, сейчас жила бы там.',
        instruction: 'Скажи это одним естественным предложением.',
        model: "If she'd taken that job, she'd be living in London now.",
      },
      transfer: {
        title: 'Вы купили слишком дешёвый сервер.',
        body: 'Теперь постоянно тратите время на его ремонт.',
        instruction: 'Скажи: «Если бы мы не купили этот сервер, мы бы сейчас не тратили столько времени на ремонт».',
        model: "If we hadn't bought this server, we wouldn't be spending so much time fixing it now.",
      },
      delayed: {
        title: 'Ты не начал французский пять лет назад.',
        body: 'Если бы начал, сейчас уже говорил бы свободно.',
        instruction: 'Скажи это по-английски.',
        model: "If I'd started French five years ago, I'd speak it fluently now.",
      },
    },
  },
]

function normalize(input: string) {
  return input.toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9' ]/g, ' ').replace(/\s+/g, ' ').trim()
}

function scorePattern(pattern: PatternId, input: string): 0 | 1 | 2 {
  const s = normalize(input)
  if (!s) return 0

  if (pattern === 'wish_past') {
    const full = /\bi wish (?:i|we|you|he|she|they)(?:'d| had| hadn't| had not)\b/.test(s)
    if (full) return 2
    if (/\bi wish\b/.test(s) || /\b(?:had|hadn't|had not)\b/.test(s)) return 1
    return 0
  }

  if (pattern === 'end_up') {
    const full = /\b(?:end|ends|ended|ending) up(?:\s+\w+){0,2}\s+\w+ing\b/.test(s)
    if (full) return 2
    if (/\b(?:end|ends|ended|ending) up\b/.test(s)) return 1
    return 0
  }

  if (pattern === 'about_to') {
    const full = /\b(?:am|is|are|was|were) about to\s+\w+\b/.test(s) || /\b(?:i'm|he's|she's|we're|they're|you're) about to\s+\w+\b/.test(s)
    if (full) return 2
    if (/\babout to\b/.test(s)) return 1
    return 0
  }

  if (pattern === 'might_as_well') {
    if (/\bmight as well\s+\w+\b/.test(s)) return 2
    if (/\bmight\b/.test(s) || /\bas well\b/.test(s)) return 1
    return 0
  }

  const pastSide = /\bif\b.*(?:\bhad\b|\bhadn't\b|\bhad not\b|(?:i|we|you|he|she|they)'d\b)/.test(s)
  const presentResult = /\b(?:would|wouldn't|would not|could|couldn't|might)\b/.test(s) || /\b(?:i|we|you|he|she|they)'d\b/.test(s)
  if (pastSide && presentResult) return 2
  if (pastSide || presentResult) return 1
  return 0
}

function scoreLabel(score: 0 | 1 | 2) {
  if (score === 2) return 'Паттерн извлечён'
  if (score === 1) return 'Почти: форма не собралась целиком'
  return 'Паттерн пока не пришёл'
}

export default function RetrievalLabPage() {
  const [patternId, setPatternId] = useState<PatternId | null>(null)
  const [stage, setStage] = useState<Stage>('baseline')
  const [attempts, setAttempts] = useState<Attempts>({})
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState('')
  const [typed, setTyped] = useState('')
  const [showTyped, setShowTyped] = useState(false)
  const shownAtRef = useRef(Date.now())
  const speechStartedRef = useRef<number | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)

  const pattern = PATTERNS.find((p) => p.id === patternId) ?? null

  useEffect(() => {
    shownAtRef.current = Date.now()
    speechStartedRef.current = null
    setTyped('')
    setShowTyped(false)
    setError('')
    try { recognitionRef.current?.abort() } catch {}
    recognitionRef.current = null
    setRecording(false)
  }, [stage, patternId])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const saved = JSON.parse(raw) as { patternId?: PatternId; attempts?: Attempts; nextProbeAt?: string; completed?: boolean }
      if (saved.completed || !saved.patternId || !saved.attempts?.transfer || !saved.nextProbeAt) return
      if (new Date(saved.nextProbeAt).getTime() <= Date.now()) {
        setPatternId(saved.patternId)
        setAttempts(saved.attempts)
        setStage('delayed')
      }
    } catch {}
  }, [])

  function choosePattern(id: PatternId) {
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
    setPatternId(id)
    setAttempts({})
    setStage('baseline')
  }

  function recordAttempt(transcript: string, latencyMs: number) {
    if (!pattern || stage === 'done') return
    const score = scorePattern(pattern.id, transcript)
    const attempt: Attempt = { transcript, latencyMs, score }
    const next = { ...attempts, [stage]: attempt }
    setAttempts(next)

    if (stage === 'transfer') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          patternId: pattern.id,
          attempts: next,
          nextProbeAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          completed: false,
        }))
      } catch {}
    }
    if (stage === 'delayed') {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ patternId: pattern.id, attempts: next, completed: true })) } catch {}
    }
  }

  function startVoice() {
    setError('')
    if (!pattern || stage === 'done') return
    const w = window as typeof window & {
      SpeechRecognition?: new () => SpeechRecognitionLike
      webkitSpeechRecognition?: new () => SpeechRecognitionLike
    }
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition
    if (!SR) {
      setError('Голосовой ввод не поддерживается этим браузером. Открой в Chrome или используй текст.')
      setShowTyped(true)
      return
    }

    try {
      const rec = new SR()
      rec.lang = 'en-US'
      rec.interimResults = false
      rec.continuous = false
      rec.maxAlternatives = 1
      recognitionRef.current = rec
      rec.onstart = () => setRecording(true)
      rec.onspeechstart = () => { speechStartedRef.current = Date.now() }
      rec.onresult = (event) => {
        const last = event.results[event.results.length - 1]
        const transcript = last?.[0]?.transcript?.trim()
        setRecording(false)
        if (!transcript) {
          setError('Не расслышал ответ. Попробуй ещё раз или напечатай.')
          return
        }
        const started = speechStartedRef.current ?? Date.now()
        recordAttempt(transcript, Math.max(0, started - shownAtRef.current))
      }
      rec.onerror = (event) => {
        setRecording(false)
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') setError('Браузер не дал доступ к распознаванию речи. Разреши микрофон или используй текст.')
        else if (event.error === 'no-speech') setError('Речь не услышана. Нажми ещё раз и ответь.')
        else setError('Голосовой ввод не сработал. Можно сразу напечатать ответ.')
        setShowTyped(true)
      }
      rec.onend = () => setRecording(false)
      rec.start()
    } catch {
      setRecording(false)
      setError('Не удалось запустить голосовой ввод. Можно пройти прототип текстом.')
      setShowTyped(true)
    }
  }

  function stopVoice() {
    try { recognitionRef.current?.stop() } catch {}
    setRecording(false)
  }

  function submitTyped() {
    const text = typed.trim()
    if (!text || !pattern || stage === 'done') return
    recordAttempt(text, Math.max(0, Date.now() - shownAtRef.current))
  }

  function advance() {
    if (stage === 'baseline') setStage('retry')
    else if (stage === 'retry') setStage('transfer')
    else if (stage === 'transfer') setStage('delayed')
    else if (stage === 'delayed') setStage('done')
  }

  function restartPattern() {
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
    setAttempts({})
    setStage('baseline')
  }

  function backToPatterns() {
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
    setPatternId(null)
    setAttempts({})
    setStage('baseline')
  }

  if (!pattern) {
    return <PatternChooser onChoose={choosePattern} />
  }

  if (stage === 'done') {
    return <Result pattern={pattern} attempts={attempts} onAgain={restartPattern} onPatterns={backToPatterns} />
  }

  const current = pattern.prompts[stage]
  const attempt = attempts[stage]
  const progress = ({ baseline: 25, retry: 50, transfer: 75, delayed: 100 } as const)[stage]

  return (
    <main style={{ minHeight: '100vh', background: COLORS.pale, color: COLORS.ink, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '34px 20px 64px' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <div>
            <div style={{ fontWeight: 850, color: COLORS.navy }}>Everyday Fluency</div>
            <div style={{ fontSize: 13, color: COLORS.muted }}>Language Retrieval Lab · {pattern.chooser}</div>
          </div>
          <button onClick={backToPatterns} style={ghostButton}>Другой паттерн</button>
        </header>

        <div style={{ height: 5, background: '#eadfce', borderRadius: 99, overflow: 'hidden', marginBottom: 30 }}>
          <div style={{ width: `${progress}%`, height: '100%', background: COLORS.amber, transition: 'width .2s' }} />
        </div>

        <p style={kicker}>{stage === 'baseline' ? '1 · Без подсказки' : stage === 'retry' ? '2 · Повторное извлечение' : stage === 'transfer' ? '3 · Новый контекст' : '4 · Blind probe'}</p>
        <h1 style={{ fontSize: 'clamp(29px, 6vw, 43px)', lineHeight: 1.12, margin: '10px 0 18px', color: COLORS.navy }}>{current.title}</h1>
        <p style={bodyText}>{current.body}</p>
        <p style={{ ...bodyText, fontWeight: 780 }}>{current.instruction}</p>

        {stage === 'delayed' && <div style={notice}>Сейчас это симуляция отложенной проверки. Если после TRANSFER закрыть страницу и вернуться завтра с этого же браузера, прототип поднимет этот probe автоматически.</div>}

        {!attempt && (
          <section style={{ marginTop: 28 }}>
            <button onClick={recording ? stopVoice : startVoice} style={{ ...primaryButton, minWidth: 225, background: recording ? '#dc2626' : COLORS.navy, color: 'white' }}>
              {recording ? '■ Остановить' : '🎙 Ответить голосом'}
            </button>
            {!recording && <button onClick={() => setShowTyped((v) => !v)} style={{ ...ghostButton, marginLeft: 10 }}>{showTyped ? 'Скрыть текст' : 'Или напечатать'}</button>}
            {recording && <p style={{ color: COLORS.green, marginTop: 12, fontWeight: 750 }}>Слушаю…</p>}
            {showTyped && <div style={{ marginTop: 16 }}><textarea value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Say it in English…" rows={3} style={textarea} /><button onClick={submitTyped} disabled={!typed.trim()} style={{ ...primaryButton, marginTop: 10, opacity: typed.trim() ? 1 : .5 }}>Проверить</button></div>}
            {error && <p style={{ color: COLORS.red, marginTop: 14 }}>{error}</p>}
          </section>
        )}

        {attempt && (
          <section style={{ marginTop: 30 }}>
            <div style={quoteCard}><div style={smallLabel}>Ты сказал</div>“{attempt.transcript}”</div>
            <div style={{ ...card, borderLeft: `5px solid ${attempt.score === 2 ? COLORS.green : attempt.score === 1 ? COLORS.amber : COLORS.red}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><strong>{scoreLabel(attempt.score)}</strong><strong>{attempt.score}/2</strong></div>
              <p style={{ margin: '10px 0 0', color: COLORS.muted, lineHeight: 1.55 }}>
                {attempt.score === 2 ? 'Нужная конструкция появилась в самостоятельном ответе.' : attempt.score === 1 ? 'Часть конструкции появилась, но целевая форма не собралась полностью.' : 'Мысль можно было выразить, но нужная конструкция не извлеклась.'}
              </p>
            </div>

            {(stage === 'baseline' || attempt.score < 2) && (
              <div style={{ ...card, background: '#fff7df' }}>
                <div style={smallLabel}>Минимальный repair</div>
                <p style={{ margin: '7px 0 8px', fontSize: 19, fontWeight: 850, color: COLORS.navy }}>{pattern.form}</p>
                <p style={{ margin: '0 0 14px', lineHeight: 1.55 }}>{pattern.repair}</p>
                <div style={smallLabel}>Один естественный вариант</div>
                <p style={{ margin: '7px 0 0', fontSize: 18, fontWeight: 750 }}>“{current.model}”</p>
              </div>
            )}

            {stage !== 'baseline' && attempt.score === 2 && <div style={notice}>Подсказка не понадобилась. На следующем экране меняется лексика и ситуация — проверяем, приходит ли конструкция снова.</div>}

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 22, flexWrap: 'wrap' }}>
              <button onClick={advance} style={primaryButton}>{stage === 'baseline' ? 'Попробовать ещё раз →' : stage === 'retry' ? 'Сменить контекст →' : stage === 'transfer' ? 'Blind probe сейчас →' : 'Показать итог →'}</button>
              <span style={{ fontSize: 13, color: COLORS.muted }}>До начала ответа: {(attempt.latencyMs / 1000).toFixed(1)} с</span>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}

function PatternChooser({ onChoose }: { onChoose: (id: PatternId) => void }) {
  return (
    <main style={{ minHeight: '100vh', background: COLORS.pale, color: COLORS.ink, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '46px 20px 72px' }}>
        <p style={kicker}>Language Retrieval Lab</p>
        <h1 style={{ fontSize: 'clamp(32px, 7vw, 50px)', lineHeight: 1.08, color: COLORS.navy, margin: '10px 0 18px' }}>Не «как правильно себя вести».<br />А приходит ли нужный английский в речь.</h1>
        <p style={{ ...bodyText, maxWidth: 680 }}>Выбери один смысл. Формулу заранее не показываем. Сначала ты говоришь сам, потом получаешь минимальный repair, переносишь конструкцию в другую ситуацию и проходишь blind probe.</p>
        <div style={{ display: 'grid', gap: 12, marginTop: 28 }}>
          {PATTERNS.map((p, index) => (
            <button key={p.id} onClick={() => onChoose(p.id)} style={{ textAlign: 'left', border: `1px solid ${COLORS.line}`, background: 'white', borderRadius: 16, padding: '18px 20px', cursor: 'pointer', color: COLORS.ink, fontFamily: 'inherit' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'baseline' }}><strong style={{ fontSize: 18 }}>{index + 1}. {p.chooser}</strong><span style={{ color: COLORS.muted, fontSize: 13 }}>{p.level}</span></div>
              <div style={{ marginTop: 6, color: COLORS.muted, fontSize: 14 }}>{index === 0 ? 'Начни с этого: быстро понятно, работает ли сама механика.' : 'Ещё один тип языкового извлечения.'}</div>
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}

function Result({ pattern, attempts, onAgain, onPatterns }: { pattern: Pattern; attempts: Attempts; onAgain: () => void; onPatterns: () => void }) {
  const rows = [
    ['Без подсказки', attempts.baseline],
    ['После repair', attempts.retry],
    ['Новый контекст', attempts.transfer],
    ['Blind probe', attempts.delayed],
  ] as const
  const b = attempts.baseline
  const d = attempts.delayed
  const delta = b && d ? (d.latencyMs - b.latencyMs) / 1000 : null
  const immediateGain = b && d ? d.score - b.score : null

  return (
    <main style={{ minHeight: '100vh', background: COLORS.navy, color: 'white', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 20px 72px' }}>
        <p style={{ ...kicker, color: '#fbbf24' }}>Итог · {pattern.chooser}</p>
        <h1 style={{ fontSize: 'clamp(31px, 7vw, 47px)', lineHeight: 1.1, margin: '10px 0 16px' }}>Вот теперь мы измеряем именно язык.</h1>
        <p style={{ color: '#cbd5e1', fontSize: 17, lineHeight: 1.6 }}>Цель: появилась ли конкретная конструкция без подсказки и стала ли она быстрее доступна при смене ситуации.</p>

        <div style={{ margin: '28px 0', display: 'grid', gap: 10 }}>
          {rows.map(([label, a]) => a && <div key={label} style={{ background: '#172554', borderRadius: 14, padding: '17px 18px', display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 16, alignItems: 'center' }}><span>{label}</span><strong>{a.score}/2</strong><span style={{ color: '#fbbf24' }}>{(a.latencyMs / 1000).toFixed(1)} с</span></div>)}
        </div>

        <div style={{ background: '#111c3f', border: '1px solid #334155', borderRadius: 15, padding: 20, marginBottom: 14 }}>
          <strong>Сигнал сегодняшней сессии</strong>
          <p style={{ margin: '9px 0 0', color: '#cbd5e1', lineHeight: 1.55 }}>
            {immediateGain != null && immediateGain > 0 ? `В simulated blind probe конструкция извлеклась лучше на ${immediateGain} балл(а).` : immediateGain === 0 ? 'В simulated blind probe качество извлечения не изменилось.' : 'В simulated blind probe результат стал слабее.'}
            {delta != null ? ` Начало ответа: ${delta < 0 ? `${Math.abs(delta).toFixed(1)} с быстрее` : delta > 0 ? `${delta.toFixed(1)} с медленнее` : 'без изменения'}.` : ''}
          </p>
        </div>

        <div style={{ background: 'white', color: COLORS.ink, borderRadius: 16, padding: 22 }}>
          <h2 style={{ margin: '0 0 10px', color: COLORS.navy }}>Что это доказывает — и чего не доказывает</h2>
          <p style={{ lineHeight: 1.6, margin: 0 }}>Сегодня можно оценить саму механику retrieval → repair → transfer. <b>Закрепление она пока не доказывает:</b> для этого нужен настоящий blind probe завтра и через несколько дней. Именно разница между этими двумя проверками решит, есть ли здесь двигатель курса, а не просто удобное упражнение.</p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 22 }}>
          <button onClick={onAgain} style={{ ...primaryButton, background: COLORS.amber, color: COLORS.navy }}>Тот же паттерн ещё раз</button>
          <button onClick={onPatterns} style={{ ...ghostButton, borderColor: '#64748b', color: '#e2e8f0' }}>Другой паттерн</button>
        </div>
      </div>
    </main>
  )
}

const kicker: React.CSSProperties = { margin: 0, textTransform: 'uppercase', letterSpacing: 1.4, color: COLORS.amber, fontSize: 12, fontWeight: 850 }
const bodyText: React.CSSProperties = { fontSize: 17, lineHeight: 1.62, margin: '0 0 14px' }
const primaryButton: React.CSSProperties = { border: 0, borderRadius: 10, background: COLORS.amber, color: COLORS.navy, padding: '13px 18px', fontWeight: 850, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }
const ghostButton: React.CSSProperties = { border: '1px solid #d6d3d1', borderRadius: 10, background: 'transparent', color: COLORS.muted, padding: '9px 12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }
const card: React.CSSProperties = { background: 'white', border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 18, marginTop: 14 }
const quoteCard: React.CSSProperties = { background: '#fff', borderRadius: 14, padding: 18, fontSize: 18, lineHeight: 1.5, border: `1px solid ${COLORS.line}` }
const smallLabel: React.CSSProperties = { textTransform: 'uppercase', letterSpacing: 1, color: COLORS.muted, fontSize: 11, fontWeight: 850 }
const notice: React.CSSProperties = { background: '#fff7df', border: '1px solid #f5d487', borderRadius: 12, padding: '13px 15px', fontSize: 14, lineHeight: 1.5, marginTop: 18 }
const textarea: React.CSSProperties = { width: '100%', boxSizing: 'border-box', borderRadius: 10, border: '1px solid #d6d3d1', padding: 12, fontSize: 16, fontFamily: 'inherit', resize: 'vertical' }
