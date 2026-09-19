
-- Component I: Journey Chat persistence and action proposal lifecycle.

create table if not exists public.journey_chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null default 'SkillTwin journey',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists journey_chat_threads_touch_updated_at on public.journey_chat_threads;
create trigger journey_chat_threads_touch_updated_at
before update on public.journey_chat_threads
for each row execute function public.touch_updated_at();

create table if not exists public.journey_chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.journey_chat_threads(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null check (role in ('USER','ASSISTANT')),
  content text not null,
  intent text,
  entity_refs jsonb not null default '[]'::jsonb,
  evidence_refs jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_action_proposals (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.journey_chat_threads(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  source_message_id uuid not null references public.journey_chat_messages(id) on delete cascade,
  action_type text not null check (action_type in ('UNDO_PLAN_DIFF','START_ASSESSMENT','GENERATE_PLAN')),
  payload jsonb not null,
  baseline_ref jsonb not null default '{}'::jsonb,
  status text not null default 'PROPOSED' check (status in ('PROPOSED','CONFIRMED','EXECUTED','REJECTED','EXPIRED','FAILED')),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  executed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists ix_chat_threads_user_updated
  on public.journey_chat_threads(user_id,updated_at desc);
create index if not exists ix_chat_messages_thread
  on public.journey_chat_messages(thread_id,created_at);
create index if not exists ix_chat_messages_user
  on public.journey_chat_messages(user_id,created_at desc);
create index if not exists ix_chat_proposals_user_status
  on public.chat_action_proposals(user_id,status,created_at desc);

alter table public.journey_chat_threads enable row level security;
alter table public.journey_chat_messages enable row level security;
alter table public.chat_action_proposals enable row level security;

create policy "chat_threads_select_own"
on public.journey_chat_threads for select to authenticated
using (user_id=(select auth.uid()));

create policy "chat_messages_select_own"
on public.journey_chat_messages for select to authenticated
using (user_id=(select auth.uid()));

create policy "chat_proposals_select_own"
on public.chat_action_proposals for select to authenticated
using (user_id=(select auth.uid()));
