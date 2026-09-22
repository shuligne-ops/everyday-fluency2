'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

type Stage = 'baseline' | 'retry' | 'transfer' | 'delayed'
type View = 'library' | 'practice' | 'result'
type PatternId =
  | 'wish_past'
  | 'should_have'
  | 'mixed_conditional'
  | 'present_perfect_continuous'
  | 'used_to'
  | 'about_to'
  | 'end_up'
  | 'might_as_well'
  | 'no_point_in'
  | 'would_rather'
  | 'supposed_to'
  | 'managed_to'

type Prompt = { title: string; body: string; instruction: string; model: string }
type Pattern = {
  id: PatternId
  name: string
  category: 'Времена и aspect' | 'Модальность' | 'Разговорные конструкции'
  level: string
  form: string
  meaning: string
  repair: string
  prompts: Record<Stage, Prompt>
}
type Attempt = { transcript: string; latencyMs: number; score: 0 | 1 | 2 }
type Attempts = Partial<Record<Stage, Attempt>>
type Progress = {
  strength: number
  sessions: number
  bestLatencyMs: number | null
  lastScore: number
  nextDueAt: string
}
type ProgressMap = Partial<Record<PatternId, Progress>>

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

const COLORS = {
  navy: '#0f1b3d', amber: '#f59e0b', pale: '#fff8ed', ink: '#17213f', muted: '#667085',
  green: '#15803d', red: '#b42318', line: '#eadfce', bluePale: '#eef4ff',
}
const STORAGE_KEY = 'ef_language_retrieval_progress_v2'
const STAGES: Stage[] = ['baseline', 'retry', 'transfer', 'delayed']

