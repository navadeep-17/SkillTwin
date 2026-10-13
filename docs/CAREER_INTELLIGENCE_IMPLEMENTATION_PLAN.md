# SkillTwin Career Intelligence Expansion — Implementation Plan (2026-10-13)

This plan continues the Startup Implementation Plan. The architecture remains learner-owned and evidence-backed. No generated career content is presented as credentialing or an employment prediction.

## Current baseline, verified before this phase

Production already has the private evidence Passport and a search/filter career explorer. Its seeded catalog currently contains **five active roles across four families**: Backend Engineer and Frontend Engineer (Software Engineering); Data Analyst (Data & Analytics); ML Engineer (Machine Learning); Product Manager (Product). Learner-specific AI-generated roles may exist but must never be exposed to other accounts.

Canonical competency IDs, versioned role requirements and learner skill state are already stored in Supabase. There is no independently verified profession-wide suitability or job-readiness measurement.

## Stage 1 — Cross-career transferability comparison (P0; this PR)

**Goal:** A signed-in learner compares any two available career models before deciding to switch. Make the overlap visible without making a speculative recommendation.

**Implementation:**
- Deterministic role set comparison by canonical skill ID (never display-name fuzzy matching)
- Shared and role-specific requirements; deduplicate repeated canonical skills
- Preserve ANY_OF and ALL_OF requirement-group semantics
- Clearly distinguish a learner's recorded profile skill from assessed or proven proficiency
- No automatic changes to career goals, profiles, plans, or assessments
- Embed in existing authenticated /discover flow; mobile-first layout
- Pure domain tests: empty catalog, duplicates, shared/unique, alternative pathways, unknown evidence
- No DB migration, no new credentials, no new service

**Acceptance:**
- Comparisons are deterministic and contain no readiness or career-fit score
- When no level is recorded, UI says unknown/unrecorded, not 0
- Public catalog and learner-owned custom roles obey Supabase RLS
- Normal CI passes core tests, TypeScript, production build and anonymous route protections

## Stage 2 — Trusted occupation catalog intake (P1; new PR)

**Goal:** Expand beyond five seeded roles, across multiple disciplines, using explicit real sources. Treat imported occupations as exploratory until reviewed.

**Data schema proposal:** source_registry (ESCO/O*NET identifiers, dataset version, attribution, locale and retrieval date); imported_occupations (external ID, label, family, qualifications notes); imported_skill_links (source IDs, canonical mapping confidence/curation status); mapping_review (reviewer, approved/rejected rationale); versioned role provenance.

**Ingestion steps:**
1. Verify dataset version, official redistribution license/attribution, and useful occupation coverage.
2. Download versioned official snapshots into *controlled build assets*, not end-user profile storage.
3. Normalize external occupation and skill identifiers; map to SkillTwin skills with explicit unresolved labels.
4. Require review before promoting exploratory occupation links to assessed SkillTwin role requirements.
5. Add exact-source and dataset-freshness display in /discover; preserve existing role versions.
6. Check regional qualification/licensing limitations before exposing any strong guidance.

**Acceptance:** Three demonstrably different career families beyond current tech/product catalog have cited occupational descriptions, visible source labels, unknown mapping states, and no invented assessment or readiness score. All joins and import jobs are idempotent; RLS/security contracts preserved.

## Stage 3 — Career transition plan preview (P1)

After users explore/compare roles, show a *non-mutating* preview of skill areas needing validation and learning. Use existing role-model gap algorithm carefully rather than comparing counts. Explicit learner confirmation is required before creating a career goal and generating a roadmap.

**Acceptance:** Switching roles never archives the prior goal or plan until the learner saves; unknowns are marked validate-first; no transaction is triggered while browsing.

## Stage 4 — Evidence quality, assessment trust, outcomes (P1)

Add item provenance, benchmarked cross-family rubrics, confidence display and a transparent feedback/dispute path. Collect consented activation, meaningful learning activity, and comparable pre/post evaluations, not resume text or answers in analytics. Improve accessibility and mobile QA.

**Acceptance:** Independent evaluation fixtures, reproducible results, RLS and access-control tests, privacy review and measured user outcomes.

## Stage 5 — Commercial readiness (P2)

Only after repeat usage, user research and measured usage cost: test subscription offers and institutional procurement hypotheses. Defer billing, employer profiles, and public credentials until those requirements and security controls are validated.

## Release gates

- A protected branch/pull request first; inspect changed files
- CI core tests, contracts, typecheck and Next production build green
- Manual signed-in UX review in real browsers (desktop and mobile)
- No PII leakage from queries, logs or comparison UI
- Railway pinned to tested main SHA, health/readiness checked after rollout
- Roll back using last healthy deployment if regressions are observed

## Pitch language

**Demonstrable now (after release):** Compare canonical competencies across two current role models without changing your career goal.

**Only proposed:** Global career coverage through ESCO/O*NET, professional licensing knowledge, exact career matching, proven employer recognition, and commercial traction.
