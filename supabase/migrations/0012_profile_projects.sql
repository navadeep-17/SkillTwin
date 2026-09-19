-- Manual project evidence submitted by the learner.

create table if not exists public.profile_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  description text not null,
  technologies jsonb not null default '[]'::jsonb,
  artifact_url text,
  version integer not null default 1 check (version > 0),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','ARCHIVED')),
  analysis_status text not null default 'PENDING'
    check (analysis_status in ('PENDING','RUNNING','COMPLETE','FAILED')),
  analysis_result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists profile_projects_touch_updated_at on public.profile_projects;
create trigger profile_projects_touch_updated_at
before update on public.profile_projects
for each row execute function public.touch_updated_at();

create index if not exists ix_profile_projects_user_created
  on public.profile_projects(user_id,created_at desc);

alter table public.profile_projects enable row level security;

create policy "profile_projects_select_own"
on public.profile_projects for select to authenticated
using (user_id=(select auth.uid()));

create policy "profile_projects_insert_own"
on public.profile_projects for insert to authenticated
with check (user_id=(select auth.uid()));

create policy "profile_projects_update_own"
on public.profile_projects for update to authenticated
using (user_id=(select auth.uid()))
with check (user_id=(select auth.uid()));
