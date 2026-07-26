import { track } from './analytics'

export type AuthErrorStage = 'session_restore' | 'lessons_fetch' | 'lesson_load'
export type AuthErrorReason = 'timeout' | 'invalid_refresh_token' | 'no_session' | 'network' | 'unknown'

export class AuthTimeoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthTimeoutError'
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 200)
  if (typeof error === 'string') return error.slice(0, 200)
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message).slice(0, 200)
  }
  return 'Unknown error'
}

export function classifyAuthError(error: unknown): AuthErrorReason {
  const message = getErrorMessage(error).toLowerCase()

  if (error instanceof AuthTimeoutError || /timeout|timed out|deadline/.test(message)) return 'timeout'
  if (/invalid refresh token|refresh token.*already used/.test(message)) return 'invalid_refresh_token'
  if (/auth session missing|session.*missing|no session/.test(message)) return 'no_session'
  if (
    (typeof navigator !== 'undefined' && navigator.onLine === false)
    || /failed to fetch|fetch failed|network|networkerror|load failed/.test(message)
  ) return 'network'

  return 'unknown'
}

export function reportAuthError(
  stage: AuthErrorStage,
  error: unknown,
  reason: AuthErrorReason = classifyAuthError(error),
) {
  track('auth_error', {
    stage,
    reason,
    message: getErrorMessage(error),
  })
}

export function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => reject(new AuthTimeoutError(message)), timeoutMs)

    Promise.resolve(promise).then(
      (value) => {
        window.clearTimeout(timeoutId)
        resolve(value)
      },
      (error) => {
        window.clearTimeout(timeoutId)
        reject(error)
      },
    )
  })
}

export function hasStoredAuthSession(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return Object.keys(window.localStorage).some((key) => key.startsWith('sb-') && key.endsWith('-auth-token'))
  } catch {
    return false
  }
}

async function clearIndexedDb() {
  if (typeof indexedDB === 'undefined' || typeof indexedDB.databases !== 'function') return

  const databases = await indexedDB.databases()
  await Promise.all(databases.map(({ name }) => new Promise<void>((resolve) => {
    if (!name) {
      resolve()
      return
    }

    const request = indexedDB.deleteDatabase(name)
    request.onsuccess = () => resolve()
    request.onerror = () => resolve()
    request.onblocked = () => resolve()
  })))
}

export async function recoverAccess() {
  track('auth_recovery_clicked')

  try {
    window.localStorage.clear()
  } catch {}

  try {
    await clearIndexedDb()
  } catch {}

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((registration) => registration.unregister()))
    }
  } catch {}

  try {
    if ('caches' in window) {
      const cacheNames = await window.caches.keys()
      await Promise.all(cacheNames.map((name) => window.caches.delete(name)))
    }
  } catch {}

  window.location.reload()
}
