# Scoring A2 staging implementation record — 14 October 2026

## Release gate

The scoring implementation is on PR #57, not main. It is OFF by default, behind `SKILLTWIN_SCORING_A2_ENABLED=true` on the **application server**. Do not set this flag in Railway production before signed-in staging QA. With the flag absent, new assessment completions still use `assessment-aggregator-e1`; previously completed assessments are never recalculated.

## Created isolated Supabase staging

- Name: **SkillTwin-Staging**
- Project reference: `wkbxwcspgzvvhbjhtxan`
- Region: `ap-southeast-2` (matches production region)
- The **27 numbered migrations** currently tracked under `supabase/migrations/0001` through `0027` have been applied to the isolated project.
- The canonical `supabase/seed.sql` was applied. Additional **public, non-user skill catalog entries** required by the JavaScript assessment bank were copied from the current reviewed SkillTwin public catalog to the staging database. **No production learner accounts, credentials, assessments, resumes, chat messages, or learning history were copied.**
- Staging has an RLS-enabled `system_metadata` compatibility table based on the production table structure, because that table is referenced by numbered migration `0023` but is not created in the numbered sequence.
- At the last verification, staging had **53 catalogued skills**, **54 assessment questions**, **zero learner skills** and **zero learner assessment records**. SQL migrations and the catalog were applied successfully.

## Known schema parity gap — do NOT claim fully production-equivalent staging

The source-controlled numbered migration sequence is not yet a complete reconstruction of all production tables. Production currently also includes older and product-extension structures, such as:
- `profiles`, `student_teacher_assignments`, `assessments`, `predictions`, and `user_consents` (a separate legacy domain)
- `user_learning_settings`, `resource_feedback`, `task_activity_events`, `profile_manual_sources`, and `demo_reset_runs`
- `arena_ai_sessions` and `arena_ai_answers`

These missing tables must be reconciled with their reviewed migrations before treating staging as a production-equivalent full application environment. Do **not** invent schemas or copy production user data to work around this.

## CI verification without staging credentials

The scoring PR includes tests for:
- difficulty-1 vs difficulty-4 performance and a reduced confidence indicator;
- invalid evaluator values, confidence bounds, concept breadth and legacy e1 fallback;
- an explicit server-only feature gate and exact versioned evidence;
- synthetic assessment → Evidence Engine `estimateSkill` → `analyzeRoleGaps` → conservative plan operation boundaries.

These tests are deterministic *engineering regressions*; they do not establish empirical calibration or authenticated database integration.

## Authenticated staging checklist (not yet complete)

1. Reconcile production-only app tables and verify RLS and required seed coverage against the source of truth. `npm run qa:db` should pass before release.
2. Create an **isolated Railway staging application** targeting the scoring feature branch; do not clone production secrets or point it to the production Supabase URL.
3. Configure the staging project's URL, publishable key, secure database connection, and service role key using approved secret controls. Do not store secrets in source, issues, or messages.
4. Enable `SKILLTWIN_SCORING_A2_ENABLED=true` on the staging app only.
5. Create a disposable test learner. Run the actual authenticated assessment create → answer → completion → evidence → gap update → replan/NO_OP, checking the saved aggregator version and observed difficulty.
6. Verify missing-source, retry/idempotency, auth/tenant isolation and e1 flag-off fallback before reviewing a release.
7. Merge and activate separately after QA. If the upgraded assessment creates unexpected evidence, unset the feature flag for new assessments. Existing records remain versioned and are not silently reverted.

No production Railway or Supabase resource has been changed by this staging preparation.
