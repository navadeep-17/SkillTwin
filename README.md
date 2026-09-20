<div align="center">

<img src="./app/icon.svg" alt="SkillTwin logo" width="88" />

# SkillTwin

### An evidence-backed adaptive learning agent that evolves as you do.

Build a living model of your skills, compare it with a target career, follow an adaptive roadmap, validate what you know, and see exactly why your plan changes.

[**Live App**](https://skilltwin-production.up.railway.app) · [**Demo**](https://skilltwin-production.up.railway.app/demo) · [**Architecture**](#architecture) · [**Local Setup**](#local-setup)

</div>

---

## What SkillTwin does

Most learning platforms give everyone a static course sequence. SkillTwin instead maintains an **evidence-backed learner model** and continuously adapts the plan around what the learner can actually prove.

The core loop is:

```text
Profile evidence
      ↓
SkillTwin learner model
      ↓
Target-role gap analysis
      ↓
Adaptive roadmap
      ↓
Challenge Me assessment
      ↓
SkillDelta
      ↓
Gap refresh
      ↓
Minimal PlanDiff
      ↓
Updated roadmap + explanation
```

The product is designed around a simple principle:

> **AI may propose interpretations. Deterministic application logic owns canonical learner state.**

---

## Product highlights

### 🧠 Evidence-backed SkillTwin

SkillTwin builds a canonical learner model from:

- resume evidence
- projects
- manually entered profile evidence
- completed learning tasks
- adaptive assessments

Capability and confidence are tracked separately. Missing evidence is treated as **UNKNOWN**, not as proof of low ability.

### 🎯 Role-relative gap analysis

The learner model is compared against a versioned target-role model to compute:

- skill gaps
- gap severity
- prerequisite dependencies
- readiness
- evidence coverage
- highest-impact next focus

### 🗺️ Adaptive roadmap

SkillTwin creates a constrained learning plan using four task types:

- **LEARN**
- **PRACTICE**
- **BUILD**
- **VALIDATE**

Plans respect learner availability, prerequisite order, verified resources, and completed-work history.

### ✨ Challenge Me

Assessments support:

- multiple choice
- short text
- scenario questions
- adaptive difficulty
- concept coverage
- deterministic scoring/fallbacks
- structured semantic evaluation when Gemini is available

Assessment results are committed as evidence and can update the SkillTwin automatically.

### 🔁 Explainable replanning

When new evidence justifies a change, SkillTwin creates a minimal, versioned **PlanDiff** instead of rebuilding the whole roadmap.

Supported operations include:

- add task
- move task
- remove task
- change difficulty
- change duration
- change resource

Every plan change is auditable and can be surfaced through **See What Changed**.

### 💬 Grounded Journey Chat

Ask SkillTwin can explain:

- readiness
- skill gaps
- roadmap changes
- evidence
- next actions

Chat is grounded in persisted product state and is read-only by default. Mutation requests require explicit confirmation.

### 📈 Progress and auditability

The product exposes:

- readiness trend
- evidence coverage
- SkillDelta history
- assessment validation history
- roadmap evolution
- PlanDiff history
- Agent Activity audit events

---

## Current product surfaces

| Area | Purpose |
|---|---|
| **Home** | Readiness, evidence coverage, focus area, recent changes |
| **Skills** | Interactive Skill Graph + evidence detail |
| **Plan** | Adaptive roadmap and task progression |
| **Practice** | Challenge Me assessments |
| **Projects** | Project evidence + recommendations |
| **Progress** | Readiness/evidence trends and SkillDelta history |
| **Ask SkillTwin** | Grounded learner-state assistant |
| **Activity** | Auditable agent events |
| **Settings** | Learning constraints and preferences |
| **Onboarding** | Target role + resume/manual evidence setup |

---

## Architecture

SkillTwin follows a **server-authoritative agent architecture**.

```text
                    ┌──────────────────────┐
                    │       Next.js UI      │
                    │  App Router + React   │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │      API Routes       │
                    │  Auth + Validation    │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
    ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
    │ Evidence Engine │ │ Gap / Planner  │ │ Assess / Replan│
    └────────┬───────┘ └────────┬───────┘ └────────┬───────┘
             │                  │                  │
             └──────────────────┼──────────────────┘
                                ▼
                    ┌──────────────────────┐
                    │      Supabase         │
                    │ Postgres · Auth · RLS │
                    │ Storage · Realtime    │
                    └──────────────────────┘

                     Optional semantic layer
                                │
                                ▼
                    ┌──────────────────────┐
                    │       Gemini AI       │
                    │ structured proposals  │
                    └──────────────────────┘
```

### Core architectural rules

- canonical state is persisted server-side
- capability and confidence are separate
- evidence is appendable and auditable
- completed learning work is immutable history
- plans are versioned
- resources must come from the verified catalog
- replanning applies the smallest safe future-plan patch
- AI output is schema validated
- invalid structured AI output gets one bounded repair retry, then fails closed
- deterministic fallbacks keep the P0 path usable if the AI provider is unavailable

---

## Tech stack

### Frontend

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- React Flow
- Lucide Icons
- TanStack Query

### Backend

- Next.js API Routes
- PostgreSQL
- Supabase Auth
- Supabase Storage
- Supabase Realtime
- Row Level Security
- Zod validation

### AI

- Gemini structured interactions
- deterministic fallback paths
- schema-validated outputs
- prompt-injection boundaries around untrusted profile content

### Deployment

- **Railway** — application runtime
- **Supabase** — database, Auth, Storage, RLS and Realtime
- **GitHub Actions** — CI and release QA

---

## Repository structure

```text
app/
  api/                  API routes
  onboarding/           Target + evidence setup
  overview/             Learner home
  skills/               Skill Graph
  roadmap/              Adaptive plan + PlanDiff views
  practice/             Challenge Me
  projects/             Project evidence
  progress/             Readiness and SkillDelta history
  journey/              Journey Chat
  activity/             Agent Activity

components/
  brand/                SkillTwin logo/branding
  shell/                Navigation and global assistant
  skills/               Skill Graph UI
  roadmap/              Roadmap/task UI
  practice/             Assessment experience
  onboarding/           Resume/manual profile flows
  projects/             Project evidence/recommendations

lib/
  domain/               Deterministic domain logic
  services/             Product services
  repositories/         Persistence layer
  ai/                   Structured Gemini integration

supabase/
  migrations/           Versioned production schema
  seed.sql              Canonical seed/reference data

scripts/
  release-smoke.mjs
  database-security-qa.mjs
  spec-contract-qa.mjs
  visual-qa.mjs
```

---

## Local setup

### Requirements

- Node.js **22.x**
- npm
- Supabase project
- PostgreSQL connection string
- optional Gemini API key

### 1. Clone and install

```bash
git clone https://github.com/navadeep-17/SkillTwin.git
cd SkillTwin
npm install
```

### 2. Configure environment

Copy the template:

```bash
cp .env.example .env.local
```

Set the required values:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000

NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable-anon-key>
SUPABASE_DB_URL=postgresql://...

AI_PROVIDER=gemini
GEMINI_MODEL=<configured-model>
DEMO_FALLBACK_ENABLED=true
```

Optional:

```bash
GEMINI_API_KEY=...
DEMO_RESET_SECRET=...
```

> Never commit database passwords, service-role keys, Gemini keys, reset secrets, or local environment files.

### 3. Database

Versioned migrations live in:

```text
supabase/migrations/
```

Useful local commands:

```bash
npm run db:start
npm run db:reset
npm run db:push
```

### 4. Verify the project

```bash
npm run typecheck:core
npm run test:core
npm run qa:contracts
npm run typecheck
npm run build
```

### 5. Run locally

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

---

## Production

Live application:

**https://skilltwin-production.up.railway.app**

Important production endpoints:

```text
GET /api/health
GET /api/readiness
```

`/api/health` is a cheap liveness + deployment identity endpoint.

`/api/readiness` verifies database/configuration readiness without exposing secret values.

---

## Release QA

The repository includes multiple release-quality checks.

### Architecture contract QA

```bash
npm run qa:contracts
```

Verifies critical architecture guarantees remain present in the implementation.

### Core tests

```bash
npm run test:core
```

Covers deterministic domain logic for the core SkillTwin loop.

### Database security QA

```bash
npm run qa:db
```

Checks RLS, server-owned write boundaries, private Storage and realtime configuration.

### Production smoke

```bash
EXPECTED_COMMIT_SHA=<git-sha> npm run smoke:release
```

The authenticated destructive path can verify:

```text
goal
→ evidence
→ SkillTwin
→ gap snapshot
→ Plan
→ task completion
→ Challenge Me
→ assessment evidence
→ SkillDelta
→ PlanDiff
→ updated roadmap
→ grounded Journey Chat
→ Agent Activity
```

### Visual QA

A Playwright workflow captures desktop/mobile production screenshots and checks:

- horizontal overflow
- runtime page errors
- console errors
- unnamed buttons
- missing image alt text

---

## Demo flow

For a judge/demo walkthrough:

1. Sign in or create a learner account.
2. Pick a target role.
3. Add a resume, project, or manual evidence.
4. Show the generated SkillTwin and gap analysis.
5. Open the adaptive roadmap.
6. Complete or inspect a learning task.
7. Start **Challenge Me**.
8. Complete the assessment.
9. Show the resulting **SkillDelta**.
10. Open **See What Changed** and inspect the PlanDiff.
11. Open **Progress** to show readiness/evidence movement.
12. Ask SkillTwin: **“Why did my roadmap change?”**
13. Open **Agent Activity** to show the audit trail.

For repeat demo rehearsals, the dedicated reset endpoint can clear only the signed-in learner state while preserving canonical seed data.

---

## Hackathon submission materials

- [Submission Pack](./docs/HACKATHON_SUBMISSION.md)
- [Final Demo Video Script](./docs/DEMO_VIDEO_SCRIPT.md)

These files contain the evaluator-facing form copy, agent link, demo sequence, and final pre-submit checklist.

---

## Known release limitations

- Text-based PDF resumes are supported for the demo path.
- Scanned-image resume OCR is detected but full OCR is not part of the current release.
- Semantic AI features degrade to deterministic fallback behavior when Gemini is unavailable.
- The product is a hackathon-grade release and should undergo another production-security/performance review before a long-lived public launch.

---

## Why SkillTwin

SkillTwin is not a chatbot wrapped around course recommendations.

It is an **agentic learning system with memory, evidence, state transitions, deterministic rules, validation, adaptive planning, and an auditable change history**.

The learner can always answer:

- **What does SkillTwin currently believe I know?**
- **What evidence supports that?**
- **What should I do next?**
- **Why did my plan change?**
- **Can I inspect or undo that change?**

---

<div align="center">

Built for the **Product Space AI Agent Hackathon 2026**.

**SkillTwin — learn, prove, adapt.**

</div>
