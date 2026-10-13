# Scoring A2 — isolated no-cost staging QA

## Purpose

Run a signed-in assessment through the real Next.js backend and the **existing isolated Supabase staging database**, without buying another Railway environment or touching production.

QA code branch: `test/scoring-a2-staging-20261014`, based on current `main`.
Existing unrelated QA branch `test/roadmap-assessment-security-contract` is deliberately untouched.

**Current known limitation:** The staging database was initialized with 27 numbered repo migrations, the seed catalog, and a small metadata compatibility table; not every production-only legacy/extension table is reconstructible from those migrations. Thus this is a focused scoring acceptance test, not a declaration of full staging/prod parity.

## What is already verified

- GitHub CI tests A1-vs-A2 formula parity, difficulty bounds, invalid input handling, versioned evidence and an offline synthetic assessment → evidence → role-gap → replan-policy loop.
- Staging Supabase reference: `wkbxwcspgzvvhbjhtxan`; URL: `https://wkbxwcspgzvvhbjhtxan.supabase.co`.
- Staging has REST API skill `10000000-0000-0000-0000-000000000007` with six active seeded assessment questions; 53 active catalogued skills and 46 active bank items overall at the last read.
- No learner assessments or evidence records existed at the last database check.

## Local test on Windows PowerShell

Use the existing repository on your own machine, preferably in a new folder. Keep credentials only in locally ignored files or shell environment variables.

1. Checkout testing branch and install dependencies:

```powershell
git fetch origin
git switch test/scoring-a2-staging-20261014
npm install
npm run qa:scoring-a2:offline
```

2. Create `.env.local` for **STAGING ONLY**. Fill in the URL and keys from the SkillTwin-Staging Supabase project settings; obtain the staging Postgres password/connection string from **Supabase Dashboard → SkillTwin-Staging → Connect**. Do not use or copy production secrets.

```dotenv
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000
NEXT_PUBLIC_SUPABASE_URL=https://wkbxwcspgzvvhbjhtxan.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<STAGING_PUBLISHABLE_OR_ANON_KEY>
SUPABASE_URL=https://wkbxwcspgzvvhbjhtxan.supabase.co
SUPABASE_ANON_KEY=<STAGING_PUBLISHABLE_OR_ANON_KEY>
SUPABASE_DB_URL=<STAGING_ONLY_POSTGRES_CONNECTION_STRING>
SUPABASE_SERVICE_ROLE_KEY=<STAGING_SERVICE_ROLE_KEY_IF_REQUIRED>
SKILLTWIN_SCORING_A2_ENABLED=true
DEMO_FALLBACK_ENABLED=true
```

**Never** use project `eozvilqmrhtujqtdmrri` here: that is production. Do not commit `.env.local`.

3. Start local Next.js app, in terminal 1:

```powershell
npm run dev
```

4. Register a **new disposable staging-only account** using the local app (or Supabase Auth UI in the staging project), and confirm its email if that feature is required. Do not reuse a real user or production account.

5. In terminal 2, set test user credentials **only in that shell** and launch the runner with your staging app env file:

```powershell
$env:BASE_URL="http://127.0.0.1:3000"
$env:SMOKE_ACCOUNT_DISPOSABLE="true"
$env:SMOKE_EMAIL="<NEW_DISPOSABLE_STAGING_EMAIL>"
$env:SMOKE_PASSWORD="<DISPOSABLE_STAGING_PASSWORD>"
node --env-file=.env.local scripts/scoring-a2-staging-auth-qa.mjs
```

The runner refuses remote app URLs, the production Supabase project ref, and accounts not explicitly designated disposable.

## Acceptance criteria

On success, the script prints `SCORING_A2_AUTH_STAGING=PASS` only after:

- An unauthenticated skills request receives HTTP 401;
- a staging user signs in through Supabase Auth;
- a real REST API challenge is created and answered to completion;
- the saved assessment outcome is tagged `assessment-aggregator-e2`;
- the persisted level signal and confidence fit A2's documented ranges;
- the assessment has accepted evidence;
- the user's `user_skills` snapshot is visible; and
- a fresh `/api/gaps` request returns role-gap analysis.

**Replanning** may correctly produce a NO_OP (no future plan to change). The script logs that plan-diff/event checks must be examined separately; it does not claim a full adaptive-roadmap end-to-end pass.

Failures are reported as a blocking QA result. Missing schema structures should be reconciled from reviewed migrations; never fabricate production schema or copy production user records into staging.

## Release

Only enable A2 in production after the authenticated staging check passes and relevant runtime smoke tests are green. On production, the `SKILLTWIN_SCORING_A2_ENABLED` variable is currently absent; the existing A1 behavior is the default.

This branch adds QA tooling. It does **not** change the production Railway environment, production Supabase database, or the scoring model.
