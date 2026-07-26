# Auth-lock: отчёт по диагностике и проверке

Дата проверки: 26 июля 2026 года.

## Часть 1 — наблюдаемость

Реализовано:

- `auth_error` отправляется тем же `track()` из `src/lib/analytics.ts`, что и существующие события. Параметры: `stage`, `reason`, `message`; `message` ограничен 200 символами.
- восстановление сессии через `supabase.auth.getSession()` ограничено 8 секундами;
- ошибки и таймауты восстановления сессии, списка уроков и отдельного урока приводят к одному видимому экрану восстановления;
- основная кнопка «Попробовать ещё раз» отправляет `auth_retry_clicked`, ждёт 400 мс и перезагружает страницу без очистки данных;
- вторичная кнопка «Восстановить доступ» отправляет `auth_recovery_clicked`, очищает данные и ждёт 400 мс перед перезагрузкой;
- кнопка очищает `localStorage`, перечисляемые базы IndexedDB, регистрации service worker и Cache Storage текущего origin, затем перезагружает страницу.
- сетевая проверка доступа к уроку также ограничена 8 секундами.

Локальная проверка:

1. Production-сборка `npm run build` прошла полностью, включая TypeScript и генерацию 25 страниц.
2. Подложен заведомо повреждённый ключ сохранённой auth-сессии. Вместо обычной страницы появился экран «Не удалось загрузить урок» с основной кнопкой повторной попытки и вторичной кнопкой восстановления.
3. «Попробовать ещё раз» перезагрузила страницу без очистки сохранённой сессии; «Восстановить доступ» очистила тестовые данные и вернула обычную страницу.
4. Доступ к Supabase был искусственно заблокирован после загрузки страницы. Смена уровня завершилась экраном восстановления (`lessons_fetch`).
5. При том же сетевом отказе открытие отдельного урока завершилось экраном восстановления после 8-секундного таймаута (`lesson_load`).

## Часть 2 — диагностика

### 2.1. `src/lib/supabase.ts` и production

Текст в `main` не совпадает с приложенной копией байт-в-байт: в реальном файле есть дополнительные поясняющие комментарии. Исполняемая реализация совпадает: `safeStorage` удаляет повреждённые и старше 30 секунд ключи `lock:`, а `noopLock` вызывает переданную функцию без блокировки.

Источник в репозитории: `src/lib/supabase.ts`, строки 1–69 в исходном `main` на коммите `f2d28cb`.

Фактическое содержимое `main` до этой работы:

```ts
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
```

На `https://everyday-fluency.ru/` эта реализация раскатана. Источник проверки: фактически загруженный клиентский JS-бандл `/_next/static/chunks/0_x8wpxo_forp.js`. В нём одновременно подтверждены проверка `startsWith("lock:")`, порог `3e4`, удаление повреждённого JSON, кастомный `storage` и `lock`, который непосредственно выполняет callback. Секреты из бандла в отчёт не переносились.

### 2.2. Версия `@supabase/supabase-js`

В `package.json` EF указана версия-диапазон `^2.45.0` (`package.json:12`). Это не точная зафиксированная версия. `package-lock.json:797–805` и `npm ls @supabase/supabase-js --depth=0` показывают фактически установленную версию `2.103.3`.

### 2.3. Несколько GoTrueClient

Предупреждение `Multiple GoTrueClient instances detected` в консоли production не появилось:

- одна свежая анонимная загрузка во встроенном браузере: 0 warning/error;
- две свежие авторизованные вкладки Chrome: 0 warning/error в обеих.

Поиск `createClient(` по `src` показал один браузерный вызов: `src/lib/supabase.ts:61`. Остальные вызовы находятся только в серверных обработчиках `src/app/api/**/route.ts` и не создают второй GoTrueClient в браузере. Компоненты и хуки импортируют singleton `supabase` из `src/lib/supabase.ts`.

### 2.4. Service worker / PWA

Service worker на production не зарегистрирован. В двух разных браузерных профилях получено одинаковое состояние: `navigator.serviceWorker.controller === null`, `getRegistrations()` вернул пустой массив.

В `main` также нет отслеживаемых файлов service worker/manifest/workbox, зависимости `next-pwa`, вызова `navigator.serviceWorker.register` или конфигурации кэширования. Поэтому стратегии кэширования HTML и JS-бандлов нет; гипотеза про устаревший cache-first service worker не подтвердилась.

### 2.5. Гонка refresh-токена

Сокращённая двухвкладочная проверка выполнена в существующей авторизованной production-сессии: обе вкладки одновременно сохранили вход, загрузили разные уровни и не дали auth/network ошибок или предупреждений консоли.

Строгий сценарий «оставить обе вкладки открытыми дольше часа, затем работать в обеих» в рамках этой проверки не завершён. Поэтому результат формулируется так: **в немедленной двухвкладочной проверке не воспроизвелось; гонка на границе автоматического refresh-токена не подтверждена и не опровергнута**.

## Часть 3 — починка

Из диагностических гипотез не подтверждены ни устаревший service worker, ни гонка refresh-токена. По правилу задания изменений service worker или `noopLock` нет. Зависание восстановления сессии закрыто обязательным 8-секундным таймаутом из части 1.

## Проверка для Шу

1. Войти, открыть урок, закрыть вкладку, на следующий день снова открыть сайт и урок. Ожидается обычная загрузка; при отказе — экран восстановления вместо спиннера.
2. Открыть сайт в двух вкладках, в каждой переключить уровень и открыть урок. Ожидается загрузка в обеих вкладках без выхода из аккаунта.
3. В DevTools включить Slow 3G, затем кратко включить Offline и сменить уровень или открыть урок. Ожидается экран «Не удалось загрузить урок» и цель Метрики `auth_error` со стадией `lessons_fetch` или `lesson_load`.
4. В Application → Local Storage добавить ключ вида `sb-codex-auth-test-auth-token` со значением `{not-json`, затем перезагрузить страницу. Ожидается экран восстановления, а не бесконечный спиннер; цель `auth_error` имеет `stage: session_restore` и `reason: no_session`.
5. При кратком сетевом сбое нажать «Попробовать ещё раз». Ожидается цель `auth_retry_clicked` и перезагрузка без выхода из аккаунта.
6. Если повторная попытка не помогла, нажать «Восстановить доступ». Ожидается цель `auth_recovery_clicked`, очистка хранилищ и перезагрузка. После этого войти заново и открыть урок.
7. В Яндекс.Метрике проверить, что у `auth_error` есть `stage`, `reason`, `message`, а `message` не длиннее 200 символов.
