create table if not exists public.lesson_events (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  lesson_id   bigint not null,
  level       text,
  event       text not null check (event in ('lesson_start', 'lesson_50')),
  created_at  timestamptz not null default now()
);

-- Одна запись на пару «пользователь + урок + событие», чтобы created_at
-- означал первое достижение вехи.
create unique index if not exists lesson_events_uniq
  on public.lesson_events (user_id, lesson_id, event);

alter table public.lesson_events enable row level security;

create policy "lesson_events_insert_own" on public.lesson_events
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "lesson_events_select_own" on public.lesson_events
  for select to authenticated
  using (auth.uid() = user_id);
