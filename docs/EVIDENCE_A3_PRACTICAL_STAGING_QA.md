# Evidence A3 Practical Review & Authenticated Staging Acceptance

## Status & boundaries

The A3 feature is implemented only in draft PR #64. The code does **not** run arbitrary learner-submitted code. A passing review is an independent **human-attested live demonstration**, not automated execution, code authorship proof, employment readiness, IRT, or expert-calibrated ability.

The production Evidence Engine, scoring A2 flag, existing role-gap snapshots, and learning plans remain unchanged. A3 is **server flag OFF by default**.

### Why project defense was not automatically promoted

The existing \`/project-defense\` tool analyzes bounded public files and gives provisional AI feedback. The project defense service explicitly says it is not proof of authorship or verified learner evidence. The new reviewer path therefore requires a **separately authorized reviewer** to observe a learner complete a concrete practical task and document the procedure and result at a pinned public GitHub commit.

## Database migration — STAGING ONLY until approval

\`supabase/migrations/0029_a3_practical_review_attestations.sql\` creates:

- \`competency_reviewers\`: deliberately empty allowlist of separately provisioned reviewers, default \`active=false\`.
- \`competency_practical_reviews\`: immutable independent practical-review events (learner, reviewer, project/version, criterion, pinned commit, task, test procedure, observed result and PASS/FAIL).
- RLS on both tables and explicit denial of direct access by \`anon\`/\`authenticated\`. Only the **server's privileged database connection** can write after authenticated reviewer authorization.

If staging has migrations only through 0027, apply the reviewed canonical **0028** migration first and then **0029**, in version order.\n\nApply migration **only to the separate SkillTwin-Staging Supabase project** (\`wkbxwcspgzvvhbjhtxan\`) after reviewing it. **Do not** apply it to production project \`eozvilqmrhtujqtdmrri\`. No historical data copy.

Staging project permission must be reconnected or restored first: connected Supabase currently rejects staging SQL with \`You do not have permission to perform this action\`. No migration was applied during this phase.

### Provisioning one reviewer safely (privileged staging SQL)

Reviewers **cannot grant themselves access** through the application. First create two test learner accounts and a separate reviewer account in **STAGING** Supabase Auth, and make sure they have matching \`public.users\` rows after normal signup/onboarding. As a staging database administrator, explicitly grant reviewer access:

\`\`\`sql
insert into public.competency_reviewers(user_id,active,rationale)
values ('<STAGING_REVIEWER_PUBLIC_USERS_UUID>'::uuid,true,'QA reviewer for independently observed staging project demonstrations')
on conflict (user_id) do update
set active=excluded.active,rationale=excluded.rationale;
\`\`\`

Reviewer grant and review records should be audited. Keep reviewer account separate from the learner and never use production users or credentials. No self-service reviewer signup exists.

## Authenticated staging app

Checkout PR #64 branch locally and use a new \`.env.local\` containing **staging-only** values:

\`\`\`dotenv
NEXT_PUBLIC_SUPABASE_URL=https://wkbxwcspgzvvhbjhtxan.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<staging-publishable-or-anon-key>
SUPABASE_URL=https://wkbxwcspgzvvhbjhtxan.supabase.co
SUPABASE_ANON_KEY=<staging-publishable-or-anon-key>
SUPABASE_DB_URL=<staging-postgres-connection-string>
SKILLTWIN_EVIDENCE_A3_ENABLED=true
\`\`\`

Additional app-required variables should also point exclusively to STAGING. Do not paste or commit credentials. Read the existing config schema for any other locally required variables.

\`\`\`bash
git switch feature/evidence-a3-competency-verification-20261014
npm install
npm run qa:evidence-a3:offline
npm run dev
\`\`\`

Create an active goal and complete a seeded assessment for staging learner 1. Confirm a gap snapshot exists. Learner 2 should be a different newly created staging account; it can have no snapshot.

### Authenticated QA (PowerShell, second terminal)

\`\`\`powershell
$env:BASE_URL="http://127.0.0.1:3000"
$env:SMOKE_ACCOUNTS_DISPOSABLE="true"
$env:SMOKE_EMAIL="<staging-learner-one-email>"
$env:SMOKE_PASSWORD="<staging-learner-one-password>"
$env:SMOKE_EMAIL_2="<staging-learner-two-email>"
$env:SMOKE_PASSWORD_2="<staging-learner-two-password>"
$env:A3_EXPECTED_STATE="enabled"
node --env-file=.env.local scripts/evidence-a3-auth-staging-qa.mjs
\`\`\`

Pass requires:
- Anonymous \`GET /api/gaps/verification\` is 401 when flag ON;
- two dedicated staging users can sign in;
- user 1 gets a persisted snapshot and an A3 analysis with at least one reviewed bank question or practical attestation;
- read-only A1 readiness matches existing \`GET /api/gaps\`;
- evidence IDs are disjoint across the two users;
- both A1 gap analyses are unchanged after the preview.

Run a separate flag-OFF check by stopping the local app, setting \`SKILLTWIN_EVIDENCE_A3_ENABLED=false\`, restarting it and running the same command with \`$env:A3_EXPECTED_STATE="disabled"\`. The A3 API must return 404.

**Important**: the script is read-only; it cannot create accounts, assessment data, project rows or a reviewer attestation. Those must be deliberately prepared using the staging application.

## Independently reviewed practical check

The reviewer-only \`POST /api/skills/verification/reviews\` accepts a strict JSON object (no reviewer ID):

\`\`\`json
{
  "learnerUserId": "<UUID of staging learner>",
  "projectId": "<UUID of project owned by learner>",
  "criterionId": "rest-api.resource-routing",
  "commitSha": "<40-character Git commit SHA>",
  "reviewedSourcePath": "<one of the source file paths returned by public repository inspection>",
  "verdict": "PASS",
  "practicalTask": "<at least 50 characters describing the live task the learner performed>",
  "observedResult": "<at least 50 characters describing the result the reviewer independently observed>",
  "testProcedure": "<at least 30 characters describing the verification steps and expected/actual result>",
  "observedLearnerLive": true
}
\`\`\`

The server derives the reviewer ID from the authenticated session, ensures active reviewer allowlist membership, verifies the project belongs to another learner, checks its repository is canonical public GitHub and currently pinned at the supplied HEAD SHA, confirms the selected file and Git blob SHA from the bounded server-side inspection, validates the exact skill rubric criterion and version, and adds an immutable event. Duplicate events return conflict. Revoked reviewers do not supply new authoritative A3 evidence. All input is bounded; repository source code is never run by the SkillTwin server.

A verdict becomes \`REVIEWED\` or \`NOT_DEMONSTRATED\` for **that exact criterion only** after the read-only preview queries the persisted and currently authorized review. Two or more unrelated criteria and tiers still require their own reviewed observations. Reviewers remain responsible for assessing actual behavior, independent performance and ambiguous outcomes. A reviewer can be mistaken; no authorship or probabilistic correctness claim is made.

## Remaining validation and rollout gate

1. Restore staging Supabase project access and apply/review migration 0029 there.
2. Use staging-only app configuration and dedicated accounts for authenticated API, UI, flag OFF/ON and reviewer authorization checks.
3. Verify a pass and a fail from independent reviewer accounts; test unauthorized/self-review and altered project/commit rejection.
4. Review coverage, reviewer accuracy and practical-grading reproducibility using an expert-labelled benchmark.
5. Only then decide whether to merge PR #64. A3 should remain preview-only until separately approved.

No Railway upgrade is required for local staging; project provisioning limits do not prevent local app testing.
