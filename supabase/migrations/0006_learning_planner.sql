-- Component D persistence: versioned learning plans, tasks, verified resources, and generation idempotency.
create table if not exists public.learning_resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  provider text not null,
  url text not null unique,
  tags jsonb not null default '[]'::jsonb,
  levels jsonb not null default '[]'::jsonb,
  format text not null check (format in ('DOCS','VIDEO','PRACTICE','PROJECT','ARTICLE')),
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  quality numeric(5,4) not null check (quality between 0 and 1),
  is_verified boolean not null default false,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE','BROKEN')),
  catalog_version text not null,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists learning_resources_touch_updated_at on public.learning_resources;
create trigger learning_resources_touch_updated_at
before update on public.learning_resources
for each row execute function public.touch_updated_at();

create table if not exists public.learning_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  goal_id uuid not null references public.career_goals(id) on delete cascade,
  version integer not null check (version > 0),
  status text not null check (status in ('DRAFT','ACTIVE','SUPERSEDED','ARCHIVED')),
  start_date date not null,
  end_date date not null,
  gap_snapshot_id uuid not null references public.gap_snapshots(id) on delete restrict,
  constraint_fingerprint text not null,
  planner_version text not null,
  generation_key text not null unique,
  planned_minutes integer not null default 0 check (planned_minutes >= 0),
  adaptation_buffer_minutes integer not null check (adaptation_buffer_minutes >= 0),
  rationale jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  parent_plan_id uuid references public.learning_plans(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(goal_id,version),
  check (end_date >= start_date)
);

create unique index if not exists one_active_plan_per_goal
on public.learning_plans(goal_id)
where status='ACTIVE';

create table if not exists public.plan_weeks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.learning_plans(id) on delete cascade,
  week_index integer not null check (week_index > 0),
  start_date date not null,
  end_date date not null,
  capacity_minutes integer not null check (capacity_minutes > 0),
  planned_minutes integer not null check (planned_minutes >= 0),
  focus_skill_ids jsonb not null default '[]'::jsonb,
  rationale text,
  created_at timestamptz not null default now(),
  unique(plan_id,week_index),
  check (end_date >= start_date),
  check (planned_minutes <= capacity_minutes)
);

create table if not exists public.learning_objectives (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.learning_plans(id) on delete cascade,
  week_id uuid not null references public.plan_weeks(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete restrict,
  requirement_id uuid not null references public.role_skill_requirements(id) on delete restrict,
  type text not null check (type in ('ACQUIRE','VALIDATE_FIRST','REINFORCE','MAINTAIN')),
  start_score numeric(5,3),
  target_score numeric(5,3) not null check (target_score between 0 and 4),
  success_criteria text not null,
  priority_at_creation numeric(5,4) not null check (priority_at_creation between 0 and 1),
  status text not null default 'PLANNED' check (status in ('PLANNED','IN_PROGRESS','COMPLETED','DEFERRED')),
  created_at timestamptz not null default now()
);

create table if not exists public.learning_tasks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.learning_plans(id) on delete cascade,
  week_id uuid not null references public.plan_weeks(id) on delete cascade,
  objective_id uuid not null references public.learning_objectives(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete restrict,
  type text not null check (type in ('LEARN','PRACTICE','BUILD','VALIDATE')),
  title text not null,
  duration_minutes integer not null check (duration_minutes > 0),
  due_at timestamptz,
  status text not null default 'PLANNED' check (status in ('PLANNED','IN_PROGRESS','COMPLETED','SKIPPED')),
  difficulty text not null check (difficulty in ('BASIC','STANDARD','ADVANCED')),
  flexible boolean not null default false,
  rationale_code text not null,
  inserted_by_plan_diff_id uuid,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.task_resource_assignments (
  task_id uuid not null references public.learning_tasks(id) on delete cascade,
  resource_id uuid not null references public.learning_resources(id) on delete restrict,
  rank_score numeric(5,4) not null check (rank_score between 0 and 1),
  ranker_version text not null,
  explanation text not null,
  created_at timestamptz not null default now(),
  primary key(task_id,resource_id)
);

create table if not exists public.plan_generation_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  goal_id uuid not null references public.career_goals(id) on delete cascade,
  gap_snapshot_id uuid not null references public.gap_snapshots(id) on delete restrict,
  constraint_fingerprint text not null,
  generation_key text not null unique,
  status text not null check (status in ('RUNNING','COMPLETE','FAILED')),
  warnings jsonb not null default '[]'::jsonb,
  planner_version text not null,
  result_plan_id uuid references public.learning_plans(id) on delete set null,
  error_code text,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists ix_learning_plans_user_created on public.learning_plans(user_id,created_at desc);
create index if not exists ix_plan_weeks_plan on public.plan_weeks(plan_id,week_index);
create index if not exists ix_objectives_plan on public.learning_objectives(plan_id,week_id);
create index if not exists ix_objectives_skill on public.learning_objectives(skill_id);
create index if not exists ix_tasks_due on public.learning_tasks(plan_id,status,due_at);
create index if not exists ix_tasks_skill on public.learning_tasks(skill_id);
create index if not exists ix_resource_tags on public.learning_resources using gin(tags);
create index if not exists ix_generation_user on public.plan_generation_runs(user_id,started_at desc);

alter table public.learning_resources enable row level security;
alter table public.learning_plans enable row level security;
alter table public.plan_weeks enable row level security;
alter table public.learning_objectives enable row level security;
alter table public.learning_tasks enable row level security;
alter table public.task_resource_assignments enable row level security;
alter table public.plan_generation_runs enable row level security;

create policy "learning_resources_read" on public.learning_resources for select to authenticated
using (is_verified=true and status='ACTIVE');

create policy "learning_plans_select_own" on public.learning_plans for select to authenticated
using (user_id=(select auth.uid()));

create policy "plan_weeks_select_own" on public.plan_weeks for select to authenticated
using (exists(select 1 from public.learning_plans p where p.id=plan_id and p.user_id=(select auth.uid())));

create policy "objectives_select_own" on public.learning_objectives for select to authenticated
using (exists(select 1 from public.learning_plans p where p.id=plan_id and p.user_id=(select auth.uid())));

create policy "tasks_select_own" on public.learning_tasks for select to authenticated
using (exists(select 1 from public.learning_plans p where p.id=plan_id and p.user_id=(select auth.uid())));

create policy "assignments_select_own" on public.task_resource_assignments for select to authenticated
using (exists(
  select 1 from public.learning_tasks t
  join public.learning_plans p on p.id=t.plan_id
  where t.id=task_id and p.user_id=(select auth.uid())
));

create policy "generation_runs_select_own" on public.plan_generation_runs for select to authenticated
using (user_id=(select auth.uid()));
