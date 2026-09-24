'use client'
import { useEffect, useRef, useState } from 'react'

export async function transcribeAudio(blob: Blob, signal?: AbortSignal): Promise<string> {
  const form = new FormData()
  form.append('audio', blob, blob.type.includes('webm') ? 'answer.webm' : 'answer.audio')
  const res = await fetch('/api/retrieval-lab-v6-stt', { method: 'POST', body: form, signal })
  if (!res.ok) throw new Error('stt')
  const data = await res.json()
  if (typeof data.transcript !== 'string' || !data.transcript.trim()) throw new Error('stt')
  return data.transcript.trim()
}

// Same V6 MediaRecorder + RMS silence pipeline, with lifecycle cancellation.
// STT only emits text: the learner can edit it before explicitly requesting evaluation.
export function useVoice(onTranscript: (text: string) => void) {
  const [state, setState] = useState<'idle' | 'requesting' | 'listening' | 'transcribing'>('idle')
  const [error, setError] = useState('')
  const current = useRef(onTranscript)
  current.current = onTranscript
  const media = useRef<{ recorder?: MediaRecorder; stream?: MediaStream; context?: AudioContext; frame?: number; timer?: ReturnType<typeof setTimeout>; controller?: AbortController; version: number }>({ version: 0 })
  function release() {
    const m = media.current
    if (m.frame !== undefined) cancelAnimationFrame(m.frame)
    clearTimeout(m.timer)
    m.stream?.getTracks().forEach(t => t.stop())
    if (m.context && m.context.state !== 'closed') void m.context.close().catch(() => {})
    m.stream = undefined; m.context = undefined
  }
  function cancel() {
    const m = media.current
    m.version++
    m.controller?.abort()
    if (m.recorder) {
      m.recorder.onstop = null
      if (m.recorder.state === 'recording') m.recorder.stop()
    }
    release(); setState('idle')
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
    cancel(); setError('')
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { setError('Запись недоступна в этом браузере. Можно напечатать ответ.'); return }
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
      recorder.onerror = () => { cancel(); setError('Запись прервалась. Попробуй снова или напечатай ответ.') }
      recorder.onstop = async () => {
        release()
        if (version !== m.version) return
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
        m.controller = new AbortController()
        try {
          if (blob.size <= 500) throw new Error('short')
          setState('transcribing')
          const text = await transcribeAudio(blob, m.controller.signal)
          if (version === m.version) { current.current(text); setState('idle') }
        } catch { if (version === m.version) { setState('idle'); setError('Не удалось распознать запись. Запиши ещё раз или напечатай ответ. Ответ не оценивался.') } }
      }
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new AudioCtx(); m.context = ctx
      await ctx.resume()
      if (version !== m.version) return
      const analyser = ctx.createAnalyser(); analyser.fftSize = 1024; analyser.smoothingTimeConstant = .2
      ctx.createMediaStreamSource(stream).connect(analyser)
      const data = new Float32Array(analyser.fftSize)
      let speechStarted = false, lastVoice = performance.now()
      recorder.start(250); setState('listening')
      m.timer = setTimeout(stop, 45000)
      const watch = () => {
        if (version !== m.version || recorder.state !== 'recording') return
        analyser.getFloatTimeDomainData(data)
        let sum = 0
        for (let i = 0; i < data.length; i++) sum += data[i] * data[i]
        if (Math.sqrt(sum / data.length) > .025) { speechStarted = true; lastVoice = performance.now() }
        else if (speechStarted && performance.now() - lastVoice >= 1800) { stop(); return }
        m.frame = requestAnimationFrame(watch)
      }
      m.frame = requestAnimationFrame(watch)
    } catch { if (version === m.version) { cancel(); setError('Не удалось открыть микрофон. Проверь разрешение для сайта или напечатай ответ.') } }
  }
  return { state, error, start, stop, cancel }
}
