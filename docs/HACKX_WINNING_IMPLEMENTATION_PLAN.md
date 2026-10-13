# SkillTwin — HACK-X Winning Demo Implementation Plan
Date: 2026-10-13
Status: First real assessment-to-SkillDelta-to-NO_OP audit trail verified in production on 2026-10-13; polished proof reveal in review. Never confuse test fixtures or seeded examples with actual assessed learner evidence.

## North-star acceptance criterion
A signed-in learner completes a genuine targeted assessment and can see (1) the persisted assessment outcome, (2) evidence-linked before/after capability and confidence, (3) recomputed role gap/readiness, and (4) an assessment-linked APPLIED PlanDiff **or** an explicitly justified NO_OP decision. The judge demo must link these facts by the **same assessment ID**, not coincidence or recency.

## Release discipline
- Preserve Postgres/Supabase as the source of truth; do not write capability directly.
- Assessment answer keys/rubrics stay server-only under migration 0025.
- No fabricated assessments, ratings, proof results, user personas, or applied PlanDiffs.
- All code goes through feature branch -> tests/CI -> review -> merge -> pinned Railway build -> independent health + authenticated QA. Keep existing production learners' records.
- If an acceptance gate fails, fix it before developing additional showcase features.

## P0 — Repair and prove the core learner cycle
1. [x] Fix /api/roadmap regression after assessment-bank permission lockdown (PR #33, commit e6165e2).
2. [x] Add CI guard against client reads of private question bank (PR #34).
3. [x] Added safe structured roadmap diagnostics and assessment creation error timings (PR #35, #36). Keep tokens, answers and résumé text out of logs.
4. [ ] Runtime profiling: diagnostic timers for /api/readiness and POST /api/assessments are deployed; collect post-deployment timings and troubleshoot any repeat latency spikes. Keep security checks fail-closed.
5. [ ] Complete the full browser checklist, including refresh/resume and logout/login. **Verified server-side:** 4 submitted answers, 1 completed assessment, 1 outcome, matched before/after skill history and assessment-linked justified NO_OP (2026-10-13).
6. [ ] Confirm foreign-user isolation, protected answer bank, idempotent answer replay, concurrency and real source ID linkage.
Exit gate: real same-assessment audit trail succeeds, with a reproducible screenshot/video and DB verification. No manually inserted fake outcomes.

## P1 — Judges' signature journey
1. [ ] Improve Challenge My Twin: evidence/confidence are legible before answering; one clear proof CTA, graceful unsupported-skill state.
2. [ ] Present precise before/after skill estimates and plan changes with confidence labels; a redesigned proof reveal is in PR review, with an honest NO_OP and matching assessment reference.
3. [ ] Verify Project Defense: safe public GitHub URL, pinned commit/file links, three engineering questions and provisional (not credentialing) feedback; inspect failure and rate-limit states.
4. [ ] Polish transitions, empty/loading/error/responsive states; accessible and reduced-motion friendly.
Exit gate: demo operator reaches proof/result in minimal clicks on desktop and phone.

## P1 — Presentation and fallback
1. [ ] Prepare five-minute talk: learner problem -> skill estimate -> challenge -> measured result -> roadmap response -> code-grounded defense -> sustainable startup.
2. [ ] Record a fallback walkthrough of **real** test data, never synthetic outcomes represented as actual.
3. [ ] Rehearse twice from a clean test account. Time the full demo and run it with temporary Gemini unavailability to validate fallback honesty.
Exit gate: judges can distinguish production, validated capabilities, provisional feedback and roadmap future work.

## P2 — Beyond hackathon
- More validated assessments and reviewed careers; occupational mapping approval; repository contribution attribution; ongoing calibration, monitoring, rate limits, and stronger test coverage.
- Do not substitute broad catalog counts or hypothetical ROI for demo correctness.

## Current known blockers / risks
- Updated production audit (2026-10-13): 1 completed assessment, 1 persisted outcome, 1 assessment-linked skill-history change, 1 assessment-linked NO_OP decision, 0 applied PlanDiff records. Correct NO_OP is a valid endpoint, not a missing applied diff.
- Railway observed three /api/roadmap 500 responses before PR #33; runtime confirmation after deployment still required.
- Several client-aborted /api/readiness calls and an 88-second /api/assessments request: investigate latency before naming a root cause.
- Signed-in user browser interaction remains an explicit manual acceptance gate; do not mark green from CI alone.
