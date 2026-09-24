'use client'

import { useEffect, useRef, useState } from 'react'
import { catalog, findTask, library, reviewTask, sessionTasks, type Task } from './tasks'
import { decision, isTechnical, metrics, parseEvaluation, schedule, technical, visiblePhase, type Attempt, type Due, type Evaluation, type Phase } from './domain'
import { useVoice } from './voice'
import styles from './v7.module.css'

type Session = { id: string; targetId: string; taskIds: string[]; index: number; retry: number; learning: boolean; review: boolean; done: boolean; answer: string; originalTranscript: string; transcriptEdited: boolean; result: Evaluation | null; attempts: Attempt[] }
type Store = { version: 7; session: Session | null; history: Attempt[]; due: Due[] }
const KEY = 'everyday-fluency-v7'
const empty = (): Store => ({ version: 7, session: null, history: [], due: [] })
const labels: Record<Phase, string> = { hidden: 'Попробуй сам', visible: 'С опорой', compact: 'Чуть меньше опоры', minimal: 'Короткая опора', varied: 'В другой ситуации', review: 'Вспомни в новой ситуации', learning: 'Теперь потренируемся с опорой' }
const cueLabels = { ru: 'Скажи по-английски', situation: 'Ответь на ситуацию одной фразой', dialogue: 'Продолжи диалог за B' }

function readStore(): Store {
  const raw = localStorage.getItem(KEY)
  if (!raw) return empty()
  const d = JSON.parse(raw) as Store
  if (d.version !== 7 || !Array.isArray(d.history) || !Array.isArray(d.due)) throw new Error('stored data')
  if (d.session && (!Array.isArray(d.session.taskIds) || !d.session.taskIds.length || !d.session.taskIds.every(id => typeof id === 'string' && !!findTask(id)) || !Array.isArray(d.session.attempts) || !catalog.some(p => p.id === d.session!.targetId) || !Number.isInteger(d.session.index) || d.session.index < 0 || d.session.index >= d.session.taskIds.length || (d.session.result && !parseEvaluation(d.session.result)))) throw new Error('stored session')
  d.due = d.due.filter(x => library.some(p => p.id === x.targetId) && Number.isFinite(x.dueAt) && Number.isInteger(x.stage) && x.stage >= 0 && x.stage < 4 && Number.isInteger(x.round) && x.round >= 0)
  return d
}

