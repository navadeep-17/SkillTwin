# Challenge My Twin — Hackathon Signature Feature Implementation

## Product hypothesis

**Don't just follow your AI. Challenge it.** SkillTwin makes evidence-backed, explicitly uncertain estimates. A learner can inspect what is known, disagree with the estimate, and take a real skill-specific validation assessment. SkillTwin changes capability and confidence only through the already-existing Evidence Engine; it considers downstream adaptive replanning and explains a legitimate NO_OP. This experience is more concrete than another AI course recommender, but its individual components are not claimed to be commercially unique.

## Release architecture and contracts

```
Authenticated /challenge-my-twin (read-only learner state; Supabase RLS)
     ↳ estimate / evidence / recent proof
     ↳ learner selects an opinion (client-only; NOT a score input)
     ↳ approved question bank count >=4 or existing ACTIVE assessment
     ↳ POST /api/assessments { targetSkillId, mode: CHALLENGE_ME }
          ↳ server-side skill ID + validated question-bank checks, user auth
     ↳ /practice/:id existing evaluator → summary evidence → SkillDelta
          ↳ gap recompute and adaptive replanning, including NO_OP
     ↳ /challenge-my-twin?skillId=... for recorded outcome, before/after, PlanDiff
```

This feature does not create a new estimator or data model. All source rows are constrained to the authenticated user, except canonical taxonomy and read-only bank item counts (no questions, answer keys or rubric returned). The server restricts data queries to reasonable limits. Evidence shown is the learner's own stored content. The challenge's directional opinion is intentionally ephemeral and **is not used for grading**.

## Prioritized phases

1. **P0 — Read-only challengeable evidence:** show recorded skill estimate, confidence as a separate property, recent evidence sources, resolved or unresolved evidence conflicts. Unknown ≠ zero.
2. **P0 — Real targeted validation:** choose the existing server-owned assessment flow by canonical skill UUID. Show unavailable when fewer than four validated questions exist. Resume a current ACTIVE assessment rather than starting duplicates where visible.
3. **P0 — Explainable response:** retrieve latest completed result by skill, join to skill history and replanning records by the exact assessment reference; show the real before/after, or explicitly say there is no recorded material change. Never infer a roadmap change from elapsed time or display an unapplied PlanDiff as committed.
4. **P0 — Integration & release:** route guard, nav, Skills and Practice CTAs, completed-challenge return link. TypeScript, domain tests, production build, anonymous-access test, Railway pinned commit and readiness.
5. **P0 — Authenticated browser walkthrough:** with a dedicated test learner, select assessable Python/SQL/HTTP, inspect baseline, complete every real question, then inspect outcome, skill history and replan decision. Repeat refresh, resume and previously completed assessment; verify no cross-user evidence leakage.
6. **P1 — Polish:** responsive visual check, focus navigation, error states, loading animation, screen-reader affordances and mobile taps.
7. **P1 — Judge presentation:** 3-minute honest demonstration and 1-minute fallback video with actual persisted results (never fake outcomes).

## Acceptance criteria

- A logged-in learner can select a skill and say the estimate seems too low / too high / unknown
- That assertion alone cannot alter the skill estimate, assessment rubric or roadmap
- For skills with fewer than 4 validated questions, the UI refuses to claim a proof assessment is available
- Targeted assessment launch preserves the existing server-owned authorization and question validation
- Existing ACTIVE assessment for a skill is resumable
- New evidence is presented with its source and the assessment-linked skill-history before/after
- Applied PlanDiff is displayed only if linked to the specific assessment; NO_OP shows the recorded reason; other cases are explicitly NOT_RECORDED
- No database migration, PII export, credential change, or synthetic assessment outcome
- Tests and CI are green; Railway deployed SHA matches main
- Authenticated manual walkthrough is **reported pending** until actually performed

## Risks and mitigation

- **Question coverage:** The current validated bank supports about 12 of 53 skills. Don't promise proof for the others; expand reviewed bank only after core flow is proven.
- **False confidence:** Avoid claiming proficiency certification, employment readiness or verified credentials.
- **Missing material change:** A real completed assessment can legitimately result in unchanged skill or plan; show that honestly.
- **Network retries:** PR #28 hardened committed-answer replay; use it unchanged.
- **Query limits:** The last 100 outcomes/history/decisions are enough for pilot demos; older results may not display in the signature view. An older missing match must never become a guessed change.
- **Production and privacy:** New pages use getUser and scoped RLS reads; never reset real learner data to stage a demo.

## Tonight's judge demo sequence

1. Open /challenge-my-twin and select an eligible skill whose current evidence is ambiguous or incomplete.
2. Explain the estimate separately from confidence; reveal one piece of self-report/resume evidence.
3. Say: “I think this Twin is underestimating me.” Launch the targeted assessment.
4. Complete the actual, rubric-graded challenge; show the stored result.
5. Follow “See how my Twin responded” to show exact before/after and the matched roadmap decision.
6. If NO_OP, describe how the Twin rejected an unnecessary change. If APPLIED, show the actual PlanDiff. Do not promise either outcome before the test.
7. Open the private Evidence Passport for the persistent audit trail.

## Future product hypothesis (not implemented)

A fully governed dispute ledger with signed challenge requests, independent evaluation appeals, temporal proof expiry, artifact validation and cross-career transferability may be differentiating at enterprise scale. None of these is required to make a transparent, credible hackathon demo tonight.
