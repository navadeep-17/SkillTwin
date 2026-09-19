# SkillTwin

SkillTwin is an evidence-backed adaptive learning agent for the Product Space AI Agent Hackathon 2026.

## Product loop

\`profile evidence -> SkillTwin -> target-role gaps -> adaptive roadmap -> Challenge Me -> assessment evidence -> SkillDelta -> gap refresh -> minimal PlanDiff -> updated roadmap -> grounded explanation\`

## Current implemented vertical slice

The repository now contains the working P0 agent loop:

1. Supabase Auth + private resume upload
2. PDF text parsing, normalization, and source-block provenance
3. Deterministic canonical skill mapping
4. Optional Gemini structured semantic evidence proposals with strict server validation
5. Evidence Engine updates canonical \`user_skills\`
6. Backend Engineer v1 gap/readiness recomputation
7. Persisted LearningPlan v1 with verified resource URLs
8. Interactive Learn/Practice/Build tasks
9. Challenge Me assessment with deterministic REST/HTTP question bank
10. Assessment summary evidence -> SkillDelta
11. Minimal adaptive replanning -> immutable Plan v2 + explicit PlanDiff
12. See What Changed + safe versioned undo
13. Grounded Journey Chat with confirm-before-mutation action proposals
14. Agent Activity audit feed

## Architecture rules

- AI proposes interpretations; application logic owns canonical state.
- Capability and confidence are separate.
- Missing evidence is UNKNOWN, not zero ability.
- Evidence/history and plan versions are auditable.
- Resource URLs come only from a verified catalog.
- Completed learning work is immutable history.
- Replanning makes the smallest safe future-plan patch.
- Journey Chat is grounded and read-only by default.
- Mutation requests from chat require explicit confirmation.
- The deterministic P0 path remains usable if the AI provider is unavailable.

## Local setup

Requirements:

- Node.js 20+
- A Supabase project with migrations \`0001\` through \`0009\` applied
- A Postgres connection string for server-side transactional writes
- Optional Gemini API key for semantic resume extraction

Copy the environment template:

\`\`\`bash
cp .env.example .env.local
\`\`\`

Set at minimum:

\`\`\`bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://eozvilqmrhtujqtdmrri.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_vAoB9dpwSkPb-zTrhXNnAA_MalFJ8bK
SUPABASE_DB_URL=postgresql://...
AI_PROVIDER=gemini
GEMINI_MODEL=gemini-3.8-flash
\`\`\`

Optional AI enhancement:

\`\`\`bash
GEMINI_API_KEY=...
\`\`\`

Never commit \`.env.local\`, database passwords, secret/service-role keys, or Gemini keys.

Install and verify:

\`\`\`bash
npm install
npm run typecheck:core
npm run test:core
npm run typecheck
npm run dev
\`\`\`

Then open:

- \`/login\` — sign in / sign up
- \`/onboarding\` — upload and analyze a resume
- \`/overview\` — live SkillTwin + readiness/gaps
- \`/roadmap\` — persisted learning plan
- \`/practice\` — Challenge Me
- \`/journey\` — grounded Journey Chat
- \`/activity\` — audit trail

## Health checks

\`GET /api/health\` is a cheap liveness endpoint.

\`GET /api/readiness\` verifies the server database connection and reports optional AI-provider configuration without exposing secret values.

A production deployment is considered ready when:

- database = \`ready\`
- public Supabase configuration is available
- migrations and seed data exist
- the deterministic fallback remains enabled for hackathon reliability

## Vercel deployment

Create/import the GitHub repository in Vercel, then configure these Production + Preview variables:

\`\`\`
NEXT_PUBLIC_APP_URL=https://<your-domain>
NEXT_PUBLIC_SUPABASE_URL=https://eozvilqmrhtujqtdmrri.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_vAoB9dpwSkPb-zTrhXNnAA_MalFJ8bK
SUPABASE_DB_URL=<server-only Supabase Postgres URL>
AI_PROVIDER=gemini
GEMINI_MODEL=gemini-3.8-flash
GEMINI_API_KEY=<optional but recommended for demo>
DEMO_FALLBACK_ENABLED=true
\`\`\`

Do not expose \`SUPABASE_DB_URL\` or \`GEMINI_API_KEY\` to the browser.

After deployment:

1. Visit \`/api/health\`.
2. Visit \`/api/readiness\` and confirm \`status=ready\`.
3. Create a test user.
4. Upload a text-based PDF resume.
5. Confirm the overview contains persisted skills/readiness.
6. Confirm Plan v1 exists.
7. Run Challenge Me.
8. Intentionally miss REST/idempotency concepts.
9. Confirm SkillDelta + PlanDiff + Plan v2.
10. Open See What Changed.
11. Ask Journey Chat: “Why did my roadmap change?”
12. Verify Agent Activity contains the corresponding committed events.

## Database

Local Supabase commands remain available:

\`\`\`bash
npm run db:start
npm run db:reset
npm run db:push
\`\`\`

Remote production migrations are already versioned under \`supabase/migrations/\`; keep the repository and live project in sync.