const PATTERNS: Pattern[] = [
  {
    id: 'wish_past', name: 'Сожаление о прошлом', category: 'Времена и aspect', level: 'B1–B2',
    form: 'wish + had + V3',
    meaning: 'Сожаление о том, что в прошлом произошло иначе.',
    repair: 'Отодвинь прошлое ещё на шаг назад: после wish используй past perfect.',
    prompts: {
      baseline: { title: 'Ты отказался от работы год назад. Сейчас жалеешь.', body: 'Та работа была интереснее и лучше оплачивалась.', instruction: 'Скажи: «Жаль, что я тогда не принял ту работу».', model: "I wish I'd taken that job." },
      retry: { title: 'Вчера ты лёг слишком поздно.', body: 'Сегодня весь день сонный.', instruction: 'Скажи: «Жаль, что я не лёг раньше».', model: "I wish I'd gone to bed earlier." },
      transfer: { title: 'Вы выбрали дешёвый ноутбук.', body: 'Теперь он постоянно тормозит.', instruction: 'Скажи: «Жаль, что мы купили более дешёвый вариант».', model: "I wish we hadn't bought the cheaper one." },
      delayed: { title: 'Ты не забронировал столик заранее.', body: 'Теперь в ресторане нет мест.', instruction: 'Скажи: «Жаль, что я не забронировал заранее».', model: "I wish I'd booked in advance." },
    },
  },
  {
    id: 'should_have', name: 'Надо было сделать', category: 'Модальность', level: 'B1–B2',
    form: 'should have + V3', meaning: 'Правильное действие в прошлом, которое не произошло.',
    repair: 'Когда оцениваешь прошлое решение задним числом: should have + V3.',
    prompts: {
      baseline: { title: 'Ты забыл зарядить телефон перед поездкой.', body: 'В дороге батарея села.', instruction: 'Скажи: «Надо было зарядить его вчера».', model: 'I should have charged it yesterday.' },
      retry: { title: 'Вы выехали слишком поздно.', body: 'Теперь стоите в пробке.', instruction: 'Скажи: «Нам надо было выехать раньше».', model: 'We should have left earlier.' },
      transfer: { title: 'Друг проигнорировал письмо от банка.', body: 'Теперь возникла проблема.', instruction: 'Скажи ему: «Тебе надо было ответить сразу».', model: 'You should have replied straight away.' },
      delayed: { title: 'Ты купил билет в последний момент.', body: 'Он оказался очень дорогим.', instruction: 'Скажи: «Надо было купить его раньше».', model: 'I should have bought it earlier.' },
    },
  },
  {
    id: 'mixed_conditional', name: 'Прошлое → результат сейчас', category: 'Времена и aspect', level: 'B2',
    form: 'If + had + V3, would + V now', meaning: 'Нереальное прошлое, последствия которого важны сейчас.',
    repair: 'Причина — в прошлом, результат — сейчас: if + past perfect → would + глагол сейчас.',
    prompts: {
      baseline: { title: 'Ты лёг поздно и сейчас еле держишься.', body: 'Причина была вчера, результат — сейчас.', instruction: 'Скажи: «Если бы я лёг раньше, я бы сейчас не был таким уставшим».', model: "If I'd gone to bed earlier, I wouldn't be so tired now." },
      retry: { title: 'Она не учила французский в школе.', body: 'Сейчас не может общаться с клиентом из Парижа.', instruction: 'Скажи это одним условным предложением.', model: "If she'd learned French at school, she could talk to the client now." },
      transfer: { title: 'Ты отказался от той работы.', body: 'Сейчас по-прежнему работаешь на старом месте.', instruction: 'Скажи: «Если бы я принял ту работу, я бы сейчас здесь не работал».', model: "If I'd taken that job, I wouldn't be working here now." },
      delayed: { title: 'Мы купили старую машину.', body: 'Теперь постоянно тратимся на ремонт.', instruction: 'Скажи: «Если бы мы купили новую, мы бы сейчас не ремонтировали её каждую неделю».', model: "If we'd bought a new one, we wouldn't be fixing it every week now." },
    },
  },
  {
    id: 'present_perfect_continuous', name: 'Длится до настоящего момента', category: 'Времена и aspect', level: 'B1–B2',
    form: 'have/has been + -ing', meaning: 'Действие началось раньше и продолжается или только что закончилось с видимым эффектом.',
    repair: 'Подчеркни процесс, который тянется до сейчас: have/has been + -ing.',
    prompts: {
      baseline: { title: 'Ты работаешь над отчётом с самого утра.', body: 'И всё ещё работаешь.', instruction: 'Скажи: «Я работаю над этим отчётом с восьми утра».', model: "I've been working on this report since eight." },
      retry: { title: 'На улице дождь уже три часа.', body: 'Он всё ещё идёт.', instruction: 'Скажи: «Дождь идёт уже три часа».', model: "It's been raining for three hours." },
      transfer: { title: 'Ты учишь французский последние полгода.', body: 'Процесс продолжается.', instruction: 'Скажи это естественно по-английски.', model: "I've been learning French for the last six months." },
      delayed: { title: 'Она ждёт врача уже сорок минут.', body: 'Врач пока не пришёл.', instruction: 'Скажи: «Она ждёт уже сорок минут».', model: "She's been waiting for forty minutes." },
    },
  },
  {
    id: 'used_to', name: 'Раньше было регулярно', category: 'Времена и aspect', level: 'B1',
    form: 'used to + verb', meaning: 'Прошлая привычка или состояние, которых сейчас уже нет.',
    repair: 'Для регулярного прошлого, которое изменилось: used to + начальная форма.',
    prompts: {
      baseline: { title: 'Раньше ты курил, но бросил.', body: 'Сейчас не куришь.', instruction: 'Скажи: «Я раньше курил».', model: 'I used to smoke.' },
      retry: { title: 'Когда она была ребёнком, семья жила у моря.', body: 'Сейчас они живут в другом месте.', instruction: 'Скажи: «Они раньше жили у моря».', model: 'They used to live by the sea.' },
      transfer: { title: 'Ты раньше часто ездил на работу на велосипеде.', body: 'Теперь ездишь на машине.', instruction: 'Скажи это одной естественной фразой.', model: 'I used to cycle to work.' },
      delayed: { title: 'В этом здании раньше был кинотеатр.', body: 'Теперь здесь супермаркет.', instruction: 'Скажи: «Здесь раньше был кинотеатр».', model: 'There used to be a cinema here.' },
    },
  },
  {
    id: 'about_to', name: 'Вот-вот собираюсь', category: 'Разговорные конструкции', level: 'B1',
    form: 'be about to + verb', meaning: 'Действие должно произойти буквально сейчас.',
    repair: 'Для «вот-вот» используй be about to + глагол.',
    prompts: {
      baseline: { title: 'Ты уже надеваешь пальто.', body: 'Через минуту выходишь.', instruction: 'Скажи: «Я как раз собирался выходить».', model: 'I was just about to leave.' },
      retry: { title: 'Телефон в руке.', body: 'Ты собирался ему позвонить именно сейчас.', instruction: 'Скажи: «Я как раз собирался тебе звонить».', model: 'I was just about to call you.' },
      transfer: { title: 'Поезд вот-вот отправится.', body: 'Двери уже закрываются.', instruction: 'Скажи: «Поезд сейчас отправится».', model: 'The train is about to leave.' },
      delayed: { title: 'Ты собираешься начать встречу.', body: 'Все уже подключились.', instruction: 'Скажи: «Мы вот-вот начнём».', model: "We're about to start." },
    },
  },
  {
    id: 'end_up', name: 'В итоге получилось', category: 'Разговорные конструкции', level: 'B1–B2',
    form: 'end up + -ing', meaning: 'Неожиданный или конечный результат цепочки событий.',
    repair: 'Для «в итоге» после end up обычно идёт -ing.',
    prompts: {
      baseline: { title: 'Ты хотел зайти на десять минут.', body: 'Но просидел там весь вечер.', instruction: 'Скажи: «В итоге я остался там на весь вечер».', model: 'I ended up staying there all evening.' },
      retry: { title: 'Вы спорили о маршруте.', body: 'В итоге поехали поездом.', instruction: 'Скажи это через end up.', model: 'We ended up taking the train.' },
      transfer: { title: 'Она не собиралась покупать машину.', body: 'Но после долгих поисков всё-таки купила.', instruction: 'Скажи: «В итоге она купила машину».', model: 'She ended up buying a car.' },
      delayed: { title: 'Ты начал смотреть одну серию.', body: 'В итоге посмотрел весь сезон.', instruction: 'Скажи это естественно.', model: 'I ended up watching the whole season.' },
    },
  },
  {
    id: 'might_as_well', name: 'Раз уж так — можно и…', category: 'Модальность', level: 'B2',
    form: 'might as well + verb', meaning: 'Практичный выбор, когда альтернативы не лучше.',
    repair: 'Когда «раз уж всё равно…»: might as well + глагол.',
    prompts: {
      baseline: { title: 'Автобус только что ушёл.', body: 'Следующий через сорок минут, а пешком идти двадцать.', instruction: 'Скажи: «Тогда уж можем пойти пешком».', model: 'We might as well walk.' },
      retry: { title: 'Ты уже открыл документ.', body: 'Осталось исправить всего две строки.', instruction: 'Скажи: «Раз уж открыл, можно сразу закончить».', model: 'I might as well finish it now.' },
      transfer: { title: 'Вы приехали слишком рано.', body: 'Кафе рядом уже открыто.', instruction: 'Скажи: «Можно тогда выпить кофе».', model: 'We might as well get a coffee.' },
      delayed: { title: 'Дождь всё равно не прекращается.', body: 'Вы уже промокли.', instruction: 'Скажи: «Можно тогда продолжать идти».', model: 'We might as well keep going.' },
    },
  },
  {
    id: 'no_point_in', name: 'Нет смысла', category: 'Разговорные конструкции', level: 'B1–B2',
    form: "there's no point in + -ing", meaning: 'Действие бесполезно или уже ничего не изменит.',
    repair: 'После no point in идёт -ing, не infinitive.',
    prompts: {
      baseline: { title: 'Магазин уже закрыт.', body: 'До него двадцать минут пешком.', instruction: 'Скажи: «Нет смысла туда сейчас идти».', model: "There's no point in going there now." },
      retry: { title: 'Решение уже принято.', body: 'Спорить с ним сейчас ничего не изменит.', instruction: 'Скажи: «Нет смысла сейчас спорить».', model: "There's no point in arguing now." },
      transfer: { title: 'Поезд уже ушёл.', body: 'Бежать на платформу поздно.', instruction: 'Скажи это через no point.', model: "There's no point in running now." },
      delayed: { title: 'Ты уже знаешь ответ.', body: 'Перечитывать всю статью не нужно.', instruction: 'Скажи: «Нет смысла читать всё снова».', model: "There's no point in reading it all again." },
    },
  },
  {
    id: 'would_rather', name: 'Я бы предпочёл', category: 'Разговорные конструкции', level: 'B1–B2',
    form: "I'd rather + verb", meaning: 'Прямое, разговорное предпочтение.',
    repair: 'После would rather — глагол без to.',
    prompts: {
      baseline: { title: 'Тебе предлагают встречу вечером.', body: 'Ты предпочитаешь утро.', instruction: 'Скажи: «Я бы лучше встретился утром».', model: "I'd rather meet in the morning." },
      retry: { title: 'Все хотят заказать еду.', body: 'Ты предпочёл бы приготовить дома.', instruction: 'Скажи это через rather.', model: "I'd rather cook at home." },
      transfer: { title: 'Тебя спрашивают: поезд или самолёт?', body: 'Ты предпочитаешь поезд.', instruction: 'Ответь одной естественной фразой.', model: "I'd rather take the train." },
      delayed: { title: 'Тебе предлагают обсудить это по телефону.', body: 'Ты предпочитаешь поговорить лично.', instruction: 'Скажи: «Я бы лучше поговорил лично».', model: "I'd rather talk in person." },
    },
  },
  {
    id: 'supposed_to', name: 'По идее / должен был', category: 'Модальность', level: 'B1–B2',
    form: 'be supposed to + verb', meaning: 'Ожидание, договорённость или правило.',
    repair: 'Для «по идее / согласно плану» используй be supposed to.',
    prompts: {
      baseline: { title: 'Курьер должен был приехать к шести.', body: 'Уже семь, его нет.', instruction: 'Скажи: «Он должен был приехать к шести».', model: 'He was supposed to be here by six.' },
      retry: { title: 'Встреча по плану начинается в девять.', body: 'Ты уточняешь время.', instruction: 'Скажи: «Мы должны начать в девять, верно?»', model: "We're supposed to start at nine, right?" },
      transfer: { title: 'Этот файл нельзя отправлять наружу.', body: 'Таковы правила компании.', instruction: 'Скажи: «Мы не должны делиться этим файлом».', model: "We're not supposed to share this file." },
      delayed: { title: 'По расписанию поезд приходит в 18:20.', body: 'Ты объясняешь другу.', instruction: 'Скажи: «По идее поезд должен прийти в 18:20».', model: 'The train is supposed to arrive at 6:20.' },
    },
  },
  {
    id: 'managed_to', name: 'Всё-таки удалось', category: 'Разговорные конструкции', level: 'B1–B2',
    form: 'manage to + verb', meaning: 'Удалось сделать что-то несмотря на трудность.',
    repair: 'Когда важна трудность и успешный результат: manage to + глагол.',
    prompts: {
      baseline: { title: 'Ты почти опоздал на поезд.', body: 'Но успел буквально в последнюю минуту.', instruction: 'Скажи: «Мне всё-таки удалось успеть на поезд».', model: 'I managed to catch the train.' },
      retry: { title: 'Задача была сложной.', body: 'Но команда закончила её сегодня.', instruction: 'Скажи: «Нам удалось закончить сегодня».', model: 'We managed to finish it today.' },
      transfer: { title: 'Она долго искала билет.', body: 'В итоге нашла один на пятницу.', instruction: 'Скажи: «Ей удалось найти билет на пятницу».', model: 'She managed to find a ticket for Friday.' },
      delayed: { title: 'Ты не знал адрес.', body: 'Но всё-таки нашёл дом без карты.', instruction: 'Скажи: «Мне удалось найти его без карты».', model: 'I managed to find it without a map.' },
    },
  },
]

