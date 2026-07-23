export type AnalyticsEvent = 'landing_view' | 'audio_play' | 'reveal' | 'lesson_start' | 'lesson_50' | 'registration' | 'paid'

type AnalyticsParams = Record<string, string | number | boolean | null | undefined>

declare global {
  interface Window {
    ym?: (id: number, method: string, ...args: unknown[]) => void
  }
}

export function track(event: AnalyticsEvent, params?: AnalyticsParams) {
  try {
    if (typeof window === 'undefined') return
    const id = process.env.NEXT_PUBLIC_YM_ID
    if (!id || !window.ym) return
    window.ym(Number(id), 'reachGoal', event, params)
  } catch {
    // Аналитика не должна влиять на работу страницы.
  }
}

export function trackOnce(event: AnalyticsEvent, key: string, params?: AnalyticsParams) {
  try {
    if (typeof window === 'undefined') return
    const storageKey = `ef_ev_${key}`
    if (window.sessionStorage.getItem(storageKey)) return
    window.sessionStorage.setItem(storageKey, '1')
    track(event, params)
  } catch {
    track(event, params)
  }
}
