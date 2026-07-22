-- Один диагностический проход связывает TRY, RETRY и TRANSFER через attempt_id.
-- Старые бета-строки остаются валидными: столбец намеренно nullable.
alter table public.diagnostic_sessions
  add column if not exists attempt_id uuid null;

create index if not exists diagnostic_sessions_attempt_idx
  on public.diagnostic_sessions (attempt_id);

-- PostgreSQL не позволяет изменить сигнатуру CREATE OR REPLACE FUNCTION,
-- поэтому заменяем только эту RPC-функцию, сохраняя SECURITY DEFINER и grants.
drop function if exists public.record_diagnostic_session(text, text, text, text, integer, integer);

create function public.record_diagnostic_session(
  p_anon_id text,
  p_move text,
  p_step text,
  p_transcript text,
  p_duration_ms integer,
  p_latency_ms integer,
  p_attempt_id uuid
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
    anon_id, move, step, transcript, duration_ms, latency_ms, attempt_id
  ) values (
    p_anon_id,
    coalesce(p_move, 'face_saving_correction'),
    p_step,
    p_transcript,
    p_duration_ms,
    p_latency_ms,
    p_attempt_id
  ) returning id into v_session_id;

  return v_session_id;
end;
$$;

revoke all on function public.record_diagnostic_session(text, text, text, text, integer, integer, uuid) from public;
grant execute on function public.record_diagnostic_session(text, text, text, text, integer, integer, uuid) to anon, authenticated, service_role;
