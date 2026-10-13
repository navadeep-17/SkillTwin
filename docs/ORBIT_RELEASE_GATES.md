# SkillTwin Orbit — Controlled Rollout / Release Gates

**Status: DESIGN BRANCH / DRAFT PR. NOT READY FOR PRODUCTION.**
Repository: `navadeep-17/SkillTwin`. Branch: `design/skilltwin-orbit-exploration`.
Production Railway tracks `main` and is **out of scope** for these design changes.

## Screens and data boundaries

| Route | Behavior | Release state |
| --- | --- | --- |
| `/orbit-lab` and demo subpages | Public fictional interactive prototypes, no real writes | Browser fixture QA |
| `/orbit-beta` | Signed-in read-only active-goal dashboard | Private auth QA pending |
| `/orbit-skills` | Signed-in read-only skill/evidence graph | Private auth QA pending |
| `/orbit-journey` | Signed-in read-only plan/PlanDiff/NO_OP history | Private auth QA pending |
| `/orbit-prove` | Signed-in proof history; deliberate assessment-start action | Private auth and isolated write E2E pending |
| `/orbit-prove/session/[id]` | Existing authenticated assessment component, **writes** submitted answers, evidence and replan actions | Isolated write E2E pending |
| `/orbit-explore` | Signed-in read-only career catalog, role comparisons | Private auth QA pending |
| `/orbit-onboarding` | Functional existing onboarding component, **writes** learner records | Isolated account QA pending |

The design preserves the existing underlying services and legacy UI routes as fallbacks. A completed assessment can lead to a PlanDiff, NO_OP, or temporarily missing decision; the UI must not manufacture a result. Model capability/confidence, recorded skills, career requirements and hiring eligibility are distinct.

## Current environment blocker (2026-10-13)
- Railway production is the only known app environment; there is no verified Orbit branch-preview service.
- Supabase's main SkillTwin project has **zero development branches**. Creating one is a billable action that must go through Supabase cost inspection and explicit approval.
- An existing staged Railway production patch predates the Orbit work. **Do not accept/deploy that patch** as part of Orbit; it references a legacy smoke-test service. Do not change main production configuration.
- The production replica was observed online in the runtime health check, but recent deploy attempts failed. Production deployment health should be investigated separately from this UI PR.
- **No authenticated write-path QA has been executed.** Passing TypeScript/browser-fixture checks is not evidence that real production writes work.

## Isolated preview provisioning (requires owner/cost approval)
1. Obtain owner approval for any Supabase development-branch charges. Choose the intended Supabase organization; use `get_cost`, confirm the charge, then create `skilltwin-orbit-test` on the current schema. Verify migration parity. Production rows must not be cloned.
2. Provision a **non-production Railway environment or project**, with an isolated service attached only to `design/skilltwin-orbit-exploration`. Never deploy the feature branch into the main Railway production service.
3. Configure that service with the isolated branch's own Supabase URL, anon key, DB URL and required provider settings. **Verify that every database variable points to the development project**, not the production ref `eozvilqmrhtujqtdmrri`. Do not echo secrets to chat or logs.
4. Seed a **fictional** user, active role, valid requirements and assessment question bank using approved developer fixture mechanisms. Supply only the test account through secret environment variables. Do not import real resumes or personal evidence.
5. Inspect branch preview host and check all preview destinations for authentication, RLS, empty/error states, mobile overflow, keyboard navigation, loading, and reduced-motion support.

## Verification commands

### Safe static/fixture checks
```sh
node --test tests/orbit-preview.test.mjs
npm run typecheck
npm run build
```
The GitHub Actions visual workflow builds the branch, serves it locally, and tests fictitious pages at 1440, 768, 390 and 360 px.

### Private authenticated read-only check
Using a branch-preview URL and a disposable isolated account:
```sh
BASE_URL=http://127.0.0.1:3000 SMOKE_EMAIL=<test-only-email> SMOKE_PASSWORD=<test-only-password> node scripts/orbit-auth-qa.mjs
```
Set secrets in your local environment or a protected CI secret store instead of shell history or documentation. Do not upload private user screenshots.

### Destructive isolated round-trip check (DO NOT run on production)
**Only after a human has independently verified that the preview is connected to a Supabase development branch**, provide:
- `BASE_URL` = isolated application preview origin;
- `ORBIT_E2E_TEST_DB_REF` = verified **non-production** Supabase project ref;
- `ORBIT_E2E_ISOLATED_PREVIEW=YES`, `ORBIT_E2E_ALLOW_WRITES=TEST_ACCOUNT_ONLY`;
- `SMOKE_EMAIL` and `SMOKE_PASSWORD` for a disposable learner.

Then execute `node scripts/orbit-e2e-isolated.mjs`. It deliberately answers questions using ordinary test input (not privileged answer keys). It validates that a completed challenge is persisted, that the Prove proof trail links to its canonical skill, and that a recorded replan decision is present. A failed result blocks release; it does not justify editing production records.

## Gate checklist
- [ ] Public concept fixture CI + visual QA green at latest head
- [ ] Isolated non-production database, services and test learner confirmed
- [ ] Signed-in Orbit Today, My Twin, Journey, Prove, Explore, Onboarding pages pass at desktop and mobile
- [ ] Completed isolated assessment yields persisted evidence, SkillDelta/history, and linked PlanDiff or NO_OP decision
- [ ] No unauthorized user data in cross-account reads (RLS authorization checks)
- [ ] All loading and error/retry states accessible; keyboard, screen reader and reduced-motion reviewed
- [ ] Performance reviewed on throttled mobile; Core Web Vitals targets evaluated
- [ ] Product owner approves the changed navigation and legacy fallback plan
- [ ] Separate production release/rollback plan and explicit deployment approval

## Rollback
- Keep legacy routes, model services and DB schemas intact; do not delete them during Orbit rollout.
- Prefer a feature-flag / narrow canary migration after isolated QA, then expand once real telemetry confirms readiness.
- If the Orbit UI introduces user-visible regression, switch navigation to the existing pages or revert only the UI PR. Do **not** delete skill evidence, plan history or user data to roll back a visual release.
- Never apply outstanding unrelated Railway staged patches as a side effect of rollout.

**Stop condition:** Without an isolated backend and test account, report "authenticated write-path QA blocked" rather than claiming complete end-to-end validation.
