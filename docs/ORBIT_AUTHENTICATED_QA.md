# Orbit Authenticated Preview QA — Release Gate

Status: prepared, **not executed against a signed-in account**. Never treat passing anonymous browser tests as proof that private SkillTwin screens work.

## Purpose
Confirm that the isolated `/orbit-beta`, `/orbit-skills`, `/orbit-journey`, `/orbit-prove`, and `/orbit-onboarding` routes work for a real test learner, without modifying existing production pages, creating records, or revealing screenshots of private evidence.

## Safe setup
1. Use a dedicated, nonpersonal SkillTwin test account with its own seeded profile and career goal. Do **not** reuse a personal account.
2. Check out `design/skilltwin-orbit-exploration` and run it locally or in an isolated preview environment connected to the correct Supabase project.
3. Supply public Supabase runtime configuration as required by the existing app and the account's test credentials via local environment variables. **Do not commit credentials, paste them in issues/PRs, or attach them to artifacts.**
4. Install browser tools (`npm install --no-save --package-lock=false @playwright/test@1.55.0`, `npx playwright install chromium`). Run the branch (`npm run dev`).
5. Set `BASE_URL` to the local/preview origin and `SMOKE_EMAIL` / `SMOKE_PASSWORD` for the dedicated account. Execute `node scripts/orbit-auth-qa.mjs` in that environment.
6. The command tests desktop and phone viewports. It prints only route-level PASS/FAIL markers, not screenshots, passwords, email addresses or learner evidence.

### What the automated browser script actually tests
- Form sign-in redirects to the signed-in app.
- Each of the five Orbit preview routes renders without redirects/errors.
- Horizontal overflow is absent at both checked widths.
- My Twin can switch to List, select a requirement and display the inspector if a role graph exists; otherwise the empty role state is visible.
- Journey shows only the active goal's saved roadmap, milestone status, source-backed PlanDiffs and NO_OP explanations. It never mutates a task or approval.
- No profile mutation, assessment submission or task-completion action is intentionally triggered.

### Prove-specific review

- `/orbit-prove` is an authenticated, read-only evidence and proof-history inspector. Confirm that capability and confidence match the existing `/challenge-my-twin` screen for the same dedicated test learner.
- Search/filter/select a skill, review question-bank readiness (>=4 validated questions), resume any already active assessment, and verify the before/after trail references a real stored completed assessment. The concern selector is display-only and **must not influence grading**.
- The private automated smoke script only **reads** `/orbit-prove`. Starting a challenge is a separate intentional write action and should be tested manually only with a dedicated test learner.
- In a deliberate manual assessment: launch a challenge, complete questions through `/orbit-prove/session/[id]`, return to Prove, and verify persisted assessment → accepted evidence → skill history → replan decision and applicable PlanDiff or NO_OP. Do not assume a PlanDiff must exist; NO_OP and no recorded decision are distinct.
- The existing verified assessment component owns answer validation, grading, evidence writes and replan retry; the Orbit wrapper must not create a second scoring engine.
- Public `/orbit-lab/proof-demo` contains entirely fictional data. Its submission button is disabled and browser tests assert it never POSTs to `/api/assessments`.

### Additional manual checks (cannot be assumed from CI)
- Change active role **using only the dedicated test account**, then confirm the readiness snapshot and graph match that role rather than an old goal.
- Enter onboarding; verify focus order, error/retry behavior, field contrast, custom role generation states and loading accessibility. Saving here **does write** to the test learner account.
- Inspect the graph and evidence list on mobile with screen reader and keyboard only. Confirm capability, confidence and role gap never collapse into one indicator.
- Compare the Orbit inspector values and dependency relationships with the original `/skills` view for the same learner.
- Verify that a project/resume's personal claims are never present on the public `/orbit-lab/skill-demo` sample route.
- Confirm isolated production-equivalent runtime, RLS behavior, loading performance and error paths before merging.

### Release decision
PR #42 is a **draft**, not a production release. The anonymous and fixture browser suites, TypeScript build, and static read-only checks do not replace this signed-in gate. A separate review of authenticated screenshots may be performed locally; keep sensitive screenshots out of public GitHub Actions artifacts.

## Public concept proof (no sign-in)
`/orbit-lab/skill-demo` uses visibly fictional data and the same `OrbitSkillExperience` component as the authenticated My Twin route. CI captures interaction results on 1440px, 768px, 390px and 360px screens. This validates component usability, **not production data correctness**.
