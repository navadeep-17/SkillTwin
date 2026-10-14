-- Public employer-posting catalog; no learner profile data or applicant information.
-- Apply before enabling the collector endpoint. This migration is additive.
begin;

create table if not exists public.ats_job_postings (
  provider text not null check(provider in ('greenhouse','lever','ashby')),
  board text not null check(length(board) between 2 and 80),
  external_id text not null check(length(external_id) between 1 and 220),
  company text not null,
  title text not null,
  location text not null default 'Location not provided',
  workplace_type text,
  employment_type text,
  description text not null default '',
  posting_url text not null check(posting_url ~ '^https://'),
  published_at timestamptz,
  publisher_updated_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  missing_scans int not null default 0 check(missing_scans between 0 and 10000),
  is_active boolean not null default true,
  primary key (provider, board, external_id)
);

create index if not exists ats_job_postings_active_recent_idx
  on public.ats_job_postings(last_seen_at desc)
  where is_active;
create index if not exists ats_job_postings_location_active_idx
  on public.ats_job_postings(lower(location))
  where is_active;
create index if not exists ats_job_postings_first_seen_idx
  on public.ats_job_postings(first_seen_at desc);

create table if not exists public.ats_job_sync_runs (
  id bigint generated always as identity primary key,
  provider text not null check(provider in ('greenhouse','lever','ashby')),
  board text not null,
  status text not null check(status in ('SUCCESS','FAILED')),
  started_at timestamptz not null,
  finished_at timestamptz not null default now(),
  parsed_count int not null default 0 check(parsed_count>=0),
  error_code text,
  constraint ats_job_sync_finished_after_started check(finished_at>=started_at)
);
create index if not exists ats_job_sync_runs_source_recent_idx
  on public.ats_job_sync_runs(provider, board, finished_at desc);

alter table public.ats_job_postings enable row level security;
alter table public.ats_job_sync_runs enable row level security;

-- The application accesses these tables from its authenticated server API
-- using a dedicated database connection; no browser may write to the catalog.
revoke all on table public.ats_job_postings from anon, authenticated;
revoke all on table public.ats_job_sync_runs from anon, authenticated;
revoke all on sequence public.ats_job_sync_runs_id_seq from anon, authenticated;

-- Postings contain no private data; authenticated users may read live listings
-- if a future screen uses the Supabase client. Sync logs remain backend-only.
grant select on table public.ats_job_postings to authenticated;
drop policy if exists ats_job_postings_read_active on public.ats_job_postings;
create policy ats_job_postings_read_active on public.ats_job_postings
  for select to authenticated using (is_active = true);

commit;
