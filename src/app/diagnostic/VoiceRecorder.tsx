'use client'

import { useEffect, useRef, useState } from 'react'

type VoiceResult = {
  session_id: string
  transcript: string
  audio_path: string
}

type VoiceRecorderProps = {
  situationShownAt: number
  attemptId: string
  step?: 'try' | 'retry' | 'transfer'
  move?: string
  onResult: (data: VoiceResult) => void
}

type RecorderState = 'idle' | 'recording' | 'uploading'

export default function VoiceRecorder({
  situationShownAt,
  attemptId,
  step = 'try',
  move = 'face_saving_correction',
  onResult,
}: VoiceRecorderProps) {
  const [state, setState] = useState<RecorderState>('idle')
  const [durationMs, setDurationMs] = useState(0)
  const [error, setError] = useState('')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const startedAtRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function stopTracks() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  function stopTimer() {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
  }

  useEffect(() => () => {
    stopTimer()
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    stopTracks()
  }, [])

  function getAnonId() {
    const key = 'ef_diag_anon'
    let anonId = localStorage.getItem(key)
    if (!anonId) {
      anonId = crypto.randomUUID()
      localStorage.setItem(key, anonId)
    }
    return anonId
  }

  async function uploadRecording(blob: Blob, latencyMs: number) {
    setState('uploading')
    try {
      const formData = new FormData()
      formData.append('audio', blob, 'recording.webm')
      formData.append('anon_id', getAnonId())
      formData.append('attempt_id', attemptId)
      formData.append('duration_ms', String(Date.now() - startedAtRef.current))
      formData.append('latency_ms', String(latencyMs))
      formData.append('step', step)
      formData.append('move', move)

      const response = await fetch('/api/stt', { method: 'POST', body: formData })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Не удалось отправить запись')

      onResult(data as VoiceResult)
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Не удалось отправить запись')
    } finally {
      setState('idle')
    }
  }

  async function startRecording() {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const supportsWebm = MediaRecorder.isTypeSupported('audio/webm')
      const recorder = supportsWebm
        ? new MediaRecorder(stream, { mimeType: 'audio/webm' })
        : new MediaRecorder(stream)
      const chunks: BlobPart[] = []
      const latencyMs = Math.max(0, Date.now() - situationShownAt)

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data)
      }
      recorder.onstop = () => {
        stopTimer()
        stopTracks()
        const mimeType = recorder.mimeType || 'audio/webm'
        void uploadRecording(new Blob(chunks, { type: mimeType }), latencyMs)
      }
      recorder.onerror = () => {
        stopTimer()
        stopTracks()
        setError('Запись прервалась. Попробуйте ещё раз.')
        setState('idle')
      }

      recorderRef.current = recorder
      startedAtRef.current = Date.now()
      setDurationMs(0)
      recorder.start()
      setState('recording')
      timerRef.current = setInterval(() => {
        setDurationMs(Date.now() - startedAtRef.current)
      }, 100)
    } catch (recordingError) {
      stopTracks()
      const denied = recordingError instanceof DOMException && recordingError.name === 'NotAllowedError'
      setError(denied
        ? 'Доступ к микрофону запрещён. Разрешите микрофон в настройках браузера и попробуйте снова.'
        : 'Не удалось включить микрофон. Проверьте его подключение и попробуйте снова.')
      setState('idle')
    }
  }

  function handleClick() {
    if (state === 'idle') void startRecording()
    if (state === 'recording') recorderRef.current?.stop()
  }

  const seconds = (durationMs / 1000).toFixed(1)
  const label = state === 'recording'
    ? `● Запись… ${seconds} c`
    : state === 'uploading'
      ? 'Отправляю…'
      : '🎙 Ответить голосом'

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={state === 'uploading'}
        style={{
          background: state === 'recording' ? '#f59e0b' : '#0f1b3d',
          border: 'none', borderRadius: 8, color: '#fff', cursor: state === 'uploading' ? 'wait' : 'pointer',
          fontSize: 16, fontWeight: 700, minWidth: 210, padding: '13px 18px', opacity: state === 'uploading' ? 0.7 : 1,
        }}
      >
        {label}
      </button>
      {error && <p role="alert" style={{ color: '#b42318', margin: '10px 0 0' }}>{error}</p>}
    </div>
  )
}
