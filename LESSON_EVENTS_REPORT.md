# Персистентные вехи уроков — отчёт и проверка

Дата: 26 июля 2026 года.

## Что изменено

- Миграция `supabase/migrations/20260726000100_add_lesson_events.sql` создаёт `public.lesson_events`, уникальный индекс и две RLS-политики для собственных строк пользователя.
- `src/lib/lessonEvents.ts` записывает `lesson_start` и `lesson_50` только для залогиненного пользователя.
- Запись выполняется fire-and-forget, не блокирует урок и только пишет `console.warn` при ошибке.
- Повторные события используют `upsert` с `onConflict: 'user_id,lesson_id,event'` и `ignoreDuplicates: true`; `created_at` остаётся временем первого достижения.
- `@supabase/supabase-js` закреплён на `2.103.3` без каретки.

Встроенный урок `meeting-disagreement` имеет строковый slug, который нельзя записать в `lesson_id bigint`. Функция молча пропускает нечисловые id; обычные уроки из `lessons_v2` имеют числовые id и записываются.

## SQL для воскресной проверки

```sql
select
  u.email,
  le.event,
  le.level,
  le.lesson_id,
  le.created_at
from public.lesson_events le
join auth.users u on u.id = le.user_id
where u.email = any($1)      -- массив почт тестировщиков
order by u.email, le.created_at;
```

Пример выполнения через подготовленный запрос PostgreSQL:

```sql
prepare lesson_events_for_testers(text[]) as
select
  u.email,
  le.event,
  le.level,
  le.lesson_id,
  le.created_at
from public.lesson_events le
join auth.users u on u.id = le.user_id
where u.email = any($1)
order by u.email, le.created_at;

execute lesson_events_for_testers(array[
  'tester1@example.com',
  'tester2@example.com'
]);
```

## Ограничение live-проверки

В текущем окружении нет Supabase CLI и строки подключения к PostgreSQL проекта `nipwmdjchoibemjkvlrf`. Public/anon и service-role REST credentials не дают выполнить DDL или запрос с join к `auth.users`. Поэтому миграция не применялась к облачному проекту, а воскресный SQL не выполнялся на production. До применения миграции клиентские вставки будут безопасно завершаться только `console.warn`.

Read-only запрос к production REST подтвердил текущее состояние до миграции: HTTP 404, `PGRST205`, `Could not find the table 'public.lesson_events' in the schema cache`.

## Проверка для Шу

### Миграция

1. Применить `supabase/migrations/20260726000100_add_lesson_events.sql` к проекту EF `nipwmdjchoibemjkvlrf`.
2. Проверить в Table Editor наличие `public.lesson_events` и уникального индекса `lesson_events_uniq`.
3. Проверить, что RLS включён и существуют политики `lesson_events_insert_own` и `lesson_events_select_own`.

### Приложение

1. Развернуть ветку после применения миграции.
2. Войти тестовым пользователем и открыть обычный числовой урок.
3. Убедиться, что появилась одна строка `lesson_start` с правильными `user_id`, `lesson_id` и `level`.
4. Дойти до четырёх пользовательских реплик — того же порога, что использует Метрика для `lesson_50`.
5. Убедиться, что появилась одна строка `lesson_50`.
6. Перезагрузить страницу и повторить урок. Новых строк для тех же `user_id + lesson_id + event` быть не должно, а исходный `created_at` не должен измениться.
7. Выйти из аккаунта и открыть бесплатный урок. Новых строк в `lesson_events` быть не должно.
8. Выполнить подготовленный запрос выше с реальными пятью адресами и проверить хронологию `lesson_start`/`lesson_50`.
