-- The SkillTwin assessment bank contains private answer keys and rubrics.
-- Client-side accounts must never be permitted to SELECT it. All scoring and
-- question selection happens in the server-owned AssessmentService via getSql.
--
-- Release order: deploy code that reads aggregate counts over server-owned SQL
-- BEFORE applying this migration, so the signature page never depends on an
-- authenticated PostgREST SELECT against the bank.
begin;

-- Explicit privilege revocation, including grants inherited via PUBLIC.
revoke select on table public.assessment_question_bank from public, anon, authenticated;

-- RLS alone is insufficient: the previous policy allowed authenticated
-- clients to select full rows, including answer_key and rubric.
drop policy if exists assessment_bank_read on public.assessment_question_bank;

-- The server-side postgres connection retains the database owner's access.
-- No questions, rubrics, answers, assessments, evidence or learner state
-- are modified in this migration.
do $$
begin
  if has_table_privilege('authenticated', 'public.assessment_question_bank', 'SELECT')
     or has_table_privilege('anon', 'public.assessment_question_bank', 'SELECT')
  then
    raise exception 'ASSESSMENT_BANK_SELECT_GRANT_STILL_PRESENT';
  end if;
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'assessment_question_bank'
      and cmd in ('SELECT','ALL')
      and roles::text like '%authenticated%'
  ) then
    raise exception 'ASSESSMENT_BANK_CLIENT_READ_POLICY_STILL_PRESENT';
  end if;
end $$;

commit;
