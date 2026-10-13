# SkillTwin Startup Implementation Plan — HACK-X 2026

Status: execution plan, not a claim of delivered product or market validation.
Owners: Team Atreides. Initial implementation branch: `feature/hackx-career-evidence-passport`.

## 1. Product thesis

Build a universal, learner-controlled career intelligence system: Discover → Diagnose → Develop → Demonstrate → Adapt → Transition.

The current code already supports the strongest part of this journey: goal-based assessment, evidence-backed skill state, gap analysis, adaptive learning plans, versioned replanning, grounded chat, and activity history. Do not replace these systems.

The commercial model is a hypothesis: free onboarding and basic diagnostics; paid advanced progress tools for individuals; later institution-sponsored access. No pricing, learning efficacy, revenue, or customer growth is validated yet.

## 2. Non-negotiable product contracts

- Canonical skill state comes from the Evidence Engine; frontend never edits it.
- An unobserved skill is UNKNOWN, not a failure.
- Capability and confidence are separate values.
- Resume/self-report evidence is not presented as equivalent to a completed assessment.
- Readiness is a role-relative heuristic, **not** the probability of employment, a certification, or evidence of professional licensing.
- User data stays behind authentication and Supabase row-level security. No anonymous or publicly indexed evidence pages.
- AI proposes content and interpretations; deterministic application rules validate them.
- Current learning state, prior versions, evidence history, and user consent must survive retries and refreshes.
- Do not store resumes or assessment answers in generated links, URLs, analytics, or logs.

## 3. Execution waves

### Wave 0 — Baseline and release discipline (P0)

**Scope:** Inspect live code and deployments; verify baseline branch, production URL, schema, auth, tests, and rollback route. Work in a dedicated branch and PR.

**Exit gate:** `npm run typecheck:core`, `npm run test:core`, `npm run typecheck`, `npm run build`, and the architecture contract QA run successfully in CI; approved changes can be rolled back without losing learner history.

### Wave 1 — Private Career Evidence Passport (P0, first implementation)

**Problem:** Skill state exists across Overview, Skills, Progress, assessments and roadmap. Learners need a readable artifact summarizing what was observed and where uncertainty remains.

**In scope:**
1. Authenticated `/passport` route, read-only from canonical Supabase data.
2. Show the active role and frozen role model version, readiness and evidence coverage as *guidance*, plus record freshness.
3. Show capabilities and confidence independently, evidence source categories, and most recent assessment outcomes.
4. Show prioritized role gaps with next actions; distinguish unobserved and unresolved evidence.
5. Offer a private local Print / Save as PDF action, with a clear privacy warning.
6. Link to the Passport from main navigation and Progress.

**Out of scope:** Public URLs, recruiter verification badges, a signed credential, scraped job data, portfolio scraping, AI-written endorsements, certificates, comparative learner rankings, downloadable raw resume data.

**Acceptance:**
- Anonymous users redirect to login.
- All queries filter by authenticated user; gap snapshot is filtered to active goal.
- Empty state gracefully links to onboarding; no invented zeros for missing readiness/capability.
- Neither client code nor printed document reveals other learners' records.
- Report source type distinctions are legible and truthful.
- Existing app routes and API contracts remain unchanged.

### Wave 2 — Career Discovery (P1)

**Problem:** Learners with unclear goals cannot fully use a role-first planning flow.

**Design:** Split onboarding into `Explore roles` and `I know my target`. Display role families, competencies, alternatives, qualifications and source coverage. Avoid claiming exact occupational fit from resume text alone.

**Data contract:** Versioned source provenance for ESCO/O*NET mappings, source locale, freshness, occupation IDs, canonical skill mappings, qualification/licensing disclaimers. AI suggestions require schema validation and a learner confirmation before activating a goal.

**Exit:** Three different career families each have meaningful browse/compare and a relevant requirement graph. Unknown terms remain explicit and no unsupported readiness score is shown.

### Wave 3 — Trusted Assessment and Skill Passport (P1)

Improve item coverage and rubric reliability by career family, assessment provenance and confidence, repeatable benchmark fixtures, uncertainty messaging, dispute/correction workflow. Measure independent task outcomes against SkillTwin estimates.

**Exit:** Assessment explanations distinguish assessed knowledge, projects and self-report; documented evaluation set, error analysis, and failure handling.

### Wave 4 — Engagement and outcome measurement (P1)

Track consented activation, assessment initiation/completion, evidence-backed plan actions, weekly evidence-active learners, seven-day returns, and failure drop-offs. Avoid raw resume/answer logging. Add learner-controlled checkpoints only where they support actual behavior.

**Exit:** A small private beta produces measurable activation and return metrics without publishing personal results.

### Wave 5 — Commercial experiments (P2)

Conduct paid offer tests and institution pilot discussions before implementing billing. Proposed consumer subscription and institution licensing are hypotheses, not announced products. Model AI usage, paid-vs-free usage, infrastructure, support, VAT/GST/payment fees, CAC, and churn.

**Exit:** A credible purchase or pilot commitment, positive modeled contribution at measured usage, privacy/security design for any institution-facing aggregation.

### Wave 6 — Production-scale trust (continuous)

Automated authenticated browser E2E; RLS/isolation; input/upload protection; threat model; background-work reliability; concurrency and idempotency; rate limits; model outage tests; Sentry or equivalent observability with personal-data minimization; mobile accessibility; backup and rollback rehearsals. Publish a privacy policy and consent/deletion UX before broader pilots.

## 4. Release checklist

- [ ] Changes live only on feature branch during review
- [ ] Required GitHub CI checks green
- [ ] Route manually tested with empty account and populated demo account
- [ ] No cross-user reads or unauthenticated access
- [ ] No exposed secrets, public resume URLs, or fabricated skill verification
- [ ] Production deploy verified against expected commit
- [ ] Health/readiness endpoints checked
- [ ] One full profile → roadmap → assessment → replan path verified
- [ ] Rollback available

## 5. HACK-X narrative

**Today:** A functioning private, evidence-based learning loop and a learner-owned report.
**Not yet proven:** customer demand, long-term retention, assessment validity across every occupation, employer recognition, revenue.
**Next milestones:** pilot users, trusted assessments, occupational data integration, paying-customer experiments.

Do not present proposed functionality as already shipped. Do not substitute screenshots or scripted animations for verified outcomes.
