-- Persist supporting P1/P2 product surfaces that were introduced during product-completion work.
-- These tables remain server-write / user-read so canonical mutations stay behind validated APIs.

create table if not exists public.unresolved_skill_terms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  analysis_run_id uuid not null references public.profile_analysis_runs(id) on delete cascade,
  source_block_id text references public.profile_source_blocks(id) on delete cascade,
  raw_term text not null,
  context text not null,
  status text not null default 'UNRESOLVED' check (status in ('UNRESOLVED','MAPPED','DISMISSED')),
  resolved_skill_id uuid references public.skills(id) on delete set null,
  resolution_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists ix_unresolved_skill_terms_user
  on public.unresolved_skill_terms(user_id,created_at desc);
create index if not exists ix_unresolved_skill_terms_run
  on public.unresolved_skill_terms(analysis_run_id);
create index if not exists ix_unresolved_skill_terms_resolved_skill
  on public.unresolved_skill_terms(resolved_skill_id);

create table if not exists public.project_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  goal_id uuid not null references public.career_goals(id) on delete cascade,
  gap_snapshot_id uuid not null references public.gap_snapshots(id) on delete cascade,
  title text not null,
  summary text not null,
  target_skill_ids jsonb not null default '[]'::jsonb,
  technologies jsonb not null default '[]'::jsonb,
  requirements jsonb not null default '[]'::jsonb,
  milestones jsonb not null default '[]'::jsonb,
  success_criteria jsonb not null default '[]'::jsonb,
  estimated_minutes integer not null check (estimated_minutes > 0),
  difficulty text not null check (difficulty in ('BASIC','STANDARD','ADVANCED')),
  rationale text not null,
  generator_version text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','STARTED','COMPLETED','DISMISSED')),
  created_at timestamptz not null default now()
);

create index if not exists ix_project_recommendations_user
  on public.project_recommendations(user_id,created_at desc);
create index if not exists ix_project_recommendations_gap
  on public.project_recommendations(gap_snapshot_id);
create index if not exists ix_project_recommendations_goal
  on public.project_recommendations(goal_id);

create table if not exists public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  goal_id uuid references public.career_goals(id) on delete set null,
  week_start date not null,
  week_end date not null,
  readiness_start integer,
  readiness_end integer,
  tasks_completed integer not null default 0,
  learning_minutes integer not null default 0,
  assessments_completed integer not null default 0,
  skills_changed integer not null default 0,
  roadmap_changes integer not null default 0,
  improving_skill_ids jsonb not null default '[]'::jsonb,
  attention_skill_ids jsonb not null default '[]'::jsonb,
  summary text not null,
  recommended_next_step text,
  report_version text not null,
  created_at timestamptz not null default now(),
  unique(user_id,week_start,report_version),
  check (week_end >= week_start)
);

create index if not exists ix_weekly_reports_user
  on public.weekly_reports(user_id,week_start desc);
create index if not exists ix_weekly_reports_goal
  on public.weekly_reports(goal_id);

alter table public.unresolved_skill_terms enable row level security;
alter table public.project_recommendations enable row level security;
alter table public.weekly_reports enable row level security;

drop policy if exists "unresolved_skill_terms_select_own" on public.unresolved_skill_terms;
create policy "unresolved_skill_terms_select_own"
on public.unresolved_skill_terms for select to authenticated
using (user_id=(select auth.uid()));

drop policy if exists "project_recommendations_select_own" on public.project_recommendations;
create policy "project_recommendations_select_own"
on public.project_recommendations for select to authenticated
using (user_id=(select auth.uid()));

drop policy if exists "weekly_reports_select_own" on public.weekly_reports;
create policy "weekly_reports_select_own"
on public.weekly_reports for select to authenticated
using (user_id=(select auth.uid()));
