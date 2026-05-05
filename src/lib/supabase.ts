import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Кастомный storage, который игнорирует залипшие auth-локи.
// Если ключ начинается с "lock:" и ему больше 30 секунд — считаем его orphaned
// (остался от прерванной сессии) и удаляем при первом обращении.
const safeStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      // Чистим залипшие локи на любой операции чтения
      if (key.startsWith('lock:')) {
        const value = window.localStorage.getItem(key);
        if (value) {
          try {
            const parsed = JSON.parse(value);
            const acquiredAt = parsed?.acquiredAt ?? 0;
            if (Date.now() - acquiredAt > 30_000) {
              window.localStorage.removeItem(key);
              return null;
            }
          } catch {
            // Невалидный JSON в локе — удаляем
            window.localStorage.removeItem(key);
            return null;
          }
        }
      }
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // localStorage переполнен или заблокирован — молча игнорируем
    }
  },
  removeItem: (key: string): void => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ничего
    }
  },
};

// No-op lock: пропускает функцию acquireLock через setTimeout(0).
// Безопасно для нашего случая (одна вкладка авторизации, нет конкуренции
// между табами на refresh token). Полностью убирает риск orphaned lock.
const noopLock = async <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => {
  return await fn();
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: safeStorage,
    lock: noopLock,
  },
});
