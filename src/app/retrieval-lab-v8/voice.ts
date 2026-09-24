'use client'

import { useEffect, useRef, useState } from 'react'

export async function transcribeAudio(blob: Blob, taskId: string, signal?: AbortSignal): Promise<string> {
  const form = new FormData()
  form.append('audio', blob, blob.type.includes('webm') ? 'answer.webm' : 'answer.audio')
  form.append('taskId', taskId)
  const res = await fetch('/api/retrieval-lab-v8-stt', { method: 'POST', body: form, signal })
  if (!res.ok) throw new Error('stt')
  const data = await res.json()
  if (typeof data.transcript !== 'string' || !data.transcript.trim()) throw new Error('stt')
  return data.transcript.trim()
}

type VoiceState = 'idle' | 'requesting' | 'listening' | 'transcribing'

type MediaState = {
  recorder?: MediaRecorder
  stream?: MediaStream
  context?: AudioContext
  frame?: number
  timer?: ReturnType<typeof setTimeout>
  controller?: AbortController
  version: number
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))
const median = (values: number[]) => {
  if (!values.length) return 0.003
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

export function useVoice(taskId: string | undefined, onTranscript: (text: string) => void) {
  const [state, setState] = useState<VoiceState>('idle')
  const [error, setError] = useState('')
  const current = useRef(onTranscript)
  const currentTask = useRef(taskId)
  current.current = onTranscript
  currentTask.current = taskId
  const media = useRef<MediaState>({ version: 0 })

  function release() {
    const m = media.current
    if (m.frame !== undefined) cancelAnimationFrame(m.frame)
    clearTimeout(m.timer)
    m.stream?.getTracks().forEach(t => t.stop())
    if (m.context && m.context.state !== 'closed') void m.context.close().catch(() => {})
    m.stream = undefined
    m.context = undefined
    m.frame = undefined
  }

  function cancel() {
    const m = media.current
    m.version++
    m.controller?.abort()
    if (m.recorder) {
      m.recorder.onstop = null
      if (m.recorder.state === 'recording') m.recorder.stop()
    }
    release()
    m.recorder = undefined
    setState('idle')
  }

  useEffect(() => cancel, []) // eslint-disable-line react-hooks/exhaustive-deps

  function stop() {
    const m = media.current
    if (m.recorder?.state === 'recording') {
      setState('transcribing')
      if (m.frame !== undefined) cancelAnimationFrame(m.frame)
      m.recorder.stop()
    }
  }

  async function start() {
    cancel()
    setError('')
    if (!taskId) return
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Запись недоступна в этом браузере. Можно напечатать ответ.')
      return
    }
    const m = media.current
    const version = m.version
    setState('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      if (version !== m.version) { stream.getTracks().forEach(t => t.stop()); return }
      m.stream = stream
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : ''
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
      m.recorder = recorder
      const chunks: BlobPart[] = []
      recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data) }
      recorder.onerror = () => { cancel(); setError('Запись прервалась. Попробуй ещё раз или напечатай ответ.') }
      recorder.onstop = async () => {
        release()
        m.recorder = undefined
        if (version !== m.version) return
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
        m.controller = new AbortController()
        try {
          if (blob.size <= 500) throw new Error('short')
          setState('transcribing')
          const text = await transcribeAudio(blob, currentTask.current || taskId, m.controller.signal)
          if (version === m.version) {
            setState('idle')
            current.current(text)
          }
        } catch {
          if (version === m.version) {
            setState('idle')
            setError('Не удалось надёжно распознать запись. Запиши ещё раз или напечатай ответ — оценка не выставлялась.')
          }
        }
      }

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new AudioCtx()
      m.context = ctx
      await ctx.resume()
      if (version !== m.version) return
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 1024
      analyser.smoothingTimeConstant = .15
      ctx.createMediaStreamSource(stream).connect(analyser)
      const data = new Float32Array(analyser.fftSize)
      const calibration: number[] = []
      const calibrationUntil = performance.now() + 420
      let speechStarted = false
      let hotFrames = 0
      let lastVoice = performance.now()
      const startedAt = performance.now()

      recorder.start(200)
      setState('listening')
      m.timer = setTimeout(stop, 45000)

      const watch = () => {
        if (version !== m.version || recorder.state !== 'recording') return
        analyser.getFloatTimeDomainData(data)
        let sum = 0
        for (let i = 0; i < data.length; i++) sum += data[i] * data[i]
        const rms = Math.sqrt(sum / data.length)
        const now = performance.now()
        if (now < calibrationUntil && rms < .04) calibration.push(rms)
        const floor = median(calibration)
        const threshold = clamp(floor * 3.1, .0065, .024)
        if (rms > threshold) hotFrames += 1
        else hotFrames = Math.max(0, hotFrames - 1)
        if (hotFrames >= 2) { speechStarted = true; lastVoice = now }
        else if (speechStarted && rms > threshold * .68) lastVoice = now

        // Keep the drill moving: short answers should finish quickly once the learner stops speaking.
        if (speechStarted && now - lastVoice >= 1100) { stop(); return }
        if (!speechStarted && now - startedAt >= 12000) {
          cancel()
          setError('Не услышал речь. Попробуй ещё раз и говори сразу после «Слушаю — говори».')
          return
        }
        m.frame = requestAnimationFrame(watch)
      }
      m.frame = requestAnimationFrame(watch)
    } catch {
      if (version === m.version) {
        cancel()
        setError('Не удалось открыть микрофон. Проверь разрешение для сайта или напечатай ответ.')
      }
    }
  }

  return { state, error, start, stop, cancel }
}
