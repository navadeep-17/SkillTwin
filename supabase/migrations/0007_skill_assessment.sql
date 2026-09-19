
-- Component E: SkillTwin Challenge Me persistence.
-- Prefixed with skill_ because this Supabase project already contains an unrelated public.assessments table.

create table if not exists public.skill_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete restrict,
  mode text not null check (mode in ('CHALLENGE_ME','SCHEDULED_VALIDATION','CALIBRATION','CONFLICT_RESOLUTION')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','COMPLETED','ABANDONED','FAILED')),
  blueprint_json jsonb not null,
  blueprint_version text not null,
  source_task_id uuid references public.learning_tasks(id) on delete set null,
  current_question_index integer not null default 0 check (current_question_index >= 0),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.assessment_question_bank (
  id uuid primary key,
  skill_id uuid not null references public.skills(id) on delete cascade,
  concept_id text not null,
  type text not null check (type in ('MCQ','SHORT_TEXT','SCENARIO')),
  difficulty integer not null check (difficulty between 1 and 4),
  prompt text not null,
  options jsonb,
  answer_key jsonb not null,
  rubric jsonb not null default '{}'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  source text not null default 'SEEDED',
  version text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.skill_assessment_questions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.skill_assessments(id) on delete cascade,
  bank_question_id uuid references public.assessment_question_bank(id) on delete set null,
  ordinal integer not null check (ordinal > 0),
  type text not null check (type in ('MCQ','SHORT_TEXT','SCENARIO')),
  concept_ids jsonb not null default '[]'::jsonb,
  difficulty integer not null check (difficulty between 1 and 4),
  prompt text not null,
  options jsonb,
  answer_key jsonb not null,
  rubric jsonb not null default '{}'::jsonb,
  source text not null,
  generator_version text not null,
  created_at timestamptz not null default now(),
  unique(assessment_id, ordinal)
);

create table if not exists public.skill_assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.skill_assessments(id) on delete cascade,
  question_id uuid not null references public.skill_assessment_questions(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  answer_payload jsonb not null,
  status text not null check (status in ('EVALUATED','INVALID')),
  score numeric(5,4) not null check (score between 0 and 1),
  evaluator_confidence numeric(5,4) not null check (evaluator_confidence between 0 and 1),
  feedback text not null,
  error_tag text,
  evaluation_version text not null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique(user_id, idempotency_key),
  unique(assessment_id, question_id)
);

create table if not exists public.skill_assessment_concept_signals (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.skill_assessment_attempts(id) on delete cascade,
  assessment_id uuid not null references public.skill_assessments(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete restrict,
  concept_id text not null,
  polarity text not null check (polarity in ('POSITIVE','NEGATIVE','MIXED')),
  strength numeric(5,4) not null check (strength between 0 and 1),
  difficulty integer not null check (difficulty between 1 and 4),
  error_tag text,
  evaluator_confidence numeric(5,4) not null check (evaluator_confidence between 0 and 1),
  created_at timestamptz not null default now()
);

create table if not exists public.skill_assessment_outcomes (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null unique references public.skill_assessments(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete restrict,
  normalized_score numeric(5,4) not null check (normalized_score between 0 and 1),
  level_signal numeric(5,3) not null check (level_signal between 0 and 4),
  coverage numeric(5,4) not null check (coverage between 0 and 1),
  assessment_confidence numeric(5,4) not null check (assessment_confidence between 0 and 1),
  strengths jsonb not null default '[]'::jsonb,
  weaknesses jsonb not null default '[]'::jsonb,
  concept_summary jsonb not null default '{}'::jsonb,
  aggregator_version text not null,
  evidence_batch_result jsonb,
  gap_snapshot_id uuid references public.gap_snapshots(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.skill_assessment_generation_runs (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.skill_assessments(id) on delete cascade,
  request_hash text not null,
  status text not null check (status in ('COMPLETE','FAILED')),
  provider text not null,
  model_version text not null,
  retry_count integer not null default 0 check (retry_count >= 0),
  created_at timestamptz not null default now(),
  unique(assessment_id, request_hash)
);

create index if not exists ix_skill_assessments_user_created
  on public.skill_assessments(user_id, created_at desc);
create index if not exists ix_skill_assessments_skill
  on public.skill_assessments(user_id, skill_id, created_at desc);
create index if not exists ix_skill_questions_assessment
  on public.skill_assessment_questions(assessment_id, ordinal);
create index if not exists ix_skill_attempts_assessment
  on public.skill_assessment_attempts(assessment_id, created_at);
create index if not exists ix_skill_signals_assessment
  on public.skill_assessment_concept_signals(assessment_id, concept_id);
create index if not exists ix_skill_outcomes_user
  on public.skill_assessment_outcomes(user_id, created_at desc);
create index if not exists ix_question_bank_skill
  on public.assessment_question_bank(skill_id, is_active, difficulty);

alter table public.skill_assessments enable row level security;
alter table public.assessment_question_bank enable row level security;
alter table public.skill_assessment_questions enable row level security;
alter table public.skill_assessment_attempts enable row level security;
alter table public.skill_assessment_concept_signals enable row level security;
alter table public.skill_assessment_outcomes enable row level security;
alter table public.skill_assessment_generation_runs enable row level security;

create policy "assessment_bank_read"
on public.assessment_question_bank for select to authenticated
using (is_active=true);

create policy "skill_assessments_select_own"
on public.skill_assessments for select to authenticated
using (user_id=(select auth.uid()));

create policy "skill_questions_select_own"
on public.skill_assessment_questions for select to authenticated
using (exists(
  select 1 from public.skill_assessments a
  where a.id=assessment_id and a.user_id=(select auth.uid())
));

create policy "skill_attempts_select_own"
on public.skill_assessment_attempts for select to authenticated
using (user_id=(select auth.uid()));

create policy "skill_signals_select_own"
on public.skill_assessment_concept_signals for select to authenticated
using (user_id=(select auth.uid()));

create policy "skill_outcomes_select_own"
on public.skill_assessment_outcomes for select to authenticated
using (user_id=(select auth.uid()));

create policy "skill_generation_runs_select_own"
on public.skill_assessment_generation_runs for select to authenticated
using (exists(
  select 1 from public.skill_assessments a
  where a.id=assessment_id and a.user_id=(select auth.uid())
));
