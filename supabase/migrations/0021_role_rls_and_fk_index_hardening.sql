-- Remove externally callable RLS helper and close FK index gaps.

drop policy if exists "role_versions_read" on public.role_versions;
create policy "role_versions_read"
on public.role_versions for select to authenticated
using (
  status='ACTIVE'
  and exists(
    select 1 from public.target_roles tr
    where tr.id=role_versions.role_id
      and (tr.owner_user_id is null or tr.owner_user_id=(select auth.uid()))
  )
);

drop policy if exists "requirement_groups_read" on public.requirement_groups;
create policy "requirement_groups_read"
on public.requirement_groups for select to authenticated
using (
  exists(
    select 1
    from public.role_versions rv
    join public.target_roles tr on tr.id=rv.role_id
    where rv.id=requirement_groups.role_version_id
      and rv.status='ACTIVE'
      and (tr.owner_user_id is null or tr.owner_user_id=(select auth.uid()))
  )
);

drop policy if exists "role_requirements_read" on public.role_skill_requirements;
create policy "role_requirements_read"
on public.role_skill_requirements for select to authenticated
using (
  exists(
    select 1
    from public.role_versions rv
    join public.target_roles tr on tr.id=rv.role_id
    where rv.id=role_skill_requirements.role_version_id
      and rv.status='ACTIVE'
      and (tr.owner_user_id is null or tr.owner_user_id=(select auth.uid()))
  )
);

drop policy if exists "role_edges_read" on public.role_dependency_edges;
create policy "role_edges_read"
on public.role_dependency_edges for select to authenticated
using (
  exists(
    select 1
    from public.role_versions rv
    join public.target_roles tr on tr.id=rv.role_id
    where rv.id=role_dependency_edges.role_version_id
      and rv.status='ACTIVE'
      and (tr.owner_user_id is null or tr.owner_user_id=(select auth.uid()))
  )
);

drop policy if exists "career_goals_insert_own" on public.career_goals;
create policy "career_goals_insert_own"
on public.career_goals for insert to authenticated
with check (
  user_id=(select auth.uid())
  and exists(
    select 1
    from public.role_versions rv
    join public.target_roles tr on tr.id=rv.role_id
    where rv.id=career_goals.role_version_id
      and rv.status='ACTIVE'
      and (tr.owner_user_id is null or tr.owner_user_id=(select auth.uid()))
  )
);

drop policy if exists "career_goals_update_own" on public.career_goals;
create policy "career_goals_update_own"
on public.career_goals for update to authenticated
using (user_id=(select auth.uid()))
with check (
  user_id=(select auth.uid())
  and exists(
    select 1
    from public.role_versions rv
    join public.target_roles tr on tr.id=rv.role_id
    where rv.id=career_goals.role_version_id
      and rv.status='ACTIVE'
      and (tr.owner_user_id is null or tr.owner_user_id=(select auth.uid()))
  )
);

drop function if exists public.can_access_role_version(uuid);

create index if not exists ix_project_recommendations_goal
  on public.project_recommendations(goal_id);
create index if not exists ix_resource_feedback_task
  on public.resource_feedback(task_id);
create index if not exists ix_role_generation_result_role
  on public.role_generation_runs(result_role_id);
create index if not exists ix_role_generation_result_role_version
  on public.role_generation_runs(result_role_version_id);
create index if not exists ix_unresolved_skill_terms_resolved_skill
  on public.unresolved_skill_terms(resolved_skill_id);
create index if not exists ix_unresolved_skill_terms_source_block
  on public.unresolved_skill_terms(source_block_id);
create index if not exists ix_weekly_reports_goal
  on public.weekly_reports(goal_id);
