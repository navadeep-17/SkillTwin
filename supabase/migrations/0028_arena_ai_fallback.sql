-- Arena 20-second opt-in/out AI fallback. Deploy before the API/UX.
-- No edits to evidence/assessment scores, existing human matches or credentials.
begin;
alter table public.arena_lobby
  add column if not exists queued_at timestamptz not null default clock_timestamp();
-- Existing WAITING users have their wait eligibility restarted at migration time,
-- so nobody is accidentally forced into a bot match during deployment.
update public.arena_lobby set queued_at=clock_timestamp()
  where status='WAITING';

create or replace function public.arena_lobby_queue_reset()
returns trigger language plpgsql set search_path='' as $$
begin
  if TG_OP='INSERT' or new.status='WAITING' and
    (old.status is distinct from 'WAITING' or old.topic is distinct from new.topic) then
    new.queued_at:=clock_timestamp();
  end if;
  return new;
end;
$$;
-- The existing on-conflict upsert does not change queued_at for same-topic heartbeats.
drop trigger if exists arena_lobby_queue_reset on public.arena_lobby;
create trigger arena_lobby_queue_reset before insert or update on public.arena_lobby
  for each row execute function public.arena_lobby_queue_reset();

create table if not exists public.arena_ai_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  topic text not null check (topic in ('python','sql','javascript')),
  mode text not null check(mode in ('PREPARING','AI','SOLO')),
  picks smallint[],
  created_at timestamptz not null default clock_timestamp(),
  started_at timestamptz,
  constraint arena_ai_session_picks check (
    (mode='PREPARING' and picks is null and started_at is null)
    or (mode='SOLO' and picks is null and started_at is not null)
    or (mode='AI' and picks is not null and array_length(picks,1)=5
      and 0<=all(picks) and 3>=all(picks) and started_at is not null)
  )
);
create table if not exists public.arena_ai_answers (
  session_id uuid not null references public.arena_ai_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  question_no smallint not null check(question_no between 1 and 5),
  option_index smallint not null check(option_index between 0 and 3),
  submitted_at timestamptz not null default clock_timestamp(),
  primary key(session_id,user_id,question_no)
);
create index if not exists arena_ai_answers_user_idx on public.arena_ai_answers(user_id,session_id);
create index if not exists arena_ai_sessions_user_started_idx on public.arena_ai_sessions(user_id,started_at);

alter table public.arena_ai_sessions enable row level security;
alter table public.arena_ai_answers enable row level security;
-- Deny all direct browser table access, including AI answer picks.
revoke all on public.arena_ai_sessions,public.arena_ai_answers from public,anon,authenticated;
-- Server-only code accesses them with an elevated DATABASE role, after verifying
-- the session through Supabase Auth, never using a client-controlled user_id.

-- Protect the previous human pairing RPC from creating an overlapping active
-- human match during an AI or solo session. Existing RPCs still own human queue.
create or replace function public.arena_guard_human_lobby()
returns trigger language plpgsql set search_path='' as $$
begin
  if exists (
    select 1 from public.arena_ai_sessions s
    where s.user_id=new.user_id and (
      (s.mode='PREPARING' and s.created_at > clock_timestamp()-interval '25 seconds')
      or (s.mode in ('AI','SOLO') and s.started_at >
        clock_timestamp()-interval '150 seconds')
    )
  ) then raise exception 'ARENA_AI_ACTIVE'; end if;
  return new;
end;
$$;
drop trigger if exists arena_guard_human_lobby on public.arena_lobby;
create trigger arena_guard_human_lobby before insert or update on public.arena_lobby
  for each row execute function public.arena_guard_human_lobby();
commit;
