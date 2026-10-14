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

- A deliberately limited, manually reviewed mapping from selected seeded MCQ IDs to knowledge criteria is implemented. It does not map every assessment question, nor does it establish practical proficiency.
- No stored evidence is assumed to be checked merely because its `sourceType` string contains "VERIFIED". Independent validation records must be trusted and authenticated.
- The six rubrics are illustrative drafts. They need domain expert review and coverage/importance annotation before being authoritative.
- A new **flag-gated**, read-only API and Skills verification preview page are implemented on this feature branch. They are NOT live, and remain disabled by default; existing production APIs and UI are unchanged.
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
2. Expand the existing reviewed bank mapping only when a question truly checks a published criterion; re-review each mapping and pin question versions/provenance.
3. Extend the existing trusted read-only server-graded adapter with independent **practical** grading and authenticated artifact review; no learner-supplied verification flags.
4. Authenticated-test the already implemented server-only `SKILLTWIN_EVIDENCE_A3_ENABLED` preview endpoint/UI against isolated staging, including ON/OFF and cross-user isolation.
5. Run comparison fixtures and authenticated staging QA, then review whether to activate. Only later consider replacing A1 capability or gap status formulas.

**No A3 production activation until these steps are satisfied.**


## P2 update — real read-only assessment connection (14 October 2026)

The pilot now has an explicit path from historical **completed, user-scoped, server-graded** assessment attempts to rubric-based verification. This is an opt-in preview, not an A1/A2 estimator replacement.

### Reviewed question-to-criterion manifest

- \`lib/domain/assessment-question-mapping-a3.ts\` contains a hand-selected allowlist of question IDs, concept IDs and bank versions drawn from \`supabase/seed.sql\`, \`0015_core_mcq_coverage.sql\` and \`0022_additional_role_assessment_banks.sql\`.
- The pilot covers a subset of REST APIs, Python, SQL, authentication and Docker concept questions. Git remains rubric-only because a matching reviewed assessment bank item is not available in those sources.
- Unknown/changed questions are ignored. There is no substring guessing and no model-generated mapping.
- **All mapped MCQs are \`KNOWLEDGE_CHECK\` observations**, never practical demonstrations. A correct multiple-choice answer checks a specific fact; it cannot prove the learner built/tested a system.
- A wrong deterministic MCQ becomes \`KNOWLEDGE_GAP\`; it does **not** mean an independent practical implementation test failed.
- The allowlist intentionally omits concept questions that would exaggerate what their related rubric criterion demonstrates.

### Trusted grading boundary

- \`lib/domain/trusted-assessment-a3.ts\` accepts a user-scoped database row *only* if the completed assessment, evaluated attempt, bank question ID, concept, bank version/type/difficulty and trusted evaluator version agree.
- Numeric MCQ score must be exactly 0 or 1 and evaluator confidence at least 0.99; anything else is omitted from A3 rather than silently trusted.
- \`lib/services/gaps/evidence-verification-a3-service.ts\` queries the latest user-owned persisted A1 gap snapshot and a bounded 400 latest completed assessment attempts, joining on matching user IDs and bank question identity. No raw answer keys or submitted answer payloads are returned.
- Legacy \`skill_evidence\` rows are counted but **not auto-promoted** to rubric proof, because claims lack a reliable, reviewed criterion mapping.
- No schema changes or write queries are introduced.

### Server API and user-facing UI

- Feature flag: \`SKILLTWIN_EVIDENCE_A3_ENABLED=true\` set **on the server**. Default is OFF. Do not use NEXT_PUBLIC for this flag.
- \`GET /api/gaps/verification\`: authenticated, read-only response with \`preview\` containing the original A1 readiness, A3 verification statuses, missing criterion descriptions, knowledge indicators and provenance evidence IDs.
- \`/skills/verification\`: server-rendered research preview with the A1 readiness clearly labelled, observed conceptual quiz knowledge and unmet hands-on criteria.
- \`/skills\`: adds a link to the preview only when the server flag is true.
- No active gap snapshot: response has \`preview:null\`, page shows onboarding guidance.
- There are no changes to learning-plan persistence, assessment results, role weights, source baselines or production scores.

### QA and acceptance boundaries

- \`tests/evidence-a3-real-assessment.test.mjs\` verifies reviewed question identity against committed SQL fixtures, eligible grading evidence, untrusted-version rejection, concept-scope safety and A1/preview comparison.
- The existing A3 synthetic suite still tests claimed-only projects, proof completeness and independent contradictions.
- Unit/CI tests do **not** prove the live Postgres credentials or full authenticated browser journey; that still requires the separate SkillTwin-Staging environment with a test login and fully reviewed schema compatibility.
- The rubric descriptions and all criteria are internally drafted. They are not scientifically calibrated, externally certified or ready to independently assert hiring ability.

### Known remaining work

1. Independently review the rubric criteria and importance with subject experts.
2. Add actual, task-specific code/practical grading and independently authenticated artifact review, retaining explicit evaluation version/provenance. MCQs alone cannot complete the practical tiers.
3. Collect an expert-labelled benchmark of project claims, graded tasks and contradictory evidence to measure agreement, false-positive rate, unknown handling and coverage.
4. Enable the A3 preview only in isolated staging, verify user/tenant isolation, rollback and no database writes, and separately decide on rollout to production.

**No automatic promotion of A3 to the authoritative scoring model is justified yet.**
