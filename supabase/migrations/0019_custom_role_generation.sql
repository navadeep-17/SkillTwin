-- Custom target-role generation support.
-- Keeps generated roles private to the creating learner while seeded roles remain public.

alter table public.target_roles
  add column if not exists owner_user_id uuid references public.users(id) on delete cascade;

create index if not exists ix_target_roles_owner
  on public.target_roles(owner_user_id);

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

create index if not exists ix_role_generation_runs_user_created
  on public.role_generation_runs(user_id, created_at desc);

create index if not exists ix_role_generation_result_role
  on public.role_generation_runs(result_role_id);

create index if not exists ix_role_generation_result_role_version
  on public.role_generation_runs(result_role_version_id);

alter table public.role_generation_runs enable row level security;

drop policy if exists "target_roles_read" on public.target_roles;
create policy "target_roles_read"
on public.target_roles
for select
to authenticated
using (owner_user_id is null or owner_user_id = (select auth.uid()));

drop policy if exists "role_versions_read" on public.role_versions;
create policy "role_versions_read"
on public.role_versions
for select
to authenticated
using (
  status='ACTIVE'
  and exists (
    select 1
    from public.target_roles tr
    where tr.id = role_versions.role_id
      and (tr.owner_user_id is null or tr.owner_user_id = (select auth.uid()))
  )
);

drop policy if exists "requirement_groups_read" on public.requirement_groups;
create policy "requirement_groups_read"
on public.requirement_groups
for select
to authenticated
using (
  exists (
    select 1
    from public.role_versions rv
    join public.target_roles tr on tr.id = rv.role_id
    where rv.id = requirement_groups.role_version_id
      and rv.status='ACTIVE'
      and (tr.owner_user_id is null or tr.owner_user_id = (select auth.uid()))
  )
);

drop policy if exists "role_requirements_read" on public.role_skill_requirements;
create policy "role_requirements_read"
on public.role_skill_requirements
for select
to authenticated
using (
  exists (
    select 1
    from public.role_versions rv
    join public.target_roles tr on tr.id = rv.role_id
    where rv.id = role_skill_requirements.role_version_id
      and rv.status='ACTIVE'
      and (tr.owner_user_id is null or tr.owner_user_id = (select auth.uid()))
  )
);

drop policy if exists "role_edges_read" on public.role_dependency_edges;
create policy "role_edges_read"
on public.role_dependency_edges
for select
to authenticated
using (
  exists (
    select 1
    from public.role_versions rv
    join public.target_roles tr on tr.id = rv.role_id
    where rv.id = role_dependency_edges.role_version_id
      and rv.status='ACTIVE'
      and (tr.owner_user_id is null or tr.owner_user_id = (select auth.uid()))
  )
);

drop policy if exists "role_generation_runs_select_own" on public.role_generation_runs;
create policy "role_generation_runs_select_own"
on public.role_generation_runs
for select
to authenticated
using (user_id = (select auth.uid()));
