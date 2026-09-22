'use client'

import { useEffect, useRef, useState } from 'react'

type Phase = 'baseline' | 'retry' | 'transfer' | 'delayed' | 'done'
type Analysis = {
  score: 0 | 1 | 2
  verdict: string
  heard_as: string
  principle: string
  stronger: string
  improvement: string
}
type Attempt = { transcript: string; latencyMs: number; analysis: Analysis }
type Attempts = Partial<Record<Exclude<Phase, 'done'>, Attempt>>

type SpeechRecognitionLike = {
  lang: string
  interimResults: boolean
  continuous: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  abort: () => void
  onstart: (() => void) | null
  onresult: ((event: { results: ArrayLike<{ 0?: { transcript?: string } }> }) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onend: (() => void) | null
}

const SCENES: Record<Exclude<Phase, 'done'>, { kicker: string; title: string; body: string; instruction: string }> = {
  baseline: {
    kicker: '1 · Без подсказки',
    title: 'На созвоне коллега называет неверный дедлайн.',
    body: 'Он уверенно говорит: “We need this by Friday.” Ты точно знаешь, что срок перенесли на понедельник. На звонке ещё пятеро, включая вашего общего руководителя.',
    instruction: 'Что ты скажешь? Ответь по-английски так, как ответил бы на настоящем созвоне.',
  },
  retry: {
    kicker: '2 · Repair',
    title: 'Та же задача — другой факт.',
    body: 'Коллега говорит: “The report is due Wednesday.” Ты знаешь, что срок перенесли на четверг. Остальные участники созвона слушают.',
    instruction: 'Поправь факт своими словами. Не копируй пример дословно — используй принцип.',
  },
  transfer: {
    kicker: '3 · Transfer',
    title: 'Теперь меняем контекст.',
    body: 'На встрече с клиентом коллега говорит, что новая функция выйдет завтра. Ты знаешь: юридическая проверка задерживает релиз до следующей недели.',
    instruction: 'Исправь информацию перед клиентом так, как сделал бы это вживую.',
  },
  delayed: {
    kicker: '4 · Blind probe',
    title: 'Представь, что прошли сутки. Никаких напоминаний.',
    body: 'На групповом звонке тимлид говорит: “The budget has already been approved.” Ты знаешь, что финансы его ещё не согласовали.',
    instruction: 'Ответь сразу. Здесь важны и формулировка, и то, насколько быстро нужный ход приходит в голову.',
  },
}

const COLORS = { navy: '#0f1b3d', amber: '#f59e0b', pale: '#fff8ed', ink: '#17213f', muted: '#667085', green: '#15803d', red: '#b42318' }
const STORAGE_KEY = 'ef_retrieval_lab_v2'

export default function RetrievalLabPage() {
  const [phase, setPhase] = useState<Phase>('baseline')
  const [attempts, setAttempts] = useState<Attempts>({})
  const [recording, setRecording] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [typed, setTyped] = useState('')
  const [showTyped, setShowTyped] = useState(false)
  const shownAtRef = useRef(Date.now())
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const latencyRef = useRef(0)

  useEffect(() => {
    shownAtRef.current = Date.now()
    setTyped('')
    setShowTyped(false)
    setError('')
    try { recognitionRef.current?.abort() } catch {}
    recognitionRef.current = null
    setRecording(false)
  }, [phase])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const saved = JSON.parse(raw) as { attempts?: Attempts; nextProbeAt?: string; completed?: boolean }
      if (saved.completed) return
      if (saved.attempts?.transfer && saved.nextProbeAt && new Date(saved.nextProbeAt).getTime() <= Date.now()) {
        setAttempts(saved.attempts)
        setPhase('delayed')
      }
    } catch {}
  }, [])

  function saveForTomorrow(nextAttempts: Attempts) {
    try {
      const nextProbeAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ attempts: nextAttempts, nextProbeAt, completed: false }))
    } catch {}
  }

  function startVoice() {
    setError('')
    const w = window as typeof window & {
      SpeechRecognition?: new () => SpeechRecognitionLike
      webkitSpeechRecognition?: new () => SpeechRecognitionLike
    }
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition
    if (!SR) {
      setError('Голосовой ввод не поддерживается этим браузером. Открой в Chrome или напечатай ответ.')
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
      latencyRef.current = Math.max(0, Date.now() - shownAtRef.current)

      rec.onstart = () => setRecording(true)
      rec.onresult = (event) => {
        const last = event.results[event.results.length - 1]
        const transcript = last?.[0]?.transcript?.trim()
        if (!transcript) {
          setError('Не расслышал ответ. Попробуй ещё раз или напечатай.')
          return
        }
        setRecording(false)
        setBusy(true)
        void evaluate(transcript, latencyRef.current)
          .catch((e) => setError(e instanceof Error ? e.message : 'Не удалось оценить ответ'))
          .finally(() => setBusy(false))
      }
      rec.onerror = (event) => {
        setRecording(false)
        const code = event.error || ''
        if (code === 'not-allowed' || code === 'service-not-allowed') {
          setError('Браузер не дал доступ к распознаванию речи. Разреши микрофон или используй текст.')
        } else if (code === 'no-speech') {
          setError('Речь не услышана. Нажми ещё раз и ответь.')
        } else {
          setError('Голосовой ввод не сработал. Можно сразу напечатать ответ.')
        }
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

  async function submitTyped() {
    const text = typed.trim()
    if (!text) return
    setBusy(true); setError('')
    try { await evaluate(text, Math.max(0, Date.now() - shownAtRef.current)) }
    catch (e) { setError(e instanceof Error ? e.message : 'Не удалось оценить ответ') }
    finally { setBusy(false) }
  }

  async function evaluate(transcript: string, latencyMs: number) {
    if (phase === 'done') return
    const baseline = attempts.baseline
    const response = await fetch('/api/retrieval-lab/eval', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phase,
        transcript,
        baselineTranscript: baseline?.transcript,
        priorPrinciple: baseline?.analysis.principle,
      }),
    })
    const json = await response.json()
    if (!response.ok) throw new Error(json.error || 'Не удалось оценить ответ')
    const attempt: Attempt = { transcript, latencyMs, analysis: json.analysis as Analysis }
    const next = { ...attempts, [phase]: attempt }
    setAttempts(next)
    if (phase === 'transfer') saveForTomorrow(next)
    if (phase === 'delayed') {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ attempts: next, completed: true })) } catch {}
    }
  }

  function advance() {
    if (phase === 'baseline') setPhase('retry')
    else if (phase === 'retry') setPhase('transfer')
    else if (phase === 'transfer') setPhase('delayed')
    else if (phase === 'delayed') setPhase('done')
  }

  function reset() {
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
    setAttempts({}); setPhase('baseline'); shownAtRef.current = Date.now(); setError('')
  }

  if (phase === 'done') return <Result attempts={attempts} onReset={reset} />

  const current = SCENES[phase]
  const attempt = attempts[phase]
  const baselinePrinciple = attempts.baseline?.analysis.principle

  return (
    <main style={{ minHeight: '100vh', background: COLORS.pale, color: COLORS.ink, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '36px 20px 64px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', marginBottom: 32 }}>
          <div><div style={{ fontWeight: 800, color: COLORS.navy }}>Everyday Fluency</div><div style={{ fontSize: 13, color: COLORS.muted }}>Retrieval Engine · decision prototype</div></div>
          <button onClick={reset} style={ghostButton}>Сбросить</button>
        </div>

        <div style={{ height: 5, background: '#eadfce', borderRadius: 10, overflow: 'hidden', marginBottom: 30 }}>
          <div style={{ width: `${({ baseline: 25, retry: 50, transfer: 75, delayed: 100 } as const)[phase]}%`, height: '100%', background: COLORS.amber, transition: 'width .25s' }} />
        </div>

        <p style={kicker}>{current.kicker}</p>
        <h1 style={{ fontSize: 'clamp(27px, 6vw, 40px)', lineHeight: 1.12, margin: '10px 0 18px', color: COLORS.navy }}>{current.title}</h1>
        <p style={bodyText}>{current.body}</p>
        <p style={{ ...bodyText, fontWeight: 750 }}>{current.instruction}</p>

        {phase === 'delayed' && <div style={notice}>Для решения «нужно ли это вообще» blind probe можно пройти сейчас. Для настоящей проверки закрепления вернись завтра с этого же браузера.</div>}

        {!attempt && (
          <section style={{ marginTop: 28 }}>
            <button disabled={busy} onClick={recording ? stopVoice : startVoice} style={{ ...primaryButton, minWidth: 220, background: recording ? '#dc2626' : COLORS.navy, color: 'white', opacity: busy ? .6 : 1 }}>
              {busy ? 'Разбираю…' : recording ? '■ Остановить' : '🎙 Ответить голосом'}
            </button>
            {!recording && <button onClick={() => setShowTyped((v) => !v)} style={{ ...ghostButton, marginLeft: 10 }}>{showTyped ? 'Скрыть текст' : 'Или напечатать'}</button>}
            {recording && <p style={{ color: COLORS.green, marginTop: 12, fontWeight: 700 }}>Слушаю… скажи одну естественную реплику.</p>}
            {showTyped && <div style={{ marginTop: 16 }}><textarea value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Your answer in English…" rows={3} style={textarea} /><button disabled={busy || !typed.trim()} onClick={submitTyped} style={{ ...primaryButton, marginTop: 10 }}>Проверить</button></div>}
            {error && <p style={{ color: COLORS.red, marginTop: 14 }}>{error}</p>}
          </section>
        )}

        {attempt && (
          <section style={{ marginTop: 30 }}>
            <div style={quoteCard}><div style={smallLabel}>Ты сказал</div>“{attempt.transcript}”</div>
            <div style={{ ...card, borderLeft: `5px solid ${attempt.analysis.score === 2 ? COLORS.green : attempt.analysis.score === 1 ? COLORS.amber : COLORS.red}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center' }}><strong>{attempt.analysis.verdict}</strong><strong>{attempt.analysis.score}/2</strong></div>
              <p style={{ margin: '12px 0 0', lineHeight: 1.55 }}>{attempt.analysis.heard_as}</p>
              <p style={{ margin: '12px 0 0', color: COLORS.muted, lineHeight: 1.55 }}>{attempt.analysis.improvement}</p>
            </div>

            {phase === 'baseline' && <div style={{ ...card, background: '#fff7df' }}><div style={smallLabel}>Один принцип</div><p style={{ margin: '6px 0 12px', lineHeight: 1.55, fontWeight: 650 }}>{attempt.analysis.principle}</p><div style={smallLabel}>Один пример, не шаблон для копирования</div><p style={{ margin: '6px 0 0', fontSize: 19, fontWeight: 750 }}>“{attempt.analysis.stronger}”</p></div>}

            {phase !== 'baseline' && baselinePrinciple && <div style={{ fontSize: 14, color: COLORS.muted, marginTop: 12 }}>Система проверяет перенос принципа, а не совпадение с образцом.</div>}

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 22, flexWrap: 'wrap' }}>
              <button onClick={advance} style={primaryButton}>{phase === 'baseline' ? 'Попробовать другой пример →' : phase === 'retry' ? 'Проверить перенос →' : phase === 'transfer' ? 'Сымитировать проверку завтра →' : 'Показать итог →'}</button>
              <span style={{ fontSize: 13, color: COLORS.muted }}>До начала ответа: {(attempt.latencyMs / 1000).toFixed(1)} с</span>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}

function Result({ attempts, onReset }: { attempts: Attempts; onReset: () => void }) {
  const b = attempts.baseline, r = attempts.retry, t = attempts.transfer, d = attempts.delayed
  const latencyDelta = b && d ? (d.latencyMs - b.latencyMs) / 1000 : null
  const rows = [ ['Без подсказки', b], ['После repair', r], ['Новый контекст', t], ['Blind probe', d] ] as const
  return <main style={{ minHeight: '100vh', background: COLORS.navy, color: 'white', fontFamily: 'system-ui, -apple-system, sans-serif' }}><div style={{ maxWidth: 700, margin: '0 auto', padding: '48px 20px 70px' }}>
    <p style={{ ...kicker, color: '#fbbf24' }}>Результат прототипа</p>
    <h1 style={{ fontSize: 'clamp(30px, 7vw, 46px)', lineHeight: 1.12, margin: '10px 0 16px' }}>Теперь видно, что именно мы пытаемся автоматизировать.</h1>
    <p style={{ color: '#cbd5e1', fontSize: 17, lineHeight: 1.6 }}>Не «знает ли человек английский», а появляется ли нужный коммуникативный ход без подсказки — и насколько быстро.</p>

    <div style={{ margin: '30px 0', display: 'grid', gap: 10 }}>{rows.map(([label, a]) => a && <div key={label} style={{ background: '#172554', borderRadius: 14, padding: '17px 18px', display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 16, alignItems: 'center' }}><span>{label}</span><strong>{a.analysis.score}/2</strong><span style={{ color: '#fbbf24' }}>{(a.latencyMs / 1000).toFixed(1)} с</span></div>)}</div>

    {latencyDelta != null && <div style={{ background: '#111c3f', border: '1px solid #334155', borderRadius: 14, padding: 20, marginBottom: 20 }}><strong>Изменение скорости извлечения</strong><p style={{ margin: '8px 0 0', color: '#cbd5e1' }}>{latencyDelta < 0 ? `Blind probe начался на ${Math.abs(latencyDelta).toFixed(1)} с быстрее baseline.` : latencyDelta > 0 ? `Blind probe начался на ${latencyDelta.toFixed(1)} с медленнее baseline.` : 'Время начала ответа не изменилось.'}</p></div>}

    <div style={{ background: '#fff', color: COLORS.ink, borderRadius: 16, padding: 22 }}><h2 style={{ margin: '0 0 10px', color: COLORS.navy }}>Критерий решения</h2><p style={{ lineHeight: 1.6, margin: 0 }}>Если сам цикл <b>ответ → минимальный repair → новый контекст → blind probe + latency</b> ощущается содержательнее обычного «поговорить с AI», идею стоит развивать. Если последний этап не даёт новой ценности, усложнять основной курс этим механизмом не стоит.</p></div>

    <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.55, marginTop: 18 }}>Сегодняшняя кнопка «завтра» симулирует delayed probe и проверяет UX/логику. Настоящее закрепление можно оценить только при реальном возвращении через день и позже.</p>
    <button onClick={onReset} style={{ ...primaryButton, marginTop: 22, background: COLORS.amber, color: COLORS.navy }}>Пройти ещё раз</button>
  </div></main>
}

const kicker: React.CSSProperties = { margin: 0, textTransform: 'uppercase', letterSpacing: 1.4, color: COLORS.amber, fontSize: 12, fontWeight: 800 }
const bodyText: React.CSSProperties = { fontSize: 17, lineHeight: 1.62, margin: '0 0 14px' }
const primaryButton: React.CSSProperties = { border: 0, borderRadius: 10, background: COLORS.amber, color: COLORS.navy, padding: '13px 18px', fontWeight: 800, fontSize: 15, cursor: 'pointer' }
const ghostButton: React.CSSProperties = { border: '1px solid #d6d3d1', borderRadius: 10, background: 'transparent', color: COLORS.muted, padding: '9px 12px', fontWeight: 650, cursor: 'pointer' }
const card: React.CSSProperties = { background: 'white', border: '1px solid #eadfce', borderRadius: 14, padding: 18, marginTop: 14 }
const quoteCard: React.CSSProperties = { background: '#fff', borderRadius: 14, padding: 18, fontSize: 18, lineHeight: 1.5, border: '1px solid #eadfce' }
const smallLabel: React.CSSProperties = { textTransform: 'uppercase', letterSpacing: 1, color: COLORS.muted, fontSize: 11, fontWeight: 800 }
const notice: React.CSSProperties = { background: '#fff7df', border: '1px solid #f5d487', borderRadius: 12, padding: '13px 15px', fontSize: 14, lineHeight: 1.5, marginTop: 18 }
const textarea: React.CSSProperties = { width: '100%', boxSizing: 'border-box', borderRadius: 10, border: '1px solid #d6d3d1', padding: 12, fontSize: 16, fontFamily: 'inherit', resize: 'vertical' }