function normalize(text: string) {
  return text.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function scoreTarget(id: PatternId, raw: string): 0 | 1 | 2 {
  const t = normalize(raw)
  const tests: Record<PatternId, { full: RegExp; partial: RegExp }> = {
    wish_past: { full: /\bwish\b.*\b(had|hadn't|had not|'d)\b/, partial: /\bwish\b/ },
    should_have: { full: /\bshould\s+(have|'ve)\b/, partial: /\bshould\b/ },
    mixed_conditional: { full: /\bif\b.*\b(had|hadn't|had not|'d)\b.*\b(would|wouldn't|would not|'d)\b/, partial: /\bif\b.*\b(would|could)\b/ },
    present_perfect_continuous: { full: /\b(have|has|'ve|'s)\s+been\s+[a-z]+ing\b/, partial: /\bbeen\s+[a-z]+ing\b/ },
    used_to: { full: /\bused to\b/, partial: /\bused\b/ },
    about_to: { full: /\b(am|is|are|was|were|'m|'s|'re)\s+(just\s+)?about to\b/, partial: /\babout to\b/ },
    end_up: { full: /\b(end|ended|ends|ending)\s+up\s+[a-z]+ing\b/, partial: /\bend(ed|s|ing)?\s+up\b/ },
    might_as_well: { full: /\bmight as well\b/, partial: /\bmight\b.*\bwell\b/ },
    no_point_in: { full: /\b(no point in|there's no point in|there is no point in)\b.*\b[a-z]+ing\b/, partial: /\bno point\b/ },
    would_rather: { full: /\b(would rather|'d rather)\b/, partial: /\brather\b/ },
    supposed_to: { full: /\b(am|is|are|was|were|'m|'s|'re)\s+(not\s+)?supposed to\b/, partial: /\bsupposed to\b/ },
    managed_to: { full: /\b(manage|managed|manages)\s+to\b/, partial: /\bmanage(d|s)?\b/ },
  }
  if (tests[id].full.test(t)) return 2
  if (tests[id].partial.test(t)) return 1
  return 0
}

function dueLabel(progress?: Progress) {
  if (!progress) return 'Новый'
  const due = new Date(progress.nextDueAt).getTime()
  if (due <= Date.now()) return 'Пора повторить'
  const days = Math.max(1, Math.ceil((due - Date.now()) / 86400000))
  return `Через ${days} дн.`
}

export default function RetrievalLabPage() {
  const [view, setView] = useState<View>('library')
  const [patternId, setPatternId] = useState<PatternId>('wish_past')
  const [stage, setStage] = useState<Stage>('baseline')
  const [attempts, setAttempts] = useState<Attempts>({})
  const [progress, setProgress] = useState<ProgressMap>({})
  const [typed, setTyped] = useState('')
  const [showTyped, setShowTyped] = useState(false)
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState('')
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
  }, [stage, patternId, view])

  const pattern = useMemo(() => PATTERNS.find((p) => p.id === patternId)!, [patternId])
  const prompt = pattern.prompts[stage]
  const attempt = attempts[stage]

  function persist(next: ProgressMap) {
    setProgress(next)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
  }

  function choosePattern(id: PatternId) {
    setPatternId(id)
    setAttempts({})
    setStage('baseline')
    setView('practice')
  }

  function chooseRecommended() {
    const now = Date.now()
    const ranked = [...PATTERNS].sort((a, b) => {
      const pa = progress[a.id], pb = progress[b.id]
      const adue = !pa || new Date(pa.nextDueAt).getTime() <= now ? 0 : 1
      const bdue = !pb || new Date(pb.nextDueAt).getTime() <= now ? 0 : 1
      if (adue !== bdue) return adue - bdue
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
      setError('Голосовой ввод здесь не поддерживается. Открой в Chrome или используй текст.')
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
      rec.onspeechstart = () => { speechAtRef.current = Date.now() }
      rec.onresult = (event) => {
        const last = event.results[event.results.length - 1]
        const transcript = last?.[0]?.transcript?.trim()
        setRecording(false)
        if (!transcript) { setError('Не расслышал. Попробуй ещё раз.'); return }
        submitAnswer(transcript, Math.max(0, (speechAtRef.current ?? Date.now()) - shownAtRef.current))
      }
      rec.onerror = (event) => {
        setRecording(false)
        const code = event.error || ''
        if (code === 'no-speech') setError('Речь не услышана. Нажми ещё раз и ответь.')
        else if (code === 'not-allowed' || code === 'service-not-allowed') setError('Браузер не разрешил распознавание речи. Используй текст или разреши микрофон.')
        else setError('Голосовой ввод не сработал. Можно пройти упражнение текстом.')
        setShowTyped(true)
      }
      rec.onend = () => setRecording(false)
      rec.start()
    } catch {
      setRecording(false)
      setShowTyped(true)
      setError('Не удалось запустить голосовой ввод. Используй текст.')
    }
  }

  function stopVoice() {
    try { recognitionRef.current?.stop() } catch {}
    setRecording(false)
  }

  function submitAnswer(transcript: string, latencyMs: number) {
    const score = scoreTarget(pattern.id, transcript)
    setAttempts((prev) => ({ ...prev, [stage]: { transcript, latencyMs, score } }))
  }

  function submitTyped() {
    const text = typed.trim()
    if (!text) return
    submitAnswer(text, Math.max(0, Date.now() - shownAtRef.current))
  }

  function advance() {
    const index = STAGES.indexOf(stage)
    if (index < STAGES.length - 1) {
      setStage(STAGES[index + 1])
      return
    }
    const completed = attempts.delayed ? attempts : { ...attempts }
    const rows = STAGES.map((s) => completed[s]).filter(Boolean) as Attempt[]
    const total = rows.reduce((sum, row) => sum + row.score, 0)
    const avg = rows.length ? total / (rows.length * 2) : 0
    const strength = Math.max(0, Math.min(5, Math.round(avg * 5)))
    const bestLatencyMs = rows.length ? Math.min(...rows.map((r) => r.latencyMs)) : null
    const days = strength <= 1 ? 1 : strength === 2 ? 2 : strength === 3 ? 3 : strength === 4 ? 7 : 14
    const old = progress[pattern.id]
    const next: ProgressMap = {
      ...progress,
      [pattern.id]: {
        strength,
        sessions: (old?.sessions ?? 0) + 1,
        bestLatencyMs: old?.bestLatencyMs == null ? bestLatencyMs : bestLatencyMs == null ? old.bestLatencyMs : Math.min(old.bestLatencyMs, bestLatencyMs),
        lastScore: total,
        nextDueAt: new Date(Date.now() + days * 86400000).toISOString(),
      },
    }
    persist(next)
    setView('result')
  }

  function resetAll() {
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
    setProgress({})
  }

  if (view === 'library') {
    const completed = Object.keys(progress).length
    return (
      <main style={pageStyle}>
        <div style={shellStyle}>
          <header style={{ marginBottom: 30 }}>
            <p style={kicker}>Everyday Fluency · Language Retrieval Lab</p>
            <h1 style={hero}>Ты это знаешь. Теперь достань это за две секунды.</h1>
            <p style={lead}>Прототип тренирует не правило и не «правильное поведение», а переход <b>смысл → языковая форма</b>. Сначала отвечаешь без подсказки, потом repair, новый контекст и blind probe.</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 20 }}>
              <button onClick={chooseRecommended} style={primaryButton}>Начать рекомендуемый паттерн →</button>
              <button onClick={resetAll} style={ghostButton}>Сбросить прогресс</button>
            </div>
            <p style={{ fontSize: 13, color: COLORS.muted, marginTop: 12 }}>Пройдено паттернов: {completed}/{PATTERNS.length}. Прогресс хранится только в этом браузере.</p>
          </header>

          {(['Времена и aspect', 'Модальность', 'Разговорные конструкции'] as const).map((category) => (
            <section key={category} style={{ marginTop: 30 }}>
              <h2 style={{ color: COLORS.navy, fontSize: 20, marginBottom: 12 }}>{category}</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
                {PATTERNS.filter((p) => p.category === category).map((p) => {
                  const pr = progress[p.id]
                  return (
                    <button key={p.id} onClick={() => choosePattern(p.id)} style={patternCard}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                        <span style={{ ...chip, background: pr ? COLORS.bluePale : '#f6f1e9' }}>{dueLabel(pr)}</span>
                        <span style={{ fontSize: 12, color: COLORS.muted }}>{p.level}</span>
                      </div>
                      <strong style={{ display: 'block', fontSize: 17, color: COLORS.navy, marginTop: 12 }}>{p.name}</strong>
                      <span style={{ display: 'block', fontSize: 13, color: COLORS.muted, lineHeight: 1.45, marginTop: 6 }}>{p.meaning}</span>
                      {pr && <span style={{ display: 'block', marginTop: 12, fontSize: 13, color: COLORS.green }}>Устойчивость {pr.strength}/5 · сессий {pr.sessions}</span>}
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </main>
    )
  }

  if (view === 'result') {
    const rows = STAGES.map((s) => [s, attempts[s]] as const).filter(([, a]) => Boolean(a))
    const names: Record<Stage, string> = { baseline: 'Без подсказки', retry: 'После repair', transfer: 'Новый контекст', delayed: 'Blind probe' }
    const pr = progress[pattern.id]
    return (
      <main style={{ ...pageStyle, background: COLORS.navy, color: 'white' }}>
        <div style={shellStyle}>
          <p style={{ ...kicker, color: '#fbbf24' }}>Результат · {pattern.name}</p>
          <h1 style={{ ...hero, color: 'white' }}>Это уже можно измерять как навык.</h1>
          <p style={{ ...lead, color: '#cbd5e1' }}>Мы смотрели только одно: появляется ли целевая конструкция без подсказки и как быстро начинается ответ.</p>
          <div style={{ display: 'grid', gap: 10, marginTop: 26 }}>
            {rows.map(([s, a]) => a && <div key={s} style={{ background: '#172554', borderRadius: 14, padding: 16, display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 14 }}><span>{names[s]}</span><strong>{a.score}/2</strong><span style={{ color: '#fbbf24' }}>{(a.latencyMs / 1000).toFixed(1)} с</span></div>)}
          </div>
          {pr && <div style={{ marginTop: 18, padding: 18, borderRadius: 14, background: '#111c3f', border: '1px solid #334155' }}><strong>Текущее состояние: {pr.strength}/5</strong><p style={{ margin: '8px 0 0', color: '#cbd5e1' }}>Следующая проверка: {new Date(pr.nextDueAt).toLocaleDateString('ru-RU')}. Лучшее время до начала ответа: {pr.bestLatencyMs == null ? '—' : `${(pr.bestLatencyMs / 1000).toFixed(1)} с`}.</p></div>}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 22 }}>
            <button onClick={() => { setAttempts({}); setStage('baseline'); setView('practice') }} style={{ ...primaryButton, background: COLORS.amber }}>Пройти этот паттерн ещё раз</button>
            <button onClick={() => setView('library')} style={{ ...ghostButton, color: 'white', borderColor: '#64748b' }}>Вернуться к библиотеке</button>
          </div>
        </div>
      </main>
    )
  }

  const stageNames: Record<Stage, string> = { baseline: '1 · Без подсказки', retry: '2 · Repair', transfer: '3 · Transfer', delayed: '4 · Blind probe' }
  const stageIndex = STAGES.indexOf(stage)
  const showRepair = stage === 'retry'
  const showNoHint = stage === 'transfer' || stage === 'delayed'

  return (
    <main style={pageStyle}>
      <div style={shellStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 22 }}>
          <button onClick={() => setView('library')} style={ghostButton}>← Библиотека</button>
          <div style={{ textAlign: 'right' }}><div style={{ fontWeight: 800, color: COLORS.navy }}>{pattern.name}</div><div style={{ fontSize: 12, color: COLORS.muted }}>{pattern.level}</div></div>
        </div>
        <div style={{ height: 5, background: '#eadfce', borderRadius: 9, overflow: 'hidden', marginBottom: 28 }}><div style={{ width: `${((stageIndex + 1) / 4) * 100}%`, height: '100%', background: COLORS.amber }} /></div>
        <p style={kicker}>{stageNames[stage]}</p>
        <h1 style={{ ...hero, fontSize: 'clamp(28px, 6vw, 42px)' }}>{prompt.title}</h1>
        <p style={lead}>{prompt.body}</p>
        <p style={{ ...lead, fontWeight: 750 }}>{prompt.instruction}</p>

        {showRepair && <div style={repairCard}><div style={smallLabel}>Мини-repair</div><strong style={{ display: 'block', marginTop: 6 }}>{pattern.repair}</strong><div style={{ marginTop: 10, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 16 }}>{pattern.form}</div></div>}
        {showNoHint && <div style={{ ...notice, background: stage === 'delayed' ? '#eef4ff' : '#fff7df' }}>{stage === 'delayed' ? 'Без формулы и без примера. Проверяем, всплывает ли конструкция сама.' : 'Формулу больше не показываем. Меняем контекст и проверяем перенос.'}</div>}

        {!attempt && <section style={{ marginTop: 26 }}>
          <button onClick={recording ? stopVoice : startVoice} style={{ ...primaryButton, minWidth: 220, background: recording ? '#dc2626' : COLORS.navy, color: 'white' }}>{recording ? '■ Остановить' : '🎙 Ответить голосом'}</button>
          {!recording && <button onClick={() => setShowTyped((v) => !v)} style={{ ...ghostButton, marginLeft: 10 }}>{showTyped ? 'Скрыть текст' : 'Или напечатать'}</button>}
          {recording && <p style={{ color: COLORS.green, fontWeight: 700 }}>Слушаю…</p>}
          {showTyped && <div style={{ marginTop: 14 }}><textarea rows={3} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Your answer in English…" style={textarea} /><button onClick={submitTyped} disabled={!typed.trim()} style={{ ...primaryButton, marginTop: 9 }}>Проверить</button></div>}
          {error && <p style={{ color: COLORS.red, marginTop: 12 }}>{error}</p>}
        </section>}

        {attempt && <section style={{ marginTop: 28 }}>
          <div style={quoteCard}><div style={smallLabel}>Ты сказал</div><div style={{ marginTop: 6, fontSize: 19 }}>“{attempt.transcript}”</div></div>
          <div style={{ ...card, borderLeft: `5px solid ${attempt.score === 2 ? COLORS.green : attempt.score === 1 ? COLORS.amber : COLORS.red}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><strong>{attempt.score === 2 ? 'Целевая конструкция появилась' : attempt.score === 1 ? 'Почти: конструкция узнаваема, но форма неполная' : 'Целевая конструкция не извлеклась'}</strong><strong>{attempt.score}/2</strong></div>
            <p style={{ color: COLORS.muted, lineHeight: 1.55, margin: '10px 0 0' }}>До начала ответа: {(attempt.latencyMs / 1000).toFixed(1)} с</p>
          </div>
          {(stage === 'baseline' || attempt.score < 2) && <div style={repairCard}><div style={smallLabel}>Что забрать</div><p style={{ margin: '6px 0 8px', lineHeight: 1.55 }}>{pattern.repair}</p><div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontWeight: 700 }}>{pattern.form}</div><p style={{ margin: '10px 0 0', fontSize: 17 }}><b>Пример:</b> “{prompt.model}”</p></div>}
          {stage !== 'baseline' && attempt.score === 2 && <div style={{ ...notice, background: '#ecfdf3', borderColor: '#bbf7d0', color: '#166534' }}>Форма появилась без показа образца. Именно это и считаем успешным retrieval.</div>}
          <button onClick={advance} style={{ ...primaryButton, marginTop: 18 }}>{stage === 'baseline' ? 'Сделать retry →' : stage === 'retry' ? 'Проверить transfer →' : stage === 'transfer' ? 'Blind probe →' : 'Показать результат →'}</button>
        </section>}
      </div>
    </main>
  )
}

const pageStyle: React.CSSProperties = { minHeight: '100vh', background: COLORS.pale, color: COLORS.ink, fontFamily: 'system-ui, -apple-system, sans-serif' }
const shellStyle: React.CSSProperties = { maxWidth: 760, margin: '0 auto', padding: '42px 20px 72px' }
const kicker: React.CSSProperties = { margin: 0, textTransform: 'uppercase', letterSpacing: 1.4, color: COLORS.amber, fontSize: 12, fontWeight: 850 }
const hero: React.CSSProperties = { color: COLORS.navy, fontSize: 'clamp(34px, 7vw, 54px)', lineHeight: 1.08, margin: '10px 0 18px', letterSpacing: '-0.02em' }
const lead: React.CSSProperties = { fontSize: 17, lineHeight: 1.62, margin: '0 0 14px' }
const primaryButton: React.CSSProperties = { border: 0, borderRadius: 10, background: COLORS.amber, color: COLORS.navy, padding: '13px 18px', fontWeight: 800, fontSize: 15, cursor: 'pointer' }
const ghostButton: React.CSSProperties = { border: '1px solid #d6d3d1', borderRadius: 10, background: 'transparent', color: COLORS.muted, padding: '10px 13px', fontWeight: 700, cursor: 'pointer' }
const patternCard: React.CSSProperties = { textAlign: 'left', border: `1px solid ${COLORS.line}`, background: 'white', borderRadius: 14, padding: 16, cursor: 'pointer', fontFamily: 'inherit' }
const chip: React.CSSProperties = { display: 'inline-block', borderRadius: 999, padding: '4px 8px', fontSize: 11, fontWeight: 800, color: COLORS.navy }
const smallLabel: React.CSSProperties = { textTransform: 'uppercase', letterSpacing: 1, color: COLORS.muted, fontSize: 11, fontWeight: 850 }
const repairCard: React.CSSProperties = { marginTop: 18, background: '#fff7df', border: '1px solid #f5d487', borderRadius: 14, padding: 17, lineHeight: 1.5 }
const notice: React.CSSProperties = { marginTop: 16, background: '#fff7df', border: '1px solid #f5d487', borderRadius: 12, padding: '13px 15px', fontSize: 14, lineHeight: 1.5 }
const quoteCard: React.CSSProperties = { background: 'white', border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 17 }
const card: React.CSSProperties = { background: 'white', border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 17, marginTop: 12 }
const textarea: React.CSSProperties = { width: '100%', boxSizing: 'border-box', borderRadius: 10, border: '1px solid #d6d3d1', padding: 12, fontSize: 16, fontFamily: 'inherit', resize: 'vertical' }
