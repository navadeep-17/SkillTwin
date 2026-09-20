# SkillTwin

**SkillTwin — A learning agent that evolves as you do.**

SkillTwin is an evidence-backed adaptive learning agent built for the Product Space Agentic AI Hackathon 2026. Instead of generating a one-time roadmap, SkillTwin maintains a persistent learner model, compares it with a versioned target-role competency model, plans learning work, validates uncertain skills, and minimally replans the future roadmap when new evidence materially changes the learner state.

## Core loop

\`\`\`text
profile evidence
  -> canonical SkillTwin state
  -> target-role gap analysis
  -> adaptive learning plan
  -> learner action / Challenge Me
  -> evaluated evidence
  -> SkillDelta
  -> gap refresh
  -> minimal PlanDiff
  -> updated roadmap
  -> grounded explanation + audit trail
\`\`\`

## Product surfaces

The authenticated application includes:

- **Overview** — career-readiness guidance, weekly progress, validated skills, learning streak, Today’s Plan, Challenge Me, current roadmap progress, and recent agent insight.
- **Skill Graph / Skill Matrix** — capability, confidence, role target, priority, prerequisite context, and evidence-backed skill detail.
- **Roadmap** — versioned Learn / Practice / Build / Validate tasks constrained by weekly capacity and prerequisite stages.
- **Practice / Challenge Me** — adaptive MCQ, short-text, and scenario assessment with deterministic rubrics and bounded AI evaluation.
- **Projects** — project evidence plus gap-targeted project recommendations.
- **Progress** — readiness trend, SkillDelta history, assessment history, roadmap evolution, and persisted weekly reports.
- **Ask SkillTwin** — grounded Journey Chat over current learner state with confirm-before-mutation action proposals.
- **Agent Activity** — observable committed triggers, changes, references, and impact; hidden model chain-of-thought is never exposed.
- **Settings** — goal/timeline, learning constraints, adaptation mode, profile evidence, notifications, weekly reports, and motion preference.

Global **Ask SkillTwin** and **Agent Activity** drawers are available throughout the authenticated app.

## Architecture rules

1. **AI proposes; application logic decides.** AI outputs are typed, schema-validated proposals. Canonical state mutations are deterministic.
2. **Capability and confidence are separate.** Missing evidence is uncertainty, not zero ability.
3. **Evidence is provenance-first.** Resume, manual profile, project, certificate, learning, practice, and assessment evidence remain source-linked and auditable.
4. **Role targets are versioned.** Readiness is a target-role guidance metric, not a hiring probability.
5. **Resource URLs are catalog-backed.** The planner does not allow an LLM to invent learning links.
6. **Plans are immutable versions.** Replanning creates the smallest safe future-plan patch and preserves completed history.
7. **Undo is compensating, not destructive.** Safe undo creates another immutable plan version.
8. **Journey Chat is read-only by default.** Mutating actions require explicit confirmation and stale-baseline validation.
9. **Agent Activity is observable state-change metadata only.** It never exposes hidden reasoning.
10. **The deterministic path remains usable if AI is unavailable.**

## Implemented component map

The repository implements the frozen A–J architecture:

- **A — SkillTwin + Evidence Engine:** canonical taxonomy, weighted evidence, confidence, conflict handling, hysteresis, immutable SkillDelta history.
- **B — Profile / Resume Analyzer:** secure PDF ingestion, manual profile fallback, optional certificates, project evidence, structured profile output, unresolved-term review queue.
- **C — Role Model + Gap Analyzer:** seeded/custom role versions, SINGLE / ALL_OF / ANY_OF requirements, prerequisite DAG, readiness, priority, validation-vs-learning action selection.
- **D — Learning Planner + Resource Matcher:** weekly constraints, adaptation buffer, verified resource catalog, plan persistence, task execution, resource feedback.
- **E — Assessment + Evaluator:** adaptive item selection, deterministic MCQ scoring, bounded semantic evaluation, concept signals, assessment evidence.
- **F — Adaptive Replanner:** material trigger evaluation, minimal PlanDiff generation, automatic vs ask-first behavior, validation, versioning, safe undo.
- **G — Frontend + Visualizations:** four-step onboarding, overview, skills, roadmap, practice, projects, progress, settings, responsive global agent drawers.
- **H — Database + API:** Supabase/Postgres schema, RLS, private Storage, transactional services, typed API responses, indexes, migrations.
- **I — Journey Chat + Agent Activity:** grounded chat state, action proposals, stale-state guards, rejection/confirmation audit, paged activity detail.
- **J — Deployment + QA:** health/readiness, deterministic demo reset, release metadata, static client/server boundary checks, regression tests, DB contract checks, optional cross-user RLS test, production smoke script.

## Demo path

The intended judge demo is:

1. Start from the verified Backend Engineer demo baseline.
2. Open Overview / Skill Graph and show evidence-backed learner state.
3. Run **Challenge Me** for REST APIs.
4. Intentionally struggle with HTTP update semantics and idempotency.
5. Complete the assessment.
6. Show the resulting SkillDelta / weakness signals.
7. Open **See What Changed** and show the generated PlanDiff.
8. Show the updated immutable roadmap version and targeted reinforcement task.
9. Ask Journey Chat: **“Why did my roadmap change?”**
10. Open Agent Activity and show the same committed evidence / assessment / plan-change references.

## Demo reset

The demo reset path clears only the signed-in learner’s SkillTwin state, rebuilds the deterministic baseline through the same canonical services used by the product, and verifies invariants before reporting **DEMO READY**.

There are two paths:

- **In-app reset:** server action; the browser never receives or names the reset credential.
- **Automation reset:** \`POST /api/demo/reset\` with \`x-skilltwin-demo-secret\`.

Reset preserves global taxonomy, seeded roles, verified resources, and the assessment question bank. Each reset is recorded in \`demo_reset_runs\` as STARTED / READY / FAILED with verification metadata.

## Local setup

Requirements:

- Node.js 22
- Supabase CLI for local database workflows
- A Supabase project for hosted auth/database/storage
- Optional Gemini key for semantic extraction/evaluation

Copy the environment template:

\`\`\`bash
cp .env.example .env.local
\`\`\`

Set:

\`\`\`bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-publishable-key>

SUPABASE_DB_URL=<server-only postgres connection>
SUPABASE_SERVICE_ROLE_KEY=<server-only service role key when required>

AI_PROVIDER=gemini
GEMINI_MODEL=gemini-3.8-flash
GEMINI_API_KEY=<optional-live-ai-key>

DEMO_FALLBACK_ENABLED=true
DEMO_RESET_SECRET=<at-least-16-character-server-secret>
\`\`\`

Never expose \`SUPABASE_DB_URL\`, \`SUPABASE_SERVICE_ROLE_KEY\`, AI API keys, or the demo reset credential in client code.

Install and run:

\`\`\`bash
npm install
npm run dev
\`\`\`

## Quality gates

Run the full local release gate:

\`\`\`bash
npm run release:verify
\`\`\`

That runs:

\`\`\`text
eslint
migration/seed static verification
client/server boundary verification
core typecheck
core regression tests
full TypeScript typecheck
production Next.js build
\`\`\`

Additional checks:

\`\`\`bash
# Requires SUPABASE_DB_URL
npm run qa:db

# Destructive test fixture; requires explicit opt-in and Supabase test credentials
ALLOW_RLS_TESTS=true npm run qa:rls

# Requires deployed base URL
SKILLTWIN_BASE_URL=https://<deployment> npm run smoke:production
\`\`\`

The cross-user RLS test creates two temporary users and verifies row isolation, learner-owned custom-role isolation, and private profile-document Storage isolation, then cleans them up.

## Health and readiness

- \`GET /api/health\` — cheap liveness endpoint.
- \`GET /api/readiness\` — verifies database connectivity, release metadata, seeded Backend Engineer v1, resource catalog, REST assessment bank, private Storage, AI mode, and deterministic fallback availability.

Release metadata currently expects:

\`\`\`text
schema_contract_version = skilltwin-full-spec-v1
seed_version            = seed-2026-09-19-v2
resource_catalog        = resource-catalog-d2
demo_fixture            = demo-backend-v1
\`\`\`

## Database workflow

Repository migrations are under \`supabase/migrations/\` and are strictly sequenced. The current full-spec head is migration **0021**.

Local commands:

\`\`\`bash
npm run db:start
npm run db:reset
npm run db:push
\`\`\`

\`supabase/seed.sql\` is idempotent for the deterministic global role/resource/question-bank baseline.

## CI

GitHub Actions runs on \`main\` and \`full-spec-implementation\`:

- lint
- static QA
- core typecheck/tests
- full typecheck
- production build
- live DB contract check when \`SUPABASE_DB_URL\` is configured
- cross-user RLS/private-storage test when the required Supabase CI credentials are configured

## Deployment

Recommended target: Vercel + Supabase.

Before production submission:

1. Configure all Production environment variables.
2. Apply repository migrations through 0021 and the current seed.
3. Confirm \`/api/readiness\` reports \`ready\`.
4. Run \`smoke:production\`.
5. Reset the demo learner and complete the full judge path twice consecutively.
6. Confirm Agent Activity and plan history remain consistent after both rehearsals.
7. Keep the reset credential and database/service-role credentials server-only.

## Scope boundaries

Intentionally out of MVP scope:

- LinkedIn import
- full GitHub repository scanning
- job scraping
- coding sandbox
- live mentors
- peer community / leaderboards
- native mobile app
- video hosting
- certificates as proof of mastery
- payments
- job tracking
- rich notification center
- collaboration

Certificates and manual profile text may contribute conservative contextual evidence, but they never directly establish proficiency.
