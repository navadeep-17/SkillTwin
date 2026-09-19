create table if not exists public.profile_manual_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  text_content text not null,
  version integer not null default 1 check (version > 0),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','ARCHIVED')),
  analysis_result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists profile_manual_sources_touch_updated_at on public.profile_manual_sources;
create trigger profile_manual_sources_touch_updated_at
before update on public.profile_manual_sources
for each row execute function public.touch_updated_at();

create index if not exists ix_profile_manual_sources_user_created
  on public.profile_manual_sources(user_id,created_at desc);

alter table public.profile_manual_sources enable row level security;

create policy "profile_manual_sources_select_own"
on public.profile_manual_sources for select to authenticated
using (user_id=(select auth.uid()));

create policy "profile_manual_sources_insert_own"
on public.profile_manual_sources for insert to authenticated
with check (user_id=(select auth.uid()));

create policy "profile_manual_sources_update_own"
on public.profile_manual_sources for update to authenticated
using (user_id=(select auth.uid()))
with check (user_id=(select auth.uid()));
