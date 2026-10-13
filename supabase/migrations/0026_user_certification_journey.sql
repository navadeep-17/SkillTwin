-- SkillTwin Certifications / My Journey.
-- IMPORTANT: apply before deploying the Journey API/page. No existing learner
-- scores, roadmaps, assessments, or certificates are modified by this migration.
begin;

create table if not exists public.user_certification_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  certification_id text not null,
  status text not null default 'SAVED' check (
    status in ('SAVED','PREPARING','EXAM_PLANNED','EARNED_SELF_REPORTED')
  ),
  completed_topics jsonb not null default '[]'::jsonb
    check (jsonb_typeof(completed_topics) = 'array'),
  target_exam_date date,
  earned_date date,
  credential_url text,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint certification_goal_unique_per_user unique(user_id, certification_id),
  constraint certification_goal_credential_url_length check (
    credential_url is null or length(credential_url) <= 1000
  ),
  constraint certification_goal_reported_requires_date check (
    status <> 'EARNED_SELF_REPORTED' or earned_date is not null
  )
);

create index if not exists certification_goal_user_status_idx
  on public.user_certification_goals (user_id, status, updated_at desc);

alter table public.user_certification_goals enable row level security;
alter table public.user_certification_goals force row level security;

revoke all on table public.user_certification_goals from public, anon;
grant select, insert, update, delete on table public.user_certification_goals to authenticated;

drop policy if exists certification_goal_owner_select on public.user_certification_goals;
create policy certification_goal_owner_select on public.user_certification_goals
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists certification_goal_owner_insert on public.user_certification_goals;
create policy certification_goal_owner_insert on public.user_certification_goals
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists certification_goal_owner_update on public.user_certification_goals;
create policy certification_goal_owner_update on public.user_certification_goals
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists certification_goal_owner_delete on public.user_certification_goals;
create policy certification_goal_owner_delete on public.user_certification_goals
  for delete to authenticated using (user_id = (select auth.uid()));

-- Prevent client-side direct updates of immutable identity, timestamps and
-- optimistic version, even if the client bypasses our API. The server writes
-- through this same authenticated Supabase role and increments version with a
-- single owner-scoped conditional UPDATE.
create or replace function public.certification_goal_guard_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.user_id is distinct from old.user_id
     or new.certification_id is distinct from old.certification_id
     or new.created_at is distinct from old.created_at
  then
    raise exception 'CERTIFICATION_GOAL_IDENTITY_IMMUTABLE';
  end if;
  if new.version <> old.version + 1 then
    raise exception 'CERTIFICATION_GOAL_VERSION_MUST_INCREMENT';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_certification_goal_guard_update on public.user_certification_goals;
create trigger trg_certification_goal_guard_update
  before update on public.user_certification_goals
  for each row execute function public.certification_goal_guard_update();

commit;
