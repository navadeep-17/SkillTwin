# SkillTwin Release + Demo Runbook

This runbook is the operational companion to the frozen Component J specification. Railway is the production compute target; Supabase remains the canonical database, Auth, Storage, RLS, and realtime platform.

## Release invariants

A release is a GO only when all of the following are true:

- CI passes core typecheck, core tests, frozen-contract QA, full TypeScript, and the production Next.js build.
- The latest Supabase migration is present in production and release metadata is readable from `/api/readiness`.
- `/api/health` reports the expected Railway commit and `platform=railway`.
- `/api/readiness` reports `status=ready` and `database=ready`.
- Anonymous protected pages redirect to login and protected APIs return 401.
- RLS/storage QA passes against the production Supabase schema.
- The authenticated release smoke passes for the dedicated smoke user.
- For a full rehearsal, destructive smoke is enabled only for that dedicated smoke user and the demo reset secret is present.
- No unresolved P0 regression is open in Profile -> SkillTwin -> Gap -> Plan -> Challenge -> SkillDelta -> PlanDiff -> explanation.

## Required production configuration

Railway:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_DB_URL`
- `AI_PROVIDER=gemini`
- `GEMINI_MODEL`
- `GEMINI_API_KEY`
- `DEMO_FALLBACK_ENABLED=true`
- `DEMO_RESET_SECRET`

GitHub release-smoke secrets:

- `SMOKE_SUPABASE_URL`
- `SMOKE_SUPABASE_ANON_KEY`
- `SMOKE_EMAIL`
- `SMOKE_PASSWORD`
- `SMOKE_DESTRUCTIVE`
- `DEMO_RESET_SECRET`

GitHub database-QA secret:

- `QA_SUPABASE_DB_URL`

Never expose database credentials, service-role credentials, demo reset secrets, or AI keys to browser code or logs.

## Release sequence

1. Merge only a green PR to `main`.
2. Confirm the exact `main` SHA.
3. Deploy that exact SHA to the existing Railway production service.
4. Wait for Railway build and configured `/api/health` healthcheck to pass.
5. Verify `/api/health` returns the deployed SHA.
6. Verify `/api/readiness` returns database ready plus expected schema/seed metadata.
7. Run database security QA.
8. Run release smoke.
9. Run the critical judge rehearsal below.
10. Mark GO only after all steps pass.

## Critical judge rehearsal

Use a dedicated demo learner.

1. Sign in.
2. Set the target role and learning constraints.
3. Upload a text-based PDF resume or add project/manual evidence.
4. Wait for analysis to finish.
5. Verify SkillTwin shows capability and confidence separately.
6. Verify the role gap snapshot and readiness exist.
7. Verify Plan v1 exists and contains verified resource assignments.
8. Open a learning task detail screen and complete one non-validation task.
9. Start Challenge Me.
10. Complete the adaptive assessment, including constructed-response questions when selected.
11. Verify assessment summary evidence is committed.
12. Verify SkillDelta/history updates.
13. Verify the gap snapshot is recomputed.
14. Verify the adaptive replanner either records a deterministic no-op or creates a PlanDiff.
15. If a PlanDiff is applied, verify immutable Plan vN+1 and See What Changed.
16. For ASK_FIRST mode, verify proposal -> explicit apply/reject.
17. Ask SkillTwin why the roadmap changed and confirm grounded references.
18. Open Agent Activity and confirm the same committed events.
19. Open Progress and verify readiness/evidence history.
20. Refresh key pages and confirm state survives browser reload.

## Failure rehearsal

Before the final demo, verify at least once:

- AI key unavailable: deterministic resume/assessment fallback remains usable and canonical state is not corrupted.
- Duplicate assessment answer submission: no duplicate canonical evidence is created.
- Duplicate task completion: completion is idempotent.
- Duplicate project submission/evidence ingestion: idempotency prevents duplicate canonical impact.
- Invalid/stale PlanDiff: apply returns a safe conflict and leaves the active plan unchanged.
- Inactive/unverified replacement resource: PlanDiff apply is rejected.
- Network interruption during a mutation: refresh returns the last committed state.
- Invalid PDF MIME/signature/size: upload is rejected before persistence.
- Cross-user access: protected resources are not readable or writable.
- Prompt injection inside resume/project/chat content cannot bypass application-owned state rules.

## Rollback

If the new Railway release fails health/readiness or a P0 smoke:

1. Stop further mutations from the demo account.
2. Roll back the Railway service to the last known-good deployment.
3. Confirm `/api/health` and `/api/readiness`.
4. Do not roll back database migrations destructively during the live event unless a tested forward fix is impossible.
5. If state corruption is suspected, use the dedicated demo reset for the demo learner only; never wipe shared taxonomy/role/resource/question-bank data.
6. Record the failed commit/deployment ID and observed error before retrying.

## Backup/recovery posture

- Supabase/Postgres is canonical; Railway instances are stateless.
- Schema changes are versioned in `supabase/migrations`.
- Seed and release metadata are versioned in the repository.
- Demo reset deletes only the signed-in learner's mutable SkillTwin state and preserves global seed data.
- Before the final event, confirm the Supabase project's backup/PITR posture in the provider dashboard.
- Recovery preference: restore/repair canonical database state first, then redeploy stateless web compute.

## Incident playbook

- **Health fails:** inspect Railway build/deploy logs, verify required variables, roll back if the previous deployment is healthy.
- **Readiness database fails:** verify Supabase connectivity and pooler/database URL; do not bypass readiness.
- **AI fails:** keep deterministic fallback enabled; do not make model output canonical without validation.
- **Assessment/replan error:** preserve committed SkillTwin state; roadmap sync may retry unapplied assessment-driven replanning.
- **Resource failure:** never silently substitute an unverified URL.
- **RLS/security failure:** STOP release. Treat as a no-go until fixed.

## Final GO / NO-GO

GO requires: green CI, ready database, correct Railway commit, security QA pass, authenticated smoke pass, successful critical-path rehearsal, no P0 console/runtime errors, and a known rollback target.

Any authorization/RLS failure, broken causal loop, state corruption, or inability to reproduce the judge path is an automatic NO-GO.