export default function TrainerV7() {
  const [store, setStore] = useState<Store>(empty)
  const [ready, setReady] = useState(false)
  const [inSession, setInSession] = useState(false)
  const [checking, setChecking] = useState(false)
  const [storageError, setStorageError] = useState('')
  const [help, setHelp] = useState(false)
  const request = useRef<AbortController | null>(null)
  const busy = useRef(false)
  const session = store.session
  const task = session ? findTask(session.taskIds[session.index]) : undefined
  const pattern = catalog.find(p => p.id === session?.targetId)
  const phase: Phase = session?.learning ? 'learning' : task?.phase || 'hidden'
  const visible = visiblePhase(phase)
  const voice = useVoice(text => {
    updateSession(s => ({ ...s, answer: text, originalTranscript: text, transcriptEdited: false, result: null }))
    void evaluate(text, false, true)
  })

  useEffect(() => {
    try {
      const d = readStore(); setStore(d)
      setInSession(!!d.session && window.location.hash !== '#library')
    } catch { setStorageError('Не удалось прочитать сохранение. Эта сессия начнётся заново.') }
    setReady(true)
    const navigate = () => { request.current?.abort(); request.current = null; busy.current = false; setChecking(false); voice.cancel(); setInSession(window.location.hash === '#practice'); setHelp(false) }
    window.addEventListener('popstate', navigate)
    return () => { window.removeEventListener('popstate', navigate); request.current?.abort() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!ready) return
    try { localStorage.setItem(KEY, JSON.stringify(store)) }
    catch { setStorageError('Браузер не смог сохранить прогресс. Не закрывай вкладку до конца сессии.') }
  }, [store, ready])

  function updateSession(fn: (s: Session) => Session) { setStore(d => d.session ? { ...d, session: fn(d.session) } : d) }
  function navigate(active: boolean) {
    request.current?.abort(); request.current = null; busy.current = false; setChecking(false); voice.cancel(); setHelp(false)
    window.history.pushState(null, '', active ? '#practice' : '#library'); setInSession(active)
  }
  function start(targetId: string, due?: Due) {
    const tasks = due ? [reviewTask(targetId, due.round)!] : sessionTasks(targetId)
    const next: Session = { id: crypto.randomUUID(), targetId, taskIds: tasks.map(t => t.id), index: 0, retry: 0, learning: false, review: !!due, done: false, answer: '', originalTranscript: '', transcriptEdited: false, result: null, attempts: [] }
    setStore(d => ({ ...d, history: [...d.history, ...(d.session?.attempts || [])], session: next }))
    navigate(true)
  }
  async function evaluate(answerOverride?: string, transcriptEditedOverride?: boolean, fromVoice = false) {
    if (!session || !task || busy.current || (!fromVoice && voice.state !== 'idle')) return
    const submittedAnswer = (answerOverride ?? session.answer).trim()
    if (!submittedAnswer) return
    const submittedEdited = transcriptEditedOverride ?? session.transcriptEdited
    const submittedOriginalTranscript = fromVoice ? submittedAnswer : session.originalTranscript
    busy.current = true; setChecking(true)
    const captured = session, capturedTask = task, capturedPhase = phase
    const controller = new AbortController(); request.current = controller
    const timer = setTimeout(() => controller.abort(), 10000)
    let result = technical()
    try {
      const res = await fetch('/api/retrieval-lab-v7-eval', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ taskId: task.id, answer: submittedAnswer, phase, transcriptEdited: submittedEdited }) })
      const data = await res.json()
      result = res.ok ? parseEvaluation(data) || technical() : technical()
    } catch { /* An unavailable evaluator never creates success. */ }
    finally { clearTimeout(timer) }
    if (request.current !== controller) return
    busy.current = false; setChecking(false)
    // Leaving during a request must not apply its result to a different task.
    if (controller.signal.aborted && !document.location.hash.endsWith('practice')) return
    updateSession(s => {
      if (s.id !== captured.id || s.index !== captured.index || s.retry !== captured.retry) return s
      const record: Attempt = { taskId: capturedTask.id, targetId: s.targetId, phase: capturedPhase, targetVisible: visiblePhase(capturedPhase), cueType: capturedTask.cueType,
        answer: submittedAnswer, originalTranscript: submittedOriginalTranscript, transcriptEdited: submittedEdited,
        retry: s.retry, firstAttempt: !s.attempts.some(r => r.taskId === capturedTask.id), timestamp: new Date().toISOString(), result }
      return { ...s, answer: submittedAnswer, originalTranscript: submittedOriginalTranscript, transcriptEdited: submittedEdited, result, attempts: [...s.attempts, record] }
    })
  }
  function retry() {
    voice.cancel(); setHelp(false)
    updateSession(s => ({ ...s, retry: 1, learning: true, result: null, answer: '', originalTranscript: '', transcriptEdited: false }))
  }
  function next() {
    voice.cancel(); setHelp(false)
    setStore(d => {
      const s = d.session
      if (!s || s.done) return d
      if (s.index < s.taskIds.length - 1) return { ...d, session: { ...s, index: s.index + 1, retry: 0, learning: false, answer: '', originalTranscript: '', transcriptEdited: false, result: null } }
      const first = s.attempts.find(r => r.firstAttempt)
      const independent = !!first && !first.targetVisible && !first.transcriptEdited && first.result.target === 'correct' && ['accept', 'note'].includes(decision(first.result, false))
      // A technical failure cannot advance or postpone an already due review.
      const scored = s.attempts.some(r => !isTechnical(r.result))
      const previous = d.due.find(x => x.targetId === s.targetId)
      const due = scored ? [...d.due.filter(x => x.targetId !== s.targetId), s.review || !previous ? schedule(previous, s.targetId, s.review && independent) : previous] : d.due
      return { ...d, due, session: { ...s, done: true } }
    })
  }
  const action = session?.result ? decision(session.result, visible) : null
  const failureCount = session?.attempts.filter(r => decision(r.result, r.targetVisible) === 'retry').slice(-2).length || 0
  const twoFailures = !!session && session.attempts.length >= 2 && session.attempts.slice(-2).every(r => decision(r.result, r.targetVisible) === 'retry')
  const dueNow = store.due.filter(d => d.dueAt <= Date.now())
  const voiceLabel = { idle: 'Записать ответ', requesting: 'Подключаю микрофон…', listening: 'Слушаю — говори', transcribing: 'Распознаю…' }[voice.state]
  const disabled = checking || voice.state !== 'idle'

  return <main className={styles.root}><div className={styles.wrap}>
    <header className={styles.header}><span className={styles.brand}>Everyday Fluency <span> / 07</span></span><span className={styles.quiet}>Короткая практика</span></header>
    {storageError && <p role="alert" className={styles.warning}>{storageError}</p>}
    {!ready ? <p>Загружаю твою практику…</p> : !inSession || !session || !task || !pattern ? <>
      <div className={styles.hero}><p className={styles.eyebrow}>Одна мысль. Разные ситуации.</p><h1>От подсказки<br />к своей фразе.</h1><p>9 коротких заданий: попробуй сам, потренируйся с опорой и снова ответь своими словами.</p></div>
      {session && !session.done && <section className={styles.resume}><div><strong>Твоя сессия сохранена</strong><p>Задание {session.index + 1} из {session.taskIds.length}</p></div><button onClick={() => navigate(true)}>Продолжить</button></section>}
      {dueNow.length > 0 && <section className={styles.review}><h2>Пора вернуться к знакомому</h2><p>Новая ситуация, сначала без формулы.</p><div className={styles.actions}>{dueNow.map(d => <button key={d.targetId} onClick={() => start(d.targetId, d)}>Повторить · {catalog.find(p => p.id === d.targetId)?.name}</button>)}</div></section>}
      <div className={styles.sectionTitle}><h2>Выбери, что потренировать</h2><span>8 тем · около 6 минут</span></div>
      <div className={styles.grid}>{library.map((p, i) => <button className={styles.card} key={p.id} onClick={() => start(p.id)}><div className={styles.cardTop}><span>{String(i + 1).padStart(2, '0')}</span><span>{p.level}</span></div><h3>{p.name}</h3><p>{p.form}</p><span className={styles.cardLink}>Начать практику <span aria-hidden>↗</span></span></button>)}</div>
      <p className={styles.footnote}>Прогресс хранится в этом браузере. Следующие встречи с темой — через 1, 3, 7 и 14 дней.</p>
    </> : session.done ? <Summary session={session} due={store.due.find(d => d.targetId === session.targetId)} onLibrary={() => navigate(false)} /> : <>
      <div className={styles.sessionTop}><button className={styles.link} onClick={() => navigate(false)}>← К темам</button><span>{session.index + 1} / {session.taskIds.length}</span></div>
      <div className={styles.progress} role="progressbar" aria-label="Прогресс сессии" aria-valuemin={0} aria-valuemax={session.taskIds.length} aria-valuenow={session.index}><span style={{ width: `${session.index / session.taskIds.length * 100}%` }} /></div>
      <p className={styles.eyebrow}>{labels[phase]}</p><h1 className={styles.sessionTitle}>{cueLabels[task.cueType]}</h1>
      {!visible && <p className={styles.hint}>Подойдёт любая естественная фраза, которая передаёт смысл.</p>}
      <section className={styles.cue} aria-label="Задание">{task.cue}</section>
      {visible && <section className={styles.support}><span>{phase === 'minimal' || phase === 'varied' ? 'Короткая опора' : 'Попробуй эту форму'}</span><strong>{phase === 'minimal' || phase === 'varied' ? pattern.form.split(' + ')[0] : pattern.form}</strong>{(phase === 'visible' || phase === 'learning') && <p>{pattern.meaning}</p>}</section>}
      <label className={styles.answerLabel} htmlFor="v7-answer">Твоя фраза</label>
      <textarea id="v7-answer" value={session.answer} maxLength={2000} disabled={disabled || (!!session.result && action !== 'technical')} placeholder="Напечатай или запиши голосом…" onChange={e => updateSession(s => ({ ...s, answer: e.target.value, transcriptEdited: s.transcriptEdited || !!s.originalTranscript && e.target.value !== s.originalTranscript, result: null }))} />
      {session.originalTranscript && <p className={styles.hint}>{session.transcriptEdited ? 'Текст записи исправлен.' : checking ? 'Речь распознана. Уже проверяю ответ…' : 'Речь распознана автоматически.'}</p>}
      {(!session.result || action === 'technical') && <div className={styles.actions}>
        <button className={styles.mic} aria-label={voice.state === 'listening' ? 'Завершить запись' : 'Записать ответ'} disabled={checking || ['requesting', 'transcribing'].includes(voice.state)} onClick={() => { if (voice.state === 'listening') voice.stop(); else { updateSession(s => ({ ...s, answer: '', originalTranscript: '', transcriptEdited: false, result: null })); void voice.start() } }}>
          {voice.state === 'listening' ? <span aria-hidden>■</span> : <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg>}
          {voice.state === 'listening' ? 'Готово' : session.originalTranscript ? 'Записать заново' : 'Голосом'}
        </button>
        {!session.originalTranscript && <button className={styles.primary} disabled={disabled || !session.answer.trim()} onClick={() => void evaluate()}>{checking ? 'Проверяю…' : 'Проверить'}</button>}
      </div>}
      <div role="status" aria-live="polite" className={styles.hint}>{voice.state !== 'idle' ? voiceLabel : checking ? 'Проверяю смысл и английский…' : ''}</div>
      {voice.error && <p role="alert" className={styles.warning}>{voice.error}</p>}
      {session.result && <section className={`${styles.feedback} ${action === 'retry' ? styles.retry : ''}`} aria-live="polite">
        <h2>{action === 'technical' ? 'Пока не удалось оценить' : action === 'retry' ? session.retry ? 'Посмотри на хороший вариант' : 'Попробуем ещё раз' : 'Смысл передан'}</h2>
        {action !== 'technical' && <div className={styles.resultGrid}>
          <span>Смысл<strong>{{ ok: 'Передан', partial: 'Не полностью', wrong: 'Нужно уточнить', uncertain: 'Не оценён' }[session.result.communication]}</strong></span>
          <span>Конструкция<strong>{{ correct: 'Использована верно', incorrect: 'Нужна правка', not_used: visible ? 'Пока не использована' : 'Другая форма — это нормально', not_required: 'Не требовалась', uncertain: 'Не оценена' }[session.result.target]}</strong></span>
          <span>Английский<strong>{{ ok: 'В порядке', minor: 'Небольшая правка', important: 'Нужна правка', blocking: 'Нужно поправить', uncertain: 'Не оценён' }[session.result.language]}</strong></span>
          <span>Как звучит<strong>{{ natural: 'Естественно', acceptable: 'Хорошо', marked: 'Можно естественнее', unacceptable: 'Нужно поправить', uncertain: 'Не оценено' }[session.result.naturalness]}</strong></span>
        </div>}
        <p>{session.result.note_ru}</p>
        {!visible && session.result.communication === 'ok' && session.result.target === 'not_used' && action !== 'retry' && <p>Твоя фраза подходит. Повторять ради другой формы не нужно.</p>}
        {visible && action === 'retry' && session.result.target !== 'correct' && <p>Напоминание: {pattern.form}.</p>}
        {session.result.errors.map((e, i) => <p key={i}>{e.message_ru} {e.span && <><s>{e.span}</s> → {e.correction}</>}</p>)}
        {action !== 'technical' && (action === 'retry' || session.result.language !== 'ok') && <blockquote>{session.retry && action === 'retry' ? task.model : session.result.corrected_utterance || task.model}</blockquote>}
        <div className={styles.actions}>{action === 'retry' && session.retry === 0 ? <button className={styles.primary} onClick={retry}>Попробовать ещё раз</button> : <button className={styles.primary} onClick={next}>{action === 'technical' ? 'Пропустить без оценки' : session.index === session.taskIds.length - 1 ? 'Посмотреть итог' : 'Дальше'}</button>}
          {(twoFailures || failureCount >= 2 && session.retry === 1 && action === 'retry') && <button onClick={() => setHelp(!help)} aria-expanded={help}>Разобраться</button>}
        </div>
        {help && <section className={styles.help}><h3>{pattern.meaning}</h3><p><strong>{pattern.form}</strong></p><p>{pattern.repair}</p><p>{sessionTasks(pattern.id)[1].model}</p><p>{task.model}</p></section>}
      </section>}
      <p className={styles.footnote}>Можно выйти к темам и продолжить позже. Ответы и шаг сохраняются автоматически.</p>
    </>}
  </div></main>
}

function Summary({ session, due, onLibrary }: { session: Session; due?: Due; onLibrary: () => void }) {
  const m = metrics(session.attempts)
  const rows = [ ['Смысл с первого раза', `${m.meaning} / ${m.total}`], ['С показанной формулой нужная конструкция', `${m.visible} / ${m.visibleTotal}`], ['Без подсказки нужная конструкция появилась', `${m.hidden} / ${m.hiddenTotal}`], ['Потребовалась языковая правка', `${m.corrections} раз`], ['Технически не оценено', String(m.technical)] ]
  return <section className={styles.summary}><p className={styles.eyebrow}>На сегодня готово</p><h1>{session.review ? 'Ещё одна встреча с темой.' : 'Ты выразил мысль по-разному.'}</h1><p>Здесь видны первые ответы. Удачный повтор не меняет первую попытку.</p><dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    {session.review && m.hidden > 0 && <p className={styles.success}>Нужная конструкция появилась сама, до показа формулы.</p>}
    {session.learning && session.review && <p>Ответ после показа формы — практика с опорой.</p>}
    {due && <p>Следующая новая ситуация: {new Date(due.dueAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}.</p>}
    <button className={styles.primary} onClick={onLibrary}>Вернуться к темам</button></section>
}