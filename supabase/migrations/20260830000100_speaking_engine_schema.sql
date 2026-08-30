-- Speaking Engine: каталог ходов, программы, сценарии, рубрики, попытки, эталоны.
-- Диагностика не трогается: diagnostic_sessions получает только nullable-ссылки.

create extension if not exists pgcrypto;

-- ── 1. Каталог коммуникативных ходов ─────────────────────────────────────────
create table if not exists public.moves (
  id             text primary key,
  title_ru       text not null,
  title_en       text not null,
  description_ru text not null,
  mechanism      text not null,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

-- ── 2. Программы и позиции ходов в них ───────────────────────────────────────
create table if not exists public.programs (
  id          text primary key,
  title_ru    text not null,
  weeks       integer not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.program_moves (
  program_id  text not null references public.programs(id),
  move_id     text not null references public.moves(id),
  position    integer not null,
  primary key (program_id, move_id),
  unique (program_id, position)
);

-- ── 3. Сценарии: два текста на сцену — студенту и модели ─────────────────────
create table if not exists public.scenarios (
  id                 uuid primary key default gen_random_uuid(),
  move_id            text not null references public.moves(id),
  kind               text not null check (kind in ('try','retry','transfer','test_a','test_b')),
  version            integer not null default 1,
  screen_title_ru    text null,
  situation_ru       text not null,
  situation_model_ru text not null,
  instruction_ru     text null,
  power_note         text null,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  unique (move_id, kind, version)
);

-- ── 4. Рубрики: kind обязателен, на ход приходится три разных промпта ────────
create table if not exists public.rubrics (
  id            uuid primary key default gen_random_uuid(),
  move_id       text not null references public.moves(id),
  kind          text not null check (kind in ('try','retry','transfer','test_a','test_b')),
  version       integer not null default 1,
  channel       text not null check (channel in ('transcript','audio_features','both')),
  system_prompt text not null,
  output_schema jsonb not null,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (move_id, kind, version)
);

-- ── 5. Эталонные фрагменты корпуса (создаются пустыми) ───────────────────────
create table if not exists public.reference_clips (
  id            uuid primary key default gen_random_uuid(),
  lesson_id     bigint null,
  turns         jsonb not null,
  context_ru    text not null,
  relationship  text null check (relationship in
                  ('peer','friend','family','partner','client','manager','subordinate','stranger')),
  is_workplace  boolean not null default false,
  audio_path    text null,
  is_anchor     boolean not null default false,
  created_at    timestamptz not null default now()
);

create table if not exists public.reference_clip_moves (
  clip_id     uuid not null references public.reference_clips(id) on delete cascade,
  move_id     text not null references public.moves(id),
  sort_order  integer not null default 0,
  primary key (clip_id, move_id)
);

-- ── 6. Попытки тренировки ────────────────────────────────────────────────────
create table if not exists public.speaking_attempts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null,
  cohort_id       text null,
  program_id      text null references public.programs(id),
  move_id         text not null references public.moves(id),
  scenario_id     uuid null references public.scenarios(id),
  rubric_id       uuid null references public.rubrics(id),
  cycle_id        uuid not null,
  step            text not null check (step in ('try','retry','retrieval','replay','transfer','test_a','test_b')),
  audio_path      text null,
  transcript      text null,
  duration_ms     integer null,
  latency_ms      integer null,
  audio_features  jsonb null,
  evaluation      jsonb null,
  model_used      text null,
  created_at      timestamptz not null default now()
);

create index if not exists speaking_attempts_user_idx  on public.speaking_attempts (user_id, created_at desc);
create index if not exists speaking_attempts_cycle_idx on public.speaking_attempts (cycle_id);
create index if not exists speaking_attempts_move_idx  on public.speaking_attempts (move_id);

-- ── 7. Связь с диагностикой: только nullable-ссылки ──────────────────────────
alter table public.diagnostic_sessions
  add column if not exists scenario_id uuid null references public.scenarios(id),
  add column if not exists rubric_id   uuid null references public.rubrics(id),
  add column if not exists model_used  text null;

-- ── 8. Слепая человеческая оценка ────────────────────────────────────────────
create table if not exists public.human_ratings (
  id            uuid primary key default gen_random_uuid(),
  attempt_id    uuid null references public.speaking_attempts(id),
  session_id    uuid null references public.diagnostic_sessions(id),
  rater         text not null,
  task_success  boolean null,
  strategy_fit  text null check (strategy_fit in ('fit','partial','misfit')),
  register_fit  text null check (register_fit in ('fit','partial','misfit')),
  major_issue   boolean null,
  transfer_ok   boolean null,
  note_ru       text null,
  created_at    timestamptz not null default now(),
  check (num_nonnulls(attempt_id, session_id) = 1)
);

create unique index if not exists human_ratings_attempt_rater
  on public.human_ratings (attempt_id, rater) where attempt_id is not null;
create unique index if not exists human_ratings_session_rater
  on public.human_ratings (session_id, rater) where session_id is not null;

-- ── 9. Иммутабельность сценариев после первого использования ─────────────────
create or replace function public.prevent_scenario_mutation() returns trigger
language plpgsql as $fn$
begin
  if exists (select 1 from public.speaking_attempts where scenario_id = old.id)
     or exists (select 1 from public.diagnostic_sessions where scenario_id = old.id) then
    if new.situation_ru          is distinct from old.situation_ru
       or new.situation_model_ru is distinct from old.situation_model_ru
       or new.instruction_ru     is distinct from old.instruction_ru
       or new.power_note         is distinct from old.power_note then
      raise exception 'Сценарий % уже использован в попытках. Создайте новую версию.', old.id;
    end if;
  end if;
  return new;
end $fn$;

drop trigger if exists scenarios_immutable on public.scenarios;
create trigger scenarios_immutable
  before update on public.scenarios
  for each row execute function public.prevent_scenario_mutation();

-- ── 10. Запись попыток тренировки — через SECURITY DEFINER RPC ───────────────
create or replace function public.record_speaking_attempt(
  p_user_id     uuid,
  p_move_id     text,
  p_cycle_id    uuid,
  p_step        text,
  p_scenario_id uuid default null,
  p_rubric_id   uuid default null,
  p_program_id  text default null,
  p_cohort_id   text default null,
  p_transcript  text default null,
  p_duration_ms integer default null,
  p_latency_ms  integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_attempt_id uuid;
begin
  -- Пишем только свою попытку: SECURITY DEFINER снимает RLS, проверка обязательна.
  if p_user_id is null or p_user_id is distinct from auth.uid() then
    raise exception 'record_speaking_attempt: попытка пишется только своим пользователем';
  end if;

  insert into public.speaking_attempts (
    user_id, move_id, cycle_id, step, scenario_id, rubric_id,
    program_id, cohort_id, transcript, duration_ms, latency_ms
  ) values (
    p_user_id, p_move_id, p_cycle_id, p_step, p_scenario_id, p_rubric_id,
    p_program_id, p_cohort_id, p_transcript, p_duration_ms, p_latency_ms
  ) returning id into v_attempt_id;

  return v_attempt_id;
end $fn$;

revoke all on function public.record_speaking_attempt(uuid, text, uuid, text, uuid, uuid, text, text, text, integer, integer) from public;
grant execute on function public.record_speaking_attempt(uuid, text, uuid, text, uuid, uuid, text, text, text, integer, integer) to authenticated, service_role;

-- ── 11. RLS ──────────────────────────────────────────────────────────────────
alter table public.moves                enable row level security;
alter table public.programs             enable row level security;
alter table public.program_moves        enable row level security;
alter table public.scenarios            enable row level security;
alter table public.rubrics              enable row level security;
alter table public.reference_clips      enable row level security;
alter table public.reference_clip_moves enable row level security;
alter table public.speaking_attempts    enable row level security;
alter table public.human_ratings        enable row level security;

drop policy if exists "Public reads active moves" on public.moves;
create policy "Public reads active moves"
  on public.moves for select to anon, authenticated using (is_active = true);

drop policy if exists "Public reads active programs" on public.programs;
create policy "Public reads active programs"
  on public.programs for select to anon, authenticated using (is_active = true);

drop policy if exists "Public reads program moves" on public.program_moves;
create policy "Public reads program moves"
  on public.program_moves for select to anon, authenticated using (true);

drop policy if exists "Public reads active scenarios" on public.scenarios;
create policy "Public reads active scenarios"
  on public.scenarios for select to anon, authenticated using (is_active = true);

drop policy if exists "Public reads reference clips" on public.reference_clips;
create policy "Public reads reference clips"
  on public.reference_clips for select to anon, authenticated using (true);

drop policy if exists "Public reads reference clip moves" on public.reference_clip_moves;
create policy "Public reads reference clip moves"
  on public.reference_clip_moves for select to anon, authenticated using (true);

drop policy if exists "Users read their speaking attempts" on public.speaking_attempts;
create policy "Users read their speaking attempts"
  on public.speaking_attempts for select to authenticated using (user_id = auth.uid());

-- rubrics и human_ratings: RLS включён, политик для anon/authenticated нет —
-- читает только service_role, который RLS обходит.

-- ── 12. Колоночные привилегии ────────────────────────────────────────────────
-- situation_model_ru — текст, по которому оценивается ответ. Клиент его получать
-- не должен, поэтому select выдаётся по списку колонок, а не на таблицу целиком.
revoke all on public.scenarios     from anon, authenticated;
revoke all on public.rubrics       from anon, authenticated;
revoke all on public.human_ratings from anon, authenticated;

grant select (id, move_id, kind, version, screen_title_ru, situation_ru,
              instruction_ru, power_note, is_active, created_at)
  on public.scenarios to anon, authenticated;

grant select on public.moves                to anon, authenticated;
grant select on public.programs             to anon, authenticated;
grant select on public.program_moves        to anon, authenticated;
grant select on public.reference_clips      to anon, authenticated;
grant select on public.reference_clip_moves to anon, authenticated;
grant select on public.speaking_attempts    to authenticated;
