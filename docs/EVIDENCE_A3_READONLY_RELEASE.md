# Evidence A3 — Phase 1: Read-only verification preview

## Intended release boundary
A3 Phase 1 **does not** replace skill estimation, modify A1 readiness or historical gap records, activate assessment Scoring A2, write review records, or create a database migration.

This branch is deliberately separated from draft PR #64. It contains only:
- Versioned, SkillTwin-authored **draft** rubrics (Python, SQL, REST APIs, authentication, Git, Docker);
- A deterministic criterion-level estimator separating a claim, conceptual quiz answer, contradiction and independently observed practical task;
- An allowlist of 13 hand-reviewed seeded MCQ IDs, concepts and bank versions. Quiz answers are **knowledge checks**, never validated hands-on implementation;
- A **server-only flag-gated** `GET /api/gaps/verification` for the signed-in learner's current saved role-gap snapshot, plus `/skills/verification` and a conditional Skills link;
- Existing `public.skill_assessments`, `skill_assessment_questions`, `skill_assessment_attempts`, `assessment_question_bank`, `skill_evidence` and gap tables **read-only**. No dependency on `competency_reviewers` or `competency_practical_reviews`;
- Strict user-ID-scoped Postgres joins, exact bank prompt/options/answer-key comparison, evaluator version check, bounded latest assessment attempts;
- Synthetic unit regressions and developer-authored acceptance fixtures comparing A1's numerical STRONG label to A3's verification state.

The new endpoint and page return **404 while `SKILLTWIN_EVIDENCE_A3_ENABLED` is unset**. Production should keep this environment variable absent/false until real staging QA finishes.

## What the preliminary benchmark can and cannot prove

`tests/evidence-a3-baseline-benchmark.test.mjs` declares 11 product-risk scenarios before invoking either engine. Ten deliberately lack complete independent demonstrations; one contains per-criterion independently reviewed practice. The expected behavior is that A1 may still call their numerical score STRONG, while A3 separates verification completeness.

These fixtures are synthetic and labeled by our own engineering rules, NOT blind industry-expert judgments or randomly sampled learner performance. Their checks are **implementation regression tests**, not estimates of real-world sensitivity, specificity, fairness, or employment readiness. Report them as deterministic safety scenarios only.

## Prerequisites to enable the preview in staging

1. Reconnect the Supabase connector with access to isolated SkillTwin-Staging project `wkbxwcspgzvvhbjhtxan`. At last check the active connector was **not authorized**, and only production project `eozvilqmrhtujqtdmrri` was visible.
2. Inspect migrations and restore all core role, assessment and catalog structures without copying production user data. The Phase 1 read-only preview requires **no new A3 migration**.
3. Start the Next.js application locally against staging-only connection values, and use two disposable learners. One needs a goal, saved gap snapshot, and completed seeded assessment with a reviewed question.
4. Verify with flag OFF (404), flag ON (anonymous 401, authenticated 200, correct learner isolation). Confirm the A1 /api/gaps result is byte-for-byte unchanged after the read-only request. Validate that preview evidence matches the real user-owned assessment/question version.
5. Re-run CI and branch-diff review; merge only after the authenticated staging gate succeeds.

## Explicit exclusions

The separate PR #64 retains the experimental human reviewer write API, migration `0029_a3_practical_review_attestations.sql`, and reviewer attestations; **none of those are in Phase 1**. This pilot does not run arbitrary project code, verify code authorship, or promise expert-calibrated skill estimates.

## Subsequent validity study

Recruit at least two independent subject-matter experts for each pilot skill to assess anonymized concrete work samples, reviewed artifacts, passed/failed practical challenges and contradicted claims. Pre-register critical criteria; label samples while blinded to A1/A3 scores. Measure agreement, unsupported STRONG proportion, accepted proof precision, unverified coverage, and errors by skill. Investigate reviewer disagreement before replacing A1 proficiency or prioritization.

**Release gate:** neither a green CI build nor a pass on developer-created cases proves improved real-world scoring accuracy.
