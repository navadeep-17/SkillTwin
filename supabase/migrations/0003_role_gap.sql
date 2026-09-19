-- Versioned target-role competency graph, learner goal, and immutable gap snapshots.
create table if not exists public.target_roles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  family text,
  created_at timestamptz not null default now()
);

create table if not exists public.role_versions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.target_roles(id) on delete cascade,
  version integer not null check (version > 0),
  source text not null check (source in ('SEEDED','AI_GENERATED')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','RETIRED')),
  schema_version text not null,
  created_at timestamptz not null default now(),
  unique(role_id, version)
);

create table if not exists public.requirement_groups (
  id uuid primary key default gen_random_uuid(),
  role_version_id uuid not null references public.role_versions(id) on delete cascade,
  name text not null,
  group_type text not null check (group_type in ('SINGLE','ALL_OF','ANY_OF')),
  group_importance numeric(5,4) not null check (group_importance between 0 and 1),
  created_at timestamptz not null default now()
);

create table if not exists public.role_skill_requirements (
  id uuid primary key default gen_random_uuid(),
  role_version_id uuid not null references public.role_versions(id) on delete cascade,
  group_id uuid not null references public.requirement_groups(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete restrict,
  target_score numeric(5,3) not null check (target_score between 0 and 4),
  importance numeric(5,4) not null check (importance between 0 and 1),
  importance_band text not null check (importance_band in ('CORE','IMPORTANT','SUPPORTING')),
  learning_stage integer not null check (learning_stage between 1 and 4),
  is_default_alternative boolean not null default false,
  rationale text not null,
  created_at timestamptz not null default now(),
  unique(role_version_id, group_id, skill_id)
);

create table if not exists public.role_dependency_edges (
  id uuid primary key default gen_random_uuid(),
  role_version_id uuid not null references public.role_versions(id) on delete cascade,
  prerequisite_requirement_id uuid not null references public.role_skill_requirements(id) on delete cascade,
  dependent_requirement_id uuid not null references public.role_skill_requirements(id) on delete cascade,
  edge_type text not null check (edge_type in ('HARD','SOFT')),
  created_at timestamptz not null default now(),
  check (prerequisite_requirement_id <> dependent_requirement_id),
  unique(role_version_id, prerequisite_requirement_id, dependent_requirement_id)
);

create table if not exists public.career_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  role_version_id uuid not null references public.role_versions(id) on delete restrict,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','ARCHIVED')),
  target_date date,
  hours_per_week numeric(5,2) not null default 10 check (hours_per_week > 0 and hours_per_week <= 80),
  preferred_session_minutes integer not null default 60 check (preferred_session_minutes between 15 and 240),
  min_session_minutes integer not null default 20 check (min_session_minutes between 10 and 120),
  learning_days jsonb not null default '["Mon","Tue","Wed","Thu","Fri","Sat"]'::jsonb,
  preferred_formats jsonb not null default '["projects","practice","documentation"]'::jsonb,
  adaptation_mode text not null default 'AUTOMATIC' check (adaptation_mode in ('AUTOMATIC','ASK_FIRST')),
  preferred_alternatives jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists career_goals_touch_updated_at on public.career_goals;
create trigger career_goals_touch_updated_at
before update on public.career_goals
for each row execute function public.touch_updated_at();

create unique index if not exists ux_career_goals_one_active
  on public.career_goals(user_id) where status='ACTIVE';

create table if not exists public.gap_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  goal_id uuid not null references public.career_goals(id) on delete cascade,
  role_version_id uuid not null references public.role_versions(id) on delete restrict,
  readiness integer not null check (readiness between 0 and 100),
  evidence_coverage integer not null check (evidence_coverage between 0 and 100),
  selected_alternatives jsonb not null default '{}'::jsonb,
  trigger_type text not null,
  trigger_ref text not null,
  as_of timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.skill_gap_results (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.gap_snapshots(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  requirement_id uuid not null references public.role_skill_requirements(id) on delete restrict,
  group_id uuid not null references public.requirement_groups(id) on delete restrict,
  skill_id uuid not null references public.skills(id) on delete restrict,
  current_score numeric(5,3),
  current_confidence numeric(5,4) not null check (current_confidence between 0 and 1),
  target_score numeric(5,3) not null,
  attainment numeric(5,4) not null check (attainment between 0 and 1),
  gap_severity numeric(5,4) not null check (gap_severity between 0 and 1),
  dependency_impact numeric(5,4) not null check (dependency_impact between 0 and 1),
  urgency numeric(5,4) not null check (urgency between 0 and 1),
  priority_score numeric(5,4) not null check (priority_score between 0 and 1),
  priority_band text not null check (priority_band in ('LOW','MEDIUM','HIGH','CRITICAL','COMPLETE')),
  status text not null check (status in ('STRONG','DEVELOPING','GAP')),
  recommended_action text not null check (recommended_action in ('LEARN','VALIDATE','VALIDATE_FIRST','MAINTAIN')),
  reason_codes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique(snapshot_id, requirement_id)
);

create index if not exists ix_role_requirements_version on public.role_skill_requirements(role_version_id, group_id);
create index if not exists ix_role_edges_version on public.role_dependency_edges(role_version_id);
create index if not exists ix_gap_snapshots_user on public.gap_snapshots(user_id, created_at desc);
create index if not exists ix_skill_gap_results_snapshot on public.skill_gap_results(snapshot_id, priority_score desc);

alter table public.target_roles enable row level security;
alter table public.role_versions enable row level security;
alter table public.requirement_groups enable row level security;
alter table public.role_skill_requirements enable row level security;
alter table public.role_dependency_edges enable row level security;
alter table public.career_goals enable row level security;
alter table public.gap_snapshots enable row level security;
alter table public.skill_gap_results enable row level security;

create policy "target_roles_read" on public.target_roles for select to authenticated using (true);
create policy "role_versions_read" on public.role_versions for select to authenticated using (status='ACTIVE');
create policy "requirement_groups_read" on public.requirement_groups for select to authenticated using (true);
create policy "role_requirements_read" on public.role_skill_requirements for select to authenticated using (true);
create policy "role_edges_read" on public.role_dependency_edges for select to authenticated using (true);
create policy "career_goals_select_own" on public.career_goals for select to authenticated using (user_id=auth.uid());
create policy "career_goals_insert_own" on public.career_goals for insert to authenticated with check (user_id=auth.uid());
create policy "career_goals_update_own" on public.career_goals for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "gap_snapshots_select_own" on public.gap_snapshots for select to authenticated using (user_id=auth.uid());
create policy "skill_gap_results_select_own" on public.skill_gap_results for select to authenticated using (user_id=auth.uid());
