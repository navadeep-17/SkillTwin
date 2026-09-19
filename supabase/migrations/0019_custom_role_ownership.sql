-- Custom role ownership and RLS isolation.

alter table public.target_roles
  add column if not exists owner_user_id uuid references public.users(id) on delete cascade;

create index if not exists ix_target_roles_owner
  on public.target_roles(owner_user_id) where owner_user_id is not null;

create or replace function public.can_access_role_version(p_role_version_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.role_versions rv
    join public.target_roles tr on tr.id=rv.role_id
    where rv.id=p_role_version_id
      and rv.status='ACTIVE'
      and (tr.owner_user_id is null or tr.owner_user_id=auth.uid())
  );
$$;

revoke all on function public.can_access_role_version(uuid) from public;
grant execute on function public.can_access_role_version(uuid) to authenticated;

drop policy if exists "target_roles_read" on public.target_roles;
create policy "target_roles_read"
on public.target_roles for select to authenticated
using (owner_user_id is null or owner_user_id=(select auth.uid()));

drop policy if exists "role_versions_read" on public.role_versions;
create policy "role_versions_read"
on public.role_versions for select to authenticated
using (public.can_access_role_version(id));

drop policy if exists "requirement_groups_read" on public.requirement_groups;
create policy "requirement_groups_read"
on public.requirement_groups for select to authenticated
using (public.can_access_role_version(role_version_id));

drop policy if exists "role_requirements_read" on public.role_skill_requirements;
create policy "role_requirements_read"
on public.role_skill_requirements for select to authenticated
using (public.can_access_role_version(role_version_id));

drop policy if exists "role_edges_read" on public.role_dependency_edges;
create policy "role_edges_read"
on public.role_dependency_edges for select to authenticated
using (public.can_access_role_version(role_version_id));

drop policy if exists "career_goals_insert_own" on public.career_goals;
create policy "career_goals_insert_own"
on public.career_goals for insert to authenticated
with check (
  user_id=(select auth.uid())
  and public.can_access_role_version(role_version_id)
);

drop policy if exists "career_goals_update_own" on public.career_goals;
create policy "career_goals_update_own"
on public.career_goals for update to authenticated
using (user_id=(select auth.uid()))
with check (
  user_id=(select auth.uid())
  and public.can_access_role_version(role_version_id)
);
