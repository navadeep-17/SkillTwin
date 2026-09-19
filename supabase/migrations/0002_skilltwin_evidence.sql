-- Canonical skill taxonomy, immutable evidence, learner snapshot, history, and audit events.
create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  canonical_name text not null,
  category text not null,
  parent_skill_id uuid references public.skills(id) on delete set null,
  description text,
  taxonomy_version integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (canonical_name, taxonomy_version)
);

create table if not exists public.skill_aliases (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references public.skills(id) on delete cascade,
  alias text not null,
  normalized_alias text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.user_skills (
  user_id uuid not null references public.users(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete restrict,
  level_value text not null default 'UNKNOWN'
    check (level_value in ('UNKNOWN','NONE','BEGINNER','INTERMEDIATE','ADVANCED','EXPERT')),
  capability_score numeric(5,3)
    check (capability_score is null or capability_score between 0 and 4),
  confidence numeric(5,4) not null default 0.1000
    check (confidence between 0 and 1),
  conflict_state text not null default 'NONE'
    check (conflict_state in ('NONE','RESOLVED','UNRESOLVED')),
  last_evidence_at timestamptz,
  last_validated_at timestamptz,
  evidence_count integer not null default 0 check (evidence_count >= 0),
  source_family_count integer not null default 0 check (source_family_count >= 0),
  estimator_version text not null default 'skill-estimator-a1',
  updated_at timestamptz not null default now(),
  primary key (user_id, skill_id)
);

create table if not exists public.skill_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete restrict,
  source_type text not null check (source_type in (
    'MANUAL_SELF_REPORT','RESUME_SKILL_MENTION','RESUME_PROJECT_DETAIL',
    'LEARNING_TASK_COMPLETED','PRACTICE_EVALUATED','ASSESSMENT_QUESTION',
    'ASSESSMENT_SUMMARY','PROJECT_DESCRIPTION','PROJECT_ARTIFACT_VERIFIED'
  )),
  source_ref text not null,
  source_group_id text not null,
  claim text not null,
  level_signal numeric(5,3) check (level_signal is null or level_signal between 0 and 4),
  polarity text not null default 'SUPPORTS'
    check (polarity in ('SUPPORTS','CONTRADICTS','NEUTRAL')),
  directness numeric(5,4) not null check (directness between 0 and 1),
  quality numeric(5,4) not null check (quality between 0 and 1),
  coverage numeric(5,4) not null check (coverage between 0 and 1),
  effective_weight numeric(7,6) not null check (effective_weight between 0 and 1),
  status text not null default 'ACCEPTED'
    check (status in ('ACCEPTED','REJECTED','SUPERSEDED','NON_AGGREGATING')),
  superseded_by_id uuid references public.skill_evidence(id) on delete set null,
  idempotency_key text not null,
  producer_version text not null,
  estimator_version text not null default 'skill-estimator-a1',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create table if not exists public.skill_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete restrict,
  trigger_type text not null,
  trigger_ref text not null,
  before_state jsonb,
  after_state jsonb not null,
  evidence_ids jsonb not null default '[]'::jsonb,
  estimator_version text not null,
  explanation text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  event_type text not null,
  trigger_type text,
  trigger_ref text,
  summary text not null,
  entity_refs jsonb not null default '[]'::jsonb,
  evidence_refs jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ix_skills_category_active
  on public.skills(category, is_active);
create index if not exists ix_skill_aliases_skill
  on public.skill_aliases(skill_id);
create index if not exists ix_user_skills_updated
  on public.user_skills(user_id, updated_at desc);
create index if not exists ix_skill_evidence_active
  on public.skill_evidence(user_id, skill_id, status)
  where status in ('ACCEPTED','NON_AGGREGATING');
create index if not exists ix_skill_evidence_group
  on public.skill_evidence(user_id, source_group_id);
create index if not exists ix_skill_history_timeline
  on public.skill_history(user_id, skill_id, created_at desc);
create index if not exists ix_agent_events_timeline
  on public.agent_events(user_id, created_at desc, id desc);

alter table public.skills enable row level security;
alter table public.skill_aliases enable row level security;
alter table public.user_skills enable row level security;
alter table public.skill_evidence enable row level security;
alter table public.skill_history enable row level security;
alter table public.agent_events enable row level security;

drop policy if exists "skills_authenticated_read" on public.skills;
create policy "skills_authenticated_read"
on public.skills for select
to authenticated
using (is_active = true);

drop policy if exists "skill_aliases_authenticated_read" on public.skill_aliases;
create policy "skill_aliases_authenticated_read"
on public.skill_aliases for select
to authenticated
using (true);

drop policy if exists "user_skills_select_own" on public.user_skills;
create policy "user_skills_select_own"
on public.user_skills for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "skill_evidence_select_own" on public.skill_evidence;
create policy "skill_evidence_select_own"
on public.skill_evidence for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "skill_history_select_own" on public.skill_history;
create policy "skill_history_select_own"
on public.skill_history for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "agent_events_select_own" on public.agent_events;
create policy "agent_events_select_own"
on public.agent_events for select
to authenticated
using (user_id = auth.uid());
