-- Profile documents, parsing, semantic analysis provenance, and private resume storage.
create table if not exists public.profile_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  document_type text not null default 'resume' check (document_type in ('resume','certificate','other')),
  file_name text not null,
  mime_type text not null,
  byte_size bigint not null check (byte_size > 0),
  storage_path text not null unique,
  sha256 text not null,
  version integer not null default 1 check (version > 0),
  parse_status text not null default 'pending' check (parse_status in ('pending','parsed','failed')),
  analysis_status text not null default 'pending' check (analysis_status in ('pending','running','complete','partial','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, sha256, version)
);

drop trigger if exists profile_documents_touch_updated_at on public.profile_documents;
create trigger profile_documents_touch_updated_at
before update on public.profile_documents
for each row execute function public.touch_updated_at();

create table if not exists public.document_parse_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  document_id uuid not null references public.profile_documents(id) on delete cascade,
  document_version integer not null,
  parser_version text not null,
  status text not null check (status in ('running','complete','failed')),
  full_text text,
  page_map jsonb not null default '[]'::jsonb,
  quality jsonb not null default '{}'::jsonb,
  error_code text,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(document_id, document_version, parser_version)
);

create table if not exists public.profile_analysis_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  source_type text not null check (source_type in ('resume','project','manual_profile','certificate')),
  source_id uuid not null,
  source_version integer not null check (source_version > 0),
  analyzer_schema_version text not null,
  analysis_key text not null,
  status text not null default 'pending' check (status in ('pending','running','complete','partial','failed')),
  stage text not null default 'queued' check (stage in ('queued','parsing','normalizing','segmenting','extracting','mapping','evidence','complete','failed')),
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  counts jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  evidence_batch_result jsonb,
  error_code text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id, analysis_key)
);

create table if not exists public.profile_source_blocks (
  id text primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  analysis_run_id uuid not null references public.profile_analysis_runs(id) on delete cascade,
  source_id uuid not null,
  kind text not null,
  title text,
  text_content text not null,
  page_start integer,
  page_end integer,
  ordinal integer not null,
  created_at timestamptz not null default now(),
  unique(analysis_run_id, ordinal)
);

create table if not exists public.candidate_skill_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  analysis_run_id uuid not null references public.profile_analysis_runs(id) on delete cascade,
  source_block_id text not null references public.profile_source_blocks(id) on delete cascade,
  raw_skill_name text not null,
  canonical_skill_id uuid references public.skills(id) on delete set null,
  claim_type text not null check (claim_type in ('explicit','usage','inferred_context')),
  evidence_snippet text not null,
  extraction_confidence numeric(5,4) not null check (extraction_confidence between 0 and 1),
  mapping_method text not null,
  mapping_confidence numeric(5,4) not null check (mapping_confidence between 0 and 1),
  created_at timestamptz not null default now()
);

create index if not exists ix_profile_documents_user_created on public.profile_documents(user_id, created_at desc);
create index if not exists ix_analysis_runs_user_created on public.profile_analysis_runs(user_id, created_at desc);
create index if not exists ix_source_blocks_run on public.profile_source_blocks(analysis_run_id, ordinal);
create index if not exists ix_candidate_claims_run on public.candidate_skill_claims(analysis_run_id, created_at);

alter table public.profile_documents enable row level security;
alter table public.document_parse_runs enable row level security;
alter table public.profile_analysis_runs enable row level security;
alter table public.profile_source_blocks enable row level security;
alter table public.candidate_skill_claims enable row level security;

create policy "profile_documents_select_own" on public.profile_documents for select to authenticated using (user_id=auth.uid());
create policy "profile_documents_insert_own" on public.profile_documents for insert to authenticated with check (user_id=auth.uid());
create policy "profile_documents_update_own" on public.profile_documents for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "document_parse_runs_select_own" on public.document_parse_runs for select to authenticated using (user_id=auth.uid());
create policy "analysis_runs_select_own" on public.profile_analysis_runs for select to authenticated using (user_id=auth.uid());
create policy "source_blocks_select_own" on public.profile_source_blocks for select to authenticated using (user_id=auth.uid());
create policy "candidate_claims_select_own" on public.candidate_skill_claims for select to authenticated using (user_id=auth.uid());

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('profile-documents','profile-documents',false,10485760,array['application/pdf'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy "profile_storage_select_own" on storage.objects for select to authenticated
using (bucket_id='profile-documents' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "profile_storage_insert_own" on storage.objects for insert to authenticated
with check (bucket_id='profile-documents' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "profile_storage_delete_own" on storage.objects for delete to authenticated
using (bucket_id='profile-documents' and (storage.foldername(name))[1]=auth.uid()::text);
