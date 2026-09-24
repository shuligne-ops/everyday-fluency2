-- Prototype: longitudinal skill memory + spaced retrieval.
-- Isolated additive migration: no existing table/column is changed.

create table if not exists public.skill_memory (
  id uuid primary key default gen_random_uuid(),
  user_key text not null,
  move_id text not null references public.moves(id),
  strength integer not null default 0 check (strength between 0 and 5),
  successful_transfers integer not null default 0,
  failed_transfers integer not null default 0,
  last_transfer_score integer null check (last_transfer_score between 0 and 2),
  last_latency_ms integer null,
  best_latency_ms integer null,
  last_seen_at timestamptz null,
  next_probe_at timestamptz not null default now(),
  last_attempt_id uuid null,
  updated_at timestamptz not null default now(),
  unique (user_key, move_id)
);

create index if not exists skill_memory_due_idx
  on public.skill_memory (user_key, next_probe_at);

alter table public.skill_memory enable row level security;
revoke all on public.skill_memory from anon, authenticated;

-- Called only by server-side service-role code after a completed TRANSFER.
create or replace function public.update_skill_memory_from_transfer(
  p_user_key text,
  p_move_id text,
  p_attempt_id uuid,
  p_transfer_score integer,
  p_latency_ms integer default null
)
returns public.skill_memory
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v public.skill_memory;
  v_old_strength integer;
  v_new_strength integer;
  v_days integer;
begin
  if p_user_key is null or length(trim(p_user_key)) < 8 then
    raise exception 'skill memory requires a stable user key';
  end if;
  if p_transfer_score not between 0 and 2 then
    raise exception 'transfer score must be 0..2';
  end if;

  select strength into v_old_strength
  from public.skill_memory where user_key=p_user_key and move_id=p_move_id;

  v_old_strength := coalesce(v_old_strength, 0);
  v_new_strength := case
    when p_transfer_score = 2 then least(5, v_old_strength + 1)
    when p_transfer_score = 1 then greatest(0, v_old_strength)
    else greatest(0, v_old_strength - 1)
  end;

  -- Conservative prototype intervals: weak skills return quickly; demonstrated
  -- transfer earns progressively wider delayed probes.
  v_days := case
    when p_transfer_score = 0 then 1
    when p_transfer_score = 1 then 2
    else (array[1,3,7,14,30,60])[v_new_strength + 1]
  end;

  insert into public.skill_memory (
    user_key, move_id, strength, successful_transfers, failed_transfers,
    last_transfer_score, last_latency_ms, best_latency_ms,
    last_seen_at, next_probe_at, last_attempt_id, updated_at
  ) values (
    p_user_key, p_move_id, v_new_strength,
    case when p_transfer_score=2 then 1 else 0 end,
    case when p_transfer_score=0 then 1 else 0 end,
    p_transfer_score, p_latency_ms, p_latency_ms,
    now(), now() + make_interval(days => v_days), p_attempt_id, now()
  )
  on conflict (user_key, move_id) do update set
    strength = excluded.strength,
    successful_transfers = public.skill_memory.successful_transfers + case when p_transfer_score=2 then 1 else 0 end,
    failed_transfers = public.skill_memory.failed_transfers + case when p_transfer_score=0 then 1 else 0 end,
    last_transfer_score = p_transfer_score,
    last_latency_ms = p_latency_ms,
    best_latency_ms = case
      when p_latency_ms is null then public.skill_memory.best_latency_ms
      when public.skill_memory.best_latency_ms is null then p_latency_ms
      else least(public.skill_memory.best_latency_ms, p_latency_ms)
    end,
    last_seen_at = now(),
    next_probe_at = now() + make_interval(days => v_days),
    last_attempt_id = p_attempt_id,
    updated_at = now()
  returning * into v;

  return v;
end $fn$;

revoke all on function public.update_skill_memory_from_transfer(text,text,uuid,integer,integer) from public;
grant execute on function public.update_skill_memory_from_transfer(text,text,uuid,integer,integer) to service_role;
