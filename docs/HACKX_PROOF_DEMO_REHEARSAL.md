# HACK-X judge demo: verified Challenge My Twin flow (2026-10-13)

## Truthful demo contract

The central claim is *evidence-backed, challengeable AI*, not guaranteed score improvement or automatic plan changes. A learner may dispute an estimate, but only completed assessed evidence can change proficiency. A NO_OP can be correct.

### What this release hardens

The judge console at `/demo` previously displayed the latest completed assessment **next to** the latest replanning decision, even if they came from unrelated events. This could falsely show a completed challenge with another event's NO_OP or PlanDiff. Now it selects the latest assessment outcome, matches `replan_decisions.trigger_ref` to exactly its `assessment_id`, and only counts an **APPLIED** PlanDiff whose `trigger_refs` contains that exact assessment ID. It uses the same deterministic proof builder as Challenge My Twin. Legacy JSONB-encoded trigger arrays are decoded before exact matching. No fabricated changes or test records.

## Rehearsal procedure — dedicated test learner

1. Sign in to `https://skilltwin-production.up.railway.app` using a dedicated test learner account; do not share credentials in chat.
2. Open `/demo`, observe your account's current completion status. Ignore unrelated older activity: the replanning step will remain PENDING without a linked assessment outcome.
3. Open `/challenge-my-twin` and select an assessable skill such as Python/SQL. Review the current recorded skill estimate, confidence, and evidence; explain that self-report does not equal validated competence.
4. Choose a concern (*I am more capable / less capable / unsure*), then launch `Prove what I know`. This opinion does not affect grading.
5. Answer **every actual question**. If internet connectivity drops, open `/practice` and resume the saved ACTIVE assessment rather than creating a second one.
6. Complete the challenge, inspect real grading feedback, and follow `See how my Twin responded`. Confirm an outcome is persisted and the previous/next skill estimates display if evidence history was committed.
7. Inspect the roadmap consequence: APPLIED PlanDiff if one genuinely occurred, a stored NO_OP explanation if no safe change was justified, or NOT_RECORDED if still incomplete.
8. Refresh the page and revisit `/demo`; confirmed stages should persist and the reason must relate to that same completed assessment.
9. Confirm `/passport` shows current private learner evidence. No screenshots of private data should be published without consent.
10. Test a fresh Chrome session or mobile view and ensure anonymous visits to `/challenge-my-twin` and `/demo` redirect to login.

### Minimal read-only post-rehearsal database verification

Only aggregate counts (no learner identifiers or answers):

```sql
select
  (select count(*) from public.skill_assessments where status='COMPLETED') completed_assessments,
  (select count(*) from public.skill_assessment_outcomes) outcomes,
  (select count(*) from public.skill_history where trigger_type='ASSESSMENT_COMPLETED') history,
  (select count(*) from public.replan_decisions where trigger_type='ASSESSMENT_COMPLETED') assessment_decisions,
  (select count(*) from public.plan_diffs where status='APPLIED') applied_plan_diffs;
```

Successful demo acceptance requires a **real completed assessment and stored assessment outcome**, plus either an honestly recorded corresponding replanning decision or an explicit investigated reason no decision exists. An applied PlanDiff is not mandatory—forcing one would undermine the differentiator.

### If the rehearsal fails

- Start/target missing: verify bank coverage and server-owned SQL with diagnostic logs.
- Assessment disappears or repeats: inspect idempotent replay and NEXT question recovery; don't manually mark completed.
- No outcome after all questions: inspect `assessment-service.ts` `finalizeAssessment` and Railway application logs.
- No skill change: distinguish no eligible evidence delta from an evaluator failure; inspect evidence summary status.
- No PlanDiff: review matching NO_OP `trigger_ref`, reason code, and remaining future tasks.
- Readiness endpoint intermittently times out: independently verify Railway deployment `SUCCESS` and direct read-only security assertions, but do not equate startup health with full readiness.

**Status:** Code tests and CI are not a substitute for this authenticated browser test. As of latest read-only check before patch, production had **zero completed assessment outcomes**.
