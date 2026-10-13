# Reviewed Career Model Builder — implementation and review policy

## Purpose and current status

This is a **draft-only** occupation-model preparation system, not a new assessed SkillTwin career catalog. It consumes:
- `data/occupations/onet-online-curated-2026-10-13-v1.json` (9 O*NET US occupation profiles)
- `data/occupation-mappings/canonical-skill-snapshot-v2.json` (53 SkillTwin canonical skills)
- `data/occupation-mappings/review-decisions-v2.json` (source skill equivalence decisions)
- `data/occupation-models/draft-models-v1.json` (one draft scaffold per imported occupation)

As of this implementation the mapping ledger has **zero approvals**. Each of the nine draft scaffolds consequently has **zero configured requirements**. This is accurate and not an error: nothing should be promoted until genuine source equivalences are reviewed.

The review status UI lives at `/occupations/models` (authenticated, read only), reachable from the Occupation Atlas and mapping queue. It displays approved mapping counts, authored requirement counts, official occupation references, and explicit blockers. It never shows career-fit, readiness, employment likelihood, verified qualifications, or certificates.

## Implementation contract

A human-approved source-to-canonical mapping is **necessary but insufficient** for a role requirement. Every proposed role-specific requirement must separately specify:
- exact official O*NET source skill key (including ESSENTIAL or TRANSFERABLE group)
- actual reviewed canonical skill slug, matching an approved source mapping
- target capability on SkillTwin's 0–4 scale, entered by reviewer; **not derived from O*NET importance**
- normalized requirement importance (0.1–1), importance band (CORE/IMPORTANT/SUPPORTING), learning stage (1–4)
- evidence-based rationale of at least 30 characters, reviewer GitHub handle and UTC review timestamp

No alternative requirement groups are inferred from O*NET: drafts are restricted to SINGLE until independently reviewed. All occupational profiles stay US-context EXPLORATORY. Minimum four configured requirements can qualify a draft for **another review**, but never automatic activation. Independent assessment coverage, local licensing and qualification review, and explicit publication approval are always outstanding blockers here.

No database migration, no writes to `role_versions`, `role_skill_requirements`, `career_goals`, `user_skills`, `skill_evidence`, assessments, or learning plans. No privilege-bearing web endpoint. This module intentionally cannot call the role activation API.

## Maintainer procedure

Install dependencies and compile the deterministic domain module:
```bash
npm install
npm run build:core
node scripts/reviewed-career-models.mjs status
```

1. Examine /occupations/mappings and O*NET original sources. Independently review mappings via the existing `scripts/occupation-mapping-review.mjs` flow, have another maintainer review the GitHub PR, and merge it. **Never fabricate a reviewer identity or an approval merely to unlock a feature.**
2. On a new branch containing the genuinely approved mapping manifest, create candidate rows for an occupation:
```bash
node scripts/reviewed-career-models.mjs scaffold --occupation "onet:29-1141.00"
```
If zero approved mappings exist, this command makes **no changes**.
3. Only after evaluating occupation-appropriate expertise and scoring expectations, configure each scaffolded requirement (illustrative syntax; the values are NOT defaults or recommendations):
```bash
node scripts/reviewed-career-models.mjs configure \
  --occupation "onet:29-1141.00" \
  --key "ESSENTIAL::active listening" \
  --target 2 \
  --importance 0.75 \
  --band IMPORTANT \
  --stage 2 \
  --reviewer "@reviewer-handle" \
  --rationale "Documented rationale based on independently reviewed professional proficiency expectations."
```
4. Submit the JSON change in a GitHub PR for separate qualified review. A handle written into a JSON field does not by itself prove identity or expertise; rely on authenticated PR review, source assessment, and documented approval.
5. Run `npm run test:core && node --test tests/reviewed-career-model.test.mjs && node scripts/reviewed-career-models.mjs status && npm run build`. Compare the UI and manifest to the linked official O*NET occupation before merging.

The CLI does not overwrite existing reviewer-configured requirements; corrections require a documented supersession PR. Source and catalog version mismatches fail closed. Git commit history preserves the original, amended, and reviewed states.

## Release and future promotion gates

The model draft builder is safe for production only after CI and authenticated UI smoke checks. New model **activation** is explicitly out of scope and must be implemented separately with governance and database authorization, after:
- evidence-backed source-to-canonical mapping approval
- occupation-level expert validation of proficiency targets, importance and alternatives
- verified practice and assessment content covering the drafted competencies
- regional qualification/licensing checks for regulated professions
- versioned source attribution and human approval of a complete occupational model
- RLS, idempotency, rollback, and data integrity testing for any active model import

Do not interpret the number of draft requirements as readiness or proof of skill competence. Do not treat general O*NET skill labels as sufficient standards for healthcare, legal, education, or other regulated careers.

## Attribution

Selected occupational descriptions/skill labels are from O*NET OnLine, USDOL/ETA, https://www.onetonline.org/help/license, CC BY 4.0. SkillTwin's proposed requirements and interpretations are independent, unendorsed modifications and are not approved or tested by USDOL/ETA.
