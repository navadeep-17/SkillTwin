# Challenge My Twin — signed-in demo integrity and answer security

## Findings verified on 2026-10-13

The newest skill-history records store `before_state` and `after_state` as **JSONB strings**, not JSONB objects. A direct UI object check showed Unknown rather than a real before/after estimate. The proof trail reader now performs at most two JSON parse steps, accepts older snake_case snapshot keys, and treats malformed history as unknown—not invented data. The underlying evidence records are unchanged.

The challenge question bank and the staged per-assessment questions contain `answer_key` and `rubric`. Both had `SELECT` policies for authenticated users and grant-level SELECT available to authenticated sessions. This can permit answer lookup through PostgREST and undermine assessed proof. The client no longer uses the question bank: the server reads **only counts by skill** from a privileged `getSql` connection, and passes those aggregate counts to Challenge My Twin.

The separate migration `0025_protect_assessment_answer_bank.sql` revokes SELECT from `authenticated`, `anon` and `PUBLIC` for both tables, drops both old read policies, and validates that neither role has table-level SELECT. `/api/assessments` and `/api/assessments/:id` already select questions via the server-owned DB connection and intentionally sanitize public questions; they must remain unchanged.

## Safe rollout order (avoid breaking the live challenge page)

1. Merge and deploy the code **first**. This makes the challenge page independent of client SELECT for question-bank coverage.
2. Confirm Railway deployed SHA and built the new route.
3. Apply migration 0025 via Supabase's migration tracking (do not send ad hoc edits that bypass history).
4. Run postmigration database read-only verification:
```sql
select
 has_table_privilege('authenticated','public.assessment_question_bank','SELECT') as bank_auth_can_read,
 has_table_privilege('anon','public.assessment_question_bank','SELECT') as bank_anon_can_read,
 has_table_privilege('authenticated','public.skill_assessment_questions','SELECT') as staged_auth_can_read,
 has_table_privilege('anon','public.skill_assessment_questions','SELECT') as staged_anon_can_read;
```
All four must be `false`. Confirm `/api/readiness` shows `security.checks.assessmentAnswerKeys: ready`, after migration.
5. Confirm canonical skills, assessments, attempts, evidence and outcomes counts unchanged by the migration.
6. Perform a real signed-in Challenge My Twin → selected skill → assessment → proof trail. Test reload, resume, NO_OP, and before/after behavior. Never fabricate a result.

**Interim readiness:** `/api/readiness` will flag `assessmentAnswerKeys=failed` between step 1 and step 3. Complete this handoff promptly after deploying. Railway's `/api/health` remains the startup check.

## Production test status

Routes, build and unit tests can pass without proving signed-in assessment completion. End-to-end acceptance is not complete until a dedicated learner account finishes a real assessment, and the assessment outcome, skill history and triggered replanning decision are verified together.

## Compensating restrictions

Raw question-bank and staged-answer tables are inaccessible through the unprivileged authenticated Supabase role after migration. Never regrant those privileges for convenience; add server-owned, allowlisted metadata access if needed. This does not prevent a user from sharing answers they personally saw after submission, so validation still benefits from broader reviewed question banks and assessment integrity controls.
