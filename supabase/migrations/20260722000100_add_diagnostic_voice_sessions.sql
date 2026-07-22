-- День 1 voice-slice: приватное аудио и анонимные диагностические сессии.
create extension if not exists pgcrypto;

insert into storage.buckets (id, name, public)
values ('diagnostic-audio', 'diagnostic-audio', false)
on conflict (id) do update set public = false;

create table if not exists public.diagnostic_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  anon_id text null,
  move text not null default 'face_saving_correction',
  step text not null check (step in ('try', 'retry', 'transfer')),
  audio_path text null,
  transcript text null,
  duration_ms integer null,
  latency_ms integer null,
  created_at timestamptz not null default now()
);

alter table public.diagnostic_sessions enable row level security;

drop policy if exists "Users can read their diagnostic sessions" on public.diagnostic_sessions;
create policy "Users can read their diagnostic sessions"
  on public.diagnostic_sessions for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Anonymous diagnostic session inserts" on public.diagnostic_sessions;
create policy "Anonymous diagnostic session inserts"
  on public.diagnostic_sessions for insert
  to anon, authenticated
  with check (true);

-- Прямой INSERT от anon в этом проекте ненадёжен (42501), поэтому клиент
-- использует SECURITY DEFINER RPC, а не пишет в таблицу напрямую.
create or replace function public.record_diagnostic_session(
  p_anon_id text,
  p_move text,
  p_step text,
  p_transcript text,
  p_duration_ms integer,
  p_latency_ms integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
begin
  insert into public.diagnostic_sessions (
    anon_id, move, step, transcript, duration_ms, latency_ms
  ) values (
    p_anon_id,
    coalesce(p_move, 'face_saving_correction'),
    p_step,
    p_transcript,
    p_duration_ms,
    p_latency_ms
  ) returning id into v_session_id;

  return v_session_id;
end;
$$;

create or replace function public.update_diagnostic_audio_path(
  p_session_id uuid,
  p_audio_path text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.diagnostic_sessions
  set audio_path = p_audio_path
  where id = p_session_id;
end;
$$;

revoke all on function public.record_diagnostic_session(text, text, text, text, integer, integer) from public;
grant execute on function public.record_diagnostic_session(text, text, text, text, integer, integer) to anon, authenticated, service_role;

revoke all on function public.update_diagnostic_audio_path(uuid, text) from public;
grant execute on function public.update_diagnostic_audio_path(uuid, text) to service_role;

drop policy if exists "Anonymous uploads diagnostic audio" on storage.objects;
create policy "Anonymous uploads diagnostic audio"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'diagnostic-audio');
