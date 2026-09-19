-- Full frozen-spec expansion: onboarding/preferences, reporting, recommendations,
-- resource feedback, task behavior, custom-role audit, and learner settings.

alter table public.users
  add column if not exists onboarding_step integer not null default 0 check (onboarding_step between 0 and 4),
  add column if not exists onboarding_completed_at timestamptz;

alter table public.career_goals
  add column if not exists career_objective text,
  add column if not exists goal_description text,
  add column if not exists experience_level text check (experience_level is null or experience_level in ('BEGINNER','SOME_EXPERIENCE','INTERMEDIATE','ADVANCED'));

alter table public.learning_tasks
  add column if not exists started_at timestamptz,
  add column if not exists skipped_at timestamptz,
  add column if not exists actual_minutes integer check (actual_minutes is null or actual_minutes >= 0),
  add column if not exists reschedule_count integer not null default 0 check (reschedule_count >= 0);

create table if not exists public.user_learning_settings (
  user_id uuid primary key references public.users(id) on delete cascade,
  notifications_enabled boolean not null default true,
  weekly_report_enabled boolean not null default true,
  reduced_motion boolean not null default false,
  compact_density boolean not null default false,
  updated_at timestamptz not null default now()
);

drop trigger if exists user_learning_settings_touch_updated_at on public.user_learning_settings;
create trigger user_learning_settings_touch_updated_at
before update on public.user_learning_settings
for each row execute function public.touch_updated_at();

create table if not exists public.role_generation_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  requested_role_name text not null,
  requested_level text not null check (requested_level in ('ENTRY','MID','ADVANCED')),
  goal_description text,
  status text not null check (status in ('RUNNING','COMPLETE','FAILED')),
  provider text,
  model_version text,
  candidate_json jsonb,
  validation_report jsonb,
  result_role_id uuid references public.target_roles(id) on delete set null,
  result_role_version_id uuid references public.role_versions(id) on delete set null,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists ix_role_generation_user_created
  on public.role_generation_runs(user_id,created_at desc);

create table if not exists public.resource_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  resource_id uuid not null references public.learning_resources(id) on delete cascade,
  task_id uuid references public.learning_tasks(id) on delete set null,
  signal text not null check (signal in ('HELPFUL','NOT_HELPFUL','TOO_EASY','TOO_HARD','TOO_LONG','PREFERRED_FORMAT')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ix_resource_feedback_user_created
  on public.resource_feedback(user_id,created_at desc);
create index if not exists ix_resource_feedback_resource
  on public.resource_feedback(resource_id);

create table if not exists public.task_activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  task_id uuid not null references public.learning_tasks(id) on delete cascade,
  event_type text not null check (event_type in ('STARTED','COMPLETED','SKIPPED','RESCHEDULED','DURATION_RECORDED')),
  from_due_at timestamptz,
  to_due_at timestamptz,
  actual_minutes integer check (actual_minutes is null or actual_minutes >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ix_task_activity_user_created
  on public.task_activity_events(user_id,created_at desc);
create index if not exists ix_task_activity_task
  on public.task_activity_events(task_id,created_at desc);

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

create index if not exists ix_project_recommendations_user_created
  on public.project_recommendations(user_id,created_at desc);
create index if not exists ix_project_recommendations_gap
  on public.project_recommendations(gap_snapshot_id);

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

create index if not exists ix_weekly_reports_user_week
  on public.weekly_reports(user_id,week_start desc);

alter table public.user_learning_settings enable row level security;
alter table public.role_generation_runs enable row level security;
alter table public.resource_feedback enable row level security;
alter table public.task_activity_events enable row level security;
alter table public.project_recommendations enable row level security;
alter table public.weekly_reports enable row level security;

create policy "user_learning_settings_select_own"
on public.user_learning_settings for select to authenticated
using (user_id=(select auth.uid()));

create policy "user_learning_settings_insert_own"
on public.user_learning_settings for insert to authenticated
with check (user_id=(select auth.uid()));

create policy "user_learning_settings_update_own"
on public.user_learning_settings for update to authenticated
using (user_id=(select auth.uid()))
with check (user_id=(select auth.uid()));

create policy "role_generation_runs_select_own"
on public.role_generation_runs for select to authenticated
using (user_id=(select auth.uid()));

create policy "resource_feedback_select_own"
on public.resource_feedback for select to authenticated
using (user_id=(select auth.uid()));

create policy "resource_feedback_insert_own"
on public.resource_feedback for insert to authenticated
with check (user_id=(select auth.uid()));

create policy "task_activity_events_select_own"
on public.task_activity_events for select to authenticated
using (user_id=(select auth.uid()));

create policy "project_recommendations_select_own"
on public.project_recommendations for select to authenticated
using (user_id=(select auth.uid()));

create policy "weekly_reports_select_own"
on public.weekly_reports for select to authenticated
using (user_id=(select auth.uid()));
