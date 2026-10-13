# HACK-X Career Features — QA / Release Runbook

PR order: #21 Evidence Passport -> #22 Career Discovery. Do not merge or redeploy during a live judging session without a safe rollback window.

## Current automated checks

CI runs core typecheck, core tests, contract QA, application typecheck, Next production build, a syntax check of career-feature-qa.mjs, and career-auth-guard-smoke.mjs against a real Next server with placeholder Supabase public credentials.

**These checks do not establish that a signed-in user's Supabase data renders correctly.** For that, perform browser QA.

## Authenticated browser QA, pre-merge

1. Deploy the branch to a trusted staging/preview environment with a test-only account. Keep the production main branch unchanged.
2. Set the following environment variables *locally*, not in a shared chat or repository: `BASE_URL`, `QA_ALLOWED_ORIGINS` (exact matching HTTPS origin), `SMOKE_EMAIL`, `SMOKE_PASSWORD`. Optional: `SMOKE_SECOND_EMAIL`, `SMOKE_SECOND_PASSWORD`.
3. Install QA dependencies: `npm install --no-save --package-lock=false @playwright/test@1.55.0`, then `npx playwright install chromium`.
4. Run `node scripts/career-feature-qa.mjs`.
5. Verify all checks pass: anonymous redirects, authenticated Passport with or without goal, role catalog selection to onboarding, in-memory print PDF, optional second-account identity check.
6. With a non-sensitive test profile, manually review A4 pages for clipping, readability, and the clear confidence/readiness disclaimers. The automated script does not retain PDFs or screenshots.
7. Manually inspect what the active role selector does: viewing a role must not change the existing active goal until the learner explicitly saves.

The manual `career-feature-qa.yml` workflow becomes selectable through GitHub Actions when the workflow file is present on the default branch; it is not a substitute for pre-merge staging QA when only present on this feature branch.

## Security and privacy acceptance

- No anonymous access to /passport or /discover.
- No user data supplied via URL query parameters other than an authorized role-version ID.
- No raw resumes, JWTs, cookies or assessment answers in QA artifacts, URLs, console logs or third-party services.
- All private rows filtered through signed-in user and RLS. Second-user checks are necessary but not by themselves a formal RLS audit.
- Unknown skill evidence never printed as zero, and readiness is not an employment guarantee.
- Role discovery content is not an occupational license or independently certified career match.

## Safe release steps

1. Review the PR changes and run staging browser QA.
2. Merge PR #21 before #22 (or retarget #22 to main after #21).
3. Verify GitHub CI on the resulting main commit.
4. Observe Railway's auto deployment. Confirm the deployed commit through /api/health before testing private flows.
5. Check /api/readiness and existing release-smoke test. Avoid destructive reset except on a dedicated account.
6. Verify /passport and /discover in a real browser on the deployed application.
7. Roll back using Railway deployment history on failure; do not roll back database migrations blindly (these PRs add none).

## Known limits

- Passport uses existing heuristic readiness and learner evidence: not a third-party certificate.
- Discovery catalogs only roles already in SkillTwin, not all occupations.
- Evidence summaries are read-only; no public sharing or recruiter verification.
- True skill-measurement validity, cross-role generalization, retention and paid conversion are unproven.
