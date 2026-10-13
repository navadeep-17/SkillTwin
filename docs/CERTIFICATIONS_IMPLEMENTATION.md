# Certifications — reviewed catalog + personalized recommendations (MVP)

Status: implemented in feature PR; **not merged, deployed or browser-validated yet**.
Date of issuer page review: 2026-10-13.

## Purpose
Help each learner select a credible credential **only when it is relevant to the user's chosen career and mapped gaps**. Do not treat all badges as equally credible, claim a paid exam is hosted by SkillTwin, or infer pass probability from incomplete skill data.

## MVP (P0) implemented
1. Dedicated authenticated `/certifications` page and sidebar navigation.
2. Curated 10-item catalog across Cloud, Developer Tools, Cybersecurity, Networking and Data. Each entry includes issuer, official page, credential type, level, topic summary, mapped canonical skill slugs, role keywords, prerequisite skills, and date reviewed.
3. Two views: For you (only goal-/gap-supported suggestions), Browse all (entire catalog). Search, career-track filtering and focused credential detail panel.
4. Signed-in `GET /api/certifications` returning **read-only owner-scoped** evidence-based recommendations. Reuses active `career_goals`, newest per-goal `gap_snapshots`, actionable `skill_gap_results`, and `user_skills`. No new schema or scoring write paths.
5. Deterministic ranking: first match category ROLE_AND_GAP > GOAL_MATCH > GAP_MATCH > EXPLORE; within a category, use role keyword match and mapped high-priority gaps, with associate-level missing-prerequisite penalty. **The score is a private sorting heuristic, never employer value or exam-pass probability.**
6. Preparation guidance is evidence-qualified. Missing prerequisites -> foundation-first. Any relevant skill evidence -> inspect official syllabus. No evidence -> unknown readiness, not zero ability.
7. Official issuer external links only. Do not display stale costs, local vouchers, instructor promises, exam availability or arbitrary verification badges.

## Catalog limitations
- **Mappings are approximations**, since SkillTwin's current canonical skills include `cloud`, `git`, `python`, `sql`, etc., but not vendor-specific IAM, VPC, DAX, PySpark or Cisco routing expertise. The UI explicitly discloses this.
- Certification issuer and track do not prove hiring impact; the recommendation is educational career alignment.
- Catalog freshness must be periodically reviewed. Changes to exams, names, availability, prices, training terms and regional discounts must be updated against official issuer pages.
- No issued credential or learner certification history is automatically inferred from a résumé, project, or task. Certification verification must later have `SELF_REPORTED`, `EVIDENCE_SUBMITTED`, `ISSUER_VERIFIED` state, with actual issuer verification for the final state.
- Certifications do not automatically grant skill proficiency, certification ownership, readiness improvement or job eligibility.

## Phase C (next, approval-gated)
- Design a `user_certification_goals` table with RLS, explicit statuses (SAVED, PREPARING, EXAM_SCHEDULED, EARNED_SELF_REPORTED) and a single issuer URL identifier; do not invent external exam sessions.
- Add issuer-based syllabus/resources to the Resource Matcher, with legitimate dates and prerequisites.
- Agent can use `get_certification_recommendations` as an allowlisted read tool. `SAVE_CERTIFICATION_GOAL` and `ADD_CERTIFICATION_PREP` are mutations, requiring explicit user confirmation, fresh state validation, and agent audit.
- Add milestones to the active roadmap **only on user approval**, preserving its own versioned PlanDiff history.

## Phase D (credential evidence)
- Save issuer credential ID/link, awarded/expiry dates and provenance; never accept an unverified URL as an issuer-verified credential.
- Support manual evidence review where issuer API validation is unavailable.
- Use credentials as evidence with limited contribution and confidence calibrated by independent proof. No automatic mastery of all mapped skills.
- Renewals, regional pricing, filtering by budget, and exam fee discounts must use current issuer facts, with timestamps.

## QA
- Unit tests validate distinct official links, a truthful empty-evidence experience, role+gap matches, prerequisite guidance, unsatisfied gap exclusion, deterministic ranking and owner-scoped reads.
- CI must pass core TypeScript, full Next build and anonymous route smoke. Add `GET /api/certifications` to anonymous API checks.
- An authenticated browser walkthrough must verify mobile/desktop, missing active goal, sparse skills, stale/no gap snapshot and official links before production deployment.
- Do **not** mix this feature with existing Railway image-build failures or the separate Orbit design PR.
