-- Component B structured profile analysis output and unresolved-term review queue.

alter table public.profile_analysis_runs
  add column if not exists structured_profile jsonb not null default '{}'::jsonb;

create table if not exists public.unresolved_skill_terms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  analysis_run_id uuid not null references public.profile_analysis_runs(id) on delete cascade,
  source_block_id text references public.profile_source_blocks(id) on delete cascade,
  raw_term text not null,
  context text not null,
  status text not null default 'UNRESOLVED'
    check (status in ('UNRESOLVED','MAPPED','DISMISSED')),
  resolved_skill_id uuid references public.skills(id) on delete set null,
  resolution_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists ix_unresolved_skill_terms_run
  on public.unresolved_skill_terms(analysis_run_id,status,created_at);
create index if not exists ix_unresolved_skill_terms_user
  on public.unresolved_skill_terms(user_id,status,created_at desc);

alter table public.unresolved_skill_terms enable row level security;

create policy "unresolved_skill_terms_select_own"
on public.unresolved_skill_terms for select to authenticated
using (user_id=(select auth.uid()));
