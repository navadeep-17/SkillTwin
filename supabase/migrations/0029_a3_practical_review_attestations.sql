-- Evidence A3: independent human-attested practical demonstrations.
-- Requires canonical migrations 0001 and 0012. Apply to STAGING first.
-- Reviewer enrollment is an administrator-only operation, not a public API.

create table if not exists public.competency_reviewers (
  user_id uuid primary key references public.users(id) on delete cascade,
  active boolean not null default false,
  added_at timestamptz not null default now(),
  rationale text not null check (length(trim(rationale)) between 12 and 1000)
);

create table if not exists public.competency_practical_reviews (
  id uuid primary key default gen_random_uuid(),
  learner_user_id uuid not null references public.users(id) on delete cascade,
  reviewer_user_id uuid not null references public.users(id) on delete restrict,
  project_id uuid not null references public.profile_projects(id) on delete cascade,
  project_version integer not null check (project_version > 0),
  skill_id uuid not null references public.skills(id) on delete restrict,
  criterion_id text not null check (length(criterion_id) between 3 and 100),
  rubric_version text not null,
  repository_url text not null,
  commit_sha text not null check (commit_sha ~ '^[a-f0-9]{40}$'),
  reviewed_source_path text not null check (length(reviewed_source_path) between 1 and 250),
  reviewed_blob_sha text not null check (reviewed_blob_sha ~ '^[a-f0-9]{40}$'),
  review_method text not null default 'OBSERVED_PRACTICAL_DEMO'
    check (review_method = 'OBSERVED_PRACTICAL_DEMO'),
  practical_task text not null check (length(trim(practical_task)) between 50 and 2000),
  observed_result text not null check (length(trim(observed_result)) between 50 and 2000),
  test_procedure text not null check (length(trim(test_procedure)) between 30 and 2000),
  verdict text not null check (verdict in ('PASS','FAIL')),
  reviewed_at timestamptz not null default now(),
  constraint independent_competency_reviewer check (reviewer_user_id <> learner_user_id),
  unique (reviewer_user_id, project_id, project_version, criterion_id, commit_sha)
);

create index if not exists ix_competency_reviews_learner_skill
  on public.competency_practical_reviews(learner_user_id, skill_id, reviewed_at desc);
create index if not exists ix_competency_reviews_reviewer
  on public.competency_practical_reviews(reviewer_user_id, reviewed_at desc);

alter table public.competency_reviewers enable row level security;
alter table public.competency_practical_reviews enable row level security;

-- Deny direct client-role table access; server uses privileged SQL
-- only after authenticating the caller and authorizing reviewers.
revoke all on public.competency_reviewers from anon, authenticated;
revoke all on public.competency_practical_reviews from anon, authenticated;
revoke all on public.competency_reviewers from public;
revoke all on public.competency_practical_reviews from public;

comment on table public.competency_reviewers is
  'Admin-provisioned independent project reviewers. Never user writable.';
comment on table public.competency_practical_reviews is
  'Human-attested live practical work at a pinned commit/blob; not automated code evaluation or authorship proof.';
