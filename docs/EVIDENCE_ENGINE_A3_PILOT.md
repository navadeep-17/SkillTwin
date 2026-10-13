# Evidence Engine A3 — competency verification pilot

**Status:** Experimental, branch-only, read-only pilot. No production activation, database changes, new API, historical rescoring, or readiness rewrites.

## What the current A1 + A2 system does

- A1 aggregates source-adjusted skill-level signals with fixed baseline reliability weights and computes role gaps against versioned role targets.
- A2 adds difficulty-aware assessment scoring behind `SKILLTWIN_SCORING_A2_ENABLED`, disabled by default.
- Neither system demonstrates that a resume/project assertion satisfies every task-specific competency required at an advertised skill level.

Example: a self-authored project description with the verb "designed" can yield a level signal near 2.05. The A1 gap status can say STRONG for a role requiring 2.0, even if no code, test or review independently demonstrates intermediate REST API skills.

## Implemented pilot

- `lib/domain/competency-rubrics-a3.ts`: versioned, SkillTwin-authored **draft rubrics** for Python, SQL, REST APIs, authentication, Git, and Docker. Every rubric defines observable criteria across BEGINNER (tier 1), INTERMEDIATE (tier 2), ADVANCED (tier 3), and EXPERT (tier 4).
- `lib/domain/evidence-estimator-a3.ts`: evaluate an explicitly mapped criterion as UNOBSERVED, CLAIMED, DISPUTED_CLAIM, DEMONSTRATED, REVIEWED, NOT_DEMONSTRATED or CONFLICTED.
- `lib/domain/gap-verification-a3.ts`: preserves A1 readiness, priorities and original gap status; adds `NEEDS_VALIDATION` if A1 says STRONG but target competencies lack demonstrated evidence. Includes missing criteria, negative evidence and source IDs.
- `tests/evidence-a3-competency.test.mjs`: covers inflated claims, all required subcriteria, evaluated failures, independent contradictions, duplication, artifact provenance, and preserving A1 values.

### Design invariants

1. A resume skill mention, project description, self-report or bare GitHub link is only a **claim**, even if it says "expert". Source names alone confer no independent verification.
2. Only a *trusted server-graded criterion-level assessment or evaluated practice* produces DEMONSTRATED; only a *trusted independent artifact review* produces REVIEWED. Callers must enforce this trusted-producer boundary. **Do not expose an API that accepts `evaluationKind` from a learner.**
3. Assessment summaries are not proof of individual competencies; a producer must map each actually graded criterion separately. No natural-language substring or LLM-proposed skill level is treated as proof of competency.
4. Missing data remains unobserved, not a failure of ability. Actual negative evaluations are distinguished from absence; contradictory independent results become CONFLICTED instead of canceling in an average.
5. Multiple observations from the same underlying assessment/project and criterion are correlated and deduplicated. If the same group contains contradictory equal-assurance items, prefer conservative negative evidence, then require a new independent evaluation.
6. A target of 2.0 is demonstrated only when every criterion through tier 2 is supported by trusted evaluated observations. Partial/fractional targets round up to the next tier **for verification only**. This conservative pilot rule needs expert review and may be relaxed using explicit critical/noncritical criteria in later versions.
7. The A3 pilot outputs **criterion coverage**, not statistical confidence or calibrated likelihood of role readiness. Rubrics and thresholds are internally drafted and unvalidated.

### Gap interpretation

A1 result: `REST APIs current=2.05, target=2.00, status=STRONG`

A3 overlay with four prose claims:
`originalStatus=STRONG; displayStatus=NEEDS_VALIDATION; verificationStatus=CLAIMED_ONLY; demonstratedCoverage=0; recommendedAction=VALIDATE_FIRST`

A3 overlay with passed independently graded tasks for all beginner and intermediate REST API criteria:
`verificationStatus=SUPPORTED; demonstratedCoverage=1; displayStatus=STRONG`

A3 overlay with a server-graded failure on REST API authentication:
`verificationStatus=CONTRADICTED; failedCriteria=[rest-api.authentication]; displayStatus=NEEDS_VALIDATION`

An unmapped skill retains the original status with `RUBRIC_NOT_AVAILABLE`; the pilot **does not** falsely report it as validated.

### Limitations / release gates

- No automatic adapter currently maps existing stored assessment questions to the rubric criteria; the question bank's `concept_id` must be reviewed against each criterion, not guessed.
- No stored evidence is assumed to be checked merely because its `sourceType` string contains "VERIFIED". Independent validation records must be trusted and authenticated.
- The six rubrics are illustrative drafts. They need domain expert review and coverage/importance annotation before being authoritative.
- No staging or production API has been changed. No UI is modified. The overlay is **not yet automatically computed for users**.
- No empirical external benchmark or inter-rater reliability study has been run.
- The original A1 baseline numbers and role targets are unchanged; A2 remains separately flagged. This pilot does not integrate IRT.

## Run locally

```bash
npm install
npm run build:core
node --test tests/evidence-a3-competency.test.mjs
```

CI runs this on PRs.

## Next engineering steps

1. Review each rubric with skill experts and collect labelled examples of verified/contradictory performance.
2. Map supported bank question/concept IDs to rubric criteria with a **reviewed mapping manifest**, store provenance and evaluation version, and reject unmapped questions.
3. Implement trusted adapters reading per-question server-graded outcomes and independently reviewed artifact checks; ensure security boundaries and idempotency.
4. Add a server-only `SKILLTWIN_EVIDENCE_A3_ENABLED` gate for a read-only gap verification endpoint and UI explanation. Keep both original A1 gap and A3 verification data visible for audit.
5. Run comparison fixtures and authenticated staging QA, then review whether to activate. Only later consider replacing A1 capability or gap status formulas.

**No A3 production activation until these steps are satisfied.**
