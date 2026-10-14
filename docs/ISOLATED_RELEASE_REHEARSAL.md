# Isolated end-to-end release rehearsal

**Purpose:** prove one real assessment-linked APPLIED PlanDiff and one confirmed agent action before public launch. This is **not** a production reset procedure.

## Isolation contract

- Use a **new Supabase development branch/project ref** with its own Postgres database, Auth, and Storage. A schema-only branch is not a substitute for verifying that all service URLs and database credentials point to the branch.
- Use a **separate Railway preview project or environment** with the tested GitHub branch pinned. Never attach the preview domain to the production service or use production Postgres credentials.
- Do not copy real learner profiles, passwords, assessment responses, Gemini secrets, or production service-role keys into the preview.
- Seed only public reference data using the reviewed migrations and `supabase/seed.sql`, then create a **disposable** test learner in the isolated Auth project.
- Production health and read-only smoke can run separately; never run `SMOKE_DESTRUCTIVE=true` on production.

## Preconditions

1. Obtain Supabase branch/project creation cost and user approval.
2. Verify new project ref differs from production ref `eozvilqmrhtujqtdmrri`.
3. Apply reviewed migrations and reference seed, confirm a valid role, verified assessment question bank, resources, private storage, RLS, and critical function grants.
4. Deploy preview app with **explicit** `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_DB_URL`, `DEMO_FALLBACK_ENABLED=true` and a unique `DEMO_RESET_SECRET`. Optional AI should use deterministic fallback; do not copy production Gemini credentials. Preview DB connection must be inspected before writes.
5. Ensure preview app identity and its Auth/DB endpoints match the same isolated project; a preview hostname alone does **not** prove database isolation.
6. Sign into preview using an isolated test account, not a personal/prod account.

## Dedicated preview smoke

Run **only after** verifying the target host and Supabase project ref outside the script:

```bash
BASE_URL="https://<preview>.up.railway.app" \
SUPABASE_URL="https://<isolated-project-ref>.supabase.co" \
SUPABASE_ANON_KEY="<preview-publishable-key>" \
SMOKE_EMAIL="<isolated-disposable-email>" \
SMOKE_PASSWORD="<isolated-password>" \
DEMO_RESET_SECRET="<preview-only-reset-secret>" \
SMOKE_TEST_DB_REF="<isolated-project-ref>" \
SMOKE_ISOLATED=true \
SMOKE_DESTRUCTIVE=true \
SMOKE_REQUIRE_APPLIED_DIFF=true \
SMOKE_VERIFY_AGENT_ACTION=true \
npm run smoke:release
```

The test must fail closed if it detects the known production host or Supabase project ref. It must record a completed assessment with accepted evidence, refreshed gap snapshot, and a **linked, applied** PlanDiff advancing the active plan exactly one version. It must create and confirm one agent action, reject a duplicate confirmation, and show exactly one proposal-linked `chat.action.executed` event.

**Important:** A weak assessment may correctly yield NO_OP when the skill is outside the mutable plan horizon. For an APPLIED PlanDiff acceptance case, select an assessable skill with unfinished future tasks and enough adaptation capacity. Never force a fake diff or mutate reference results.

## Rerun and cleanup

- Verify the original test learner can resume on refresh; verify another isolated user cannot view its data, documents, chats, assessment responses, Sparks, or plan history.
- Verify reset affects **only the disposable learner**, preserves seeded catalogs, and the flow is repeatable.
- Record the test app commit, branch/project IDs, sanitized pass/fail labels, and any latency/5xx failures. **Never** paste raw secrets, JWTs, assessment answers, user IDs, or connection strings in reports.
- Once the rehearsal is complete and approved, turn off the preview app and delete its test resources using the provider's normal lifecycle; do **not** merge Supabase test branch migrations into production unless deliberately reviewed.
- Keep PRs on main unmerged until CI, authentication/authorization tests, and release owner review pass.

## Latest executed local rehearsal (14 October 2026)

The GitHub Actions **Isolated Release Rehearsal** completed successfully at commit `0845139a043d1fd1950b69a3b63d63db79afaf72`, with:
- `ASSESSMENT_REPLAN_PROOF=APPLIED_PLAN_DIFF`
- `AGENT_CONFIRMATION_PROOF=PASS`
- `TENANT_ISOLATION_PROOF=PASS`
- `RELEASE_SMOKE=PASS`

[Green isolated run](https://github.com/navadeep-17/SkillTwin/actions/runs/38541082662). No hosted Supabase branch or paid Railway preview was required for the automated rehearsal.

## Remaining production release blockers

- Production has a justified assessment NO_OP, but no verified APPLIED PlanDiff or executed chat action in its own learner dataset.
- Supabase Auth leaked-password protection and four callable Arena SECURITY DEFINER functions need review.
- Production 5xx spikes and readiness/AI latency need further operational testing.
- Complete authenticated real-browser testing and deployment rollback rehearsal before unrestricted access.
