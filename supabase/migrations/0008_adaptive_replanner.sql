
-- Component F: minimal adaptive replanning, immutable plan versions, and explicit PlanDiffs.

alter table public.learning_objectives
  add column if not exists logical_objective_id uuid not null default gen_random_uuid();

alter table public.learning_tasks
  add column if not exists logical_task_id uuid not null default gen_random_uuid();

create unique index if not exists ux_objective_logical_per_plan
  on public.learning_objectives(plan_id,logical_objective_id);

create unique index if not exists ux_task_logical_per_plan
  on public.learning_tasks(plan_id,logical_task_id);

create table if not exists public.replan_decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  goal_id uuid not null references public.career_goals(id) on delete cascade,
  from_plan_id uuid references public.learning_plans(id) on delete set null,
  from_version integer,
  trigger_type text not null,
  trigger_ref text not null,
  material boolean not null,
  decision text not null check (decision in ('NO_OP','PROPOSE','APPLY')),
  reason_code text not null,
  reason text not null,
  input_fingerprint text not null,
  created_at timestamptz not null default now(),
  unique(user_id,input_fingerprint)
);

create table if not exists public.plan_diffs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  goal_id uuid not null references public.career_goals(id) on delete cascade,
  from_plan_id uuid not null references public.learning_plans(id) on delete restrict,
  from_version integer not null,
  to_plan_id uuid references public.learning_plans(id) on delete set null,
  to_version integer,
  status text not null check (status in ('PROPOSED','APPLIED','REJECTED','SUPERSEDED','UNDONE')),
  trigger_type text not null,
  trigger_refs jsonb not null default '[]'::jsonb,
  evidence_refs jsonb not null default '[]'::jsonb,
  summary text not null,
  reason text not null,
  operations jsonb not null default '[]'::jsonb,
  weekly_impact jsonb not null default '[]'::jsonb,
  timeline_impact text not null default 'NONE' check (timeline_impact in ('NONE','AT_RISK','IMPROVED')),
  total_minute_delta integer not null default 0,
  touch_count integer not null default 0 check (touch_count >= 0),
  complexity text not null check (complexity in ('MINOR','MAJOR')),
  can_undo boolean not null default true,
  generator_version text not null,
  validator_version text not null,
  input_fingerprint text not null unique,
  created_at timestamptz not null default now(),
  applied_at timestamptz
);

alter table public.learning_tasks
  drop constraint if exists learning_tasks_inserted_by_plan_diff_id_fkey;

alter table public.learning_tasks
  add constraint learning_tasks_inserted_by_plan_diff_id_fkey
  foreign key(inserted_by_plan_diff_id) references public.plan_diffs(id) on delete set null;

create index if not exists ix_replan_decisions_user_created
  on public.replan_decisions(user_id,created_at desc);

create index if not exists ix_plan_diffs_user_created
  on public.plan_diffs(user_id,created_at desc);

create index if not exists ix_plan_diffs_from_plan
  on public.plan_diffs(from_plan_id,created_at desc);

alter table public.replan_decisions enable row level security;
alter table public.plan_diffs enable row level security;

create policy "replan_decisions_select_own"
on public.replan_decisions for select to authenticated
using (user_id=(select auth.uid()));

create policy "plan_diffs_select_own"
on public.plan_diffs for select to authenticated
using (user_id=(select auth.uid()));
