-- Release metadata and observable protected demo reset runs.

create table if not exists public.system_metadata (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

insert into public.system_metadata(key,value) values
('schema_contract_version','skilltwin-full-spec-v1'),
('seed_version','seed-2026-09-19-v2'),
('resource_catalog_version','resource-catalog-d2'),
('demo_fixture_version','demo-backend-v1')
on conflict(key) do update set value=excluded.value,updated_at=now();

create table if not exists public.demo_reset_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null check (status in ('STARTED','READY','FAILED')),
  fixture_version text not null,
  commit_sha text,
  verification jsonb not null default '{}'::jsonb,
  error_code text,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists ix_demo_reset_runs_user_started
  on public.demo_reset_runs(user_id,started_at desc);

alter table public.system_metadata enable row level security;
alter table public.demo_reset_runs enable row level security;

create policy "system_metadata_read"
on public.system_metadata for select to authenticated
using (true);

create policy "demo_reset_runs_select_own"
on public.demo_reset_runs for select to authenticated
using (user_id=(select auth.uid()));
