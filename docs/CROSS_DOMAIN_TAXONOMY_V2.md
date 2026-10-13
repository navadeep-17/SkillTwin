# Cross-Domain Canonical Skill Taxonomy v2 — implementation & release

## Product boundary

This release expands the **canonical skill vocabulary**, not the set of trusted role models or learning outcomes. The 36 original canonical skill IDs, names, slugs and taxonomy versions remain frozen. Seventeen new cross-domain entries increase the catalog to **53**. The additions are defined in `data/occupation-mappings/cross-domain-skill-additions-v2.json` and inserted by `supabase/migrations/0024_cross_domain_taxonomy_v2.sql`.

The 17 labels (e.g. Active Listening, Critical Thinking, Speaking, Reading Comprehension, Monitoring, Writing, Active Learning, Social Perceptiveness, Coordination, Service Orientation, Judgment and Decision Making, Complex Problem Solving, Learning Strategies, Instructing, Time Management, Mathematics, Persuasion) occur in the curated O*NET OnLine occupational snapshot. **SkillTwin authors the definitions** and has not validated these as occupation-level assessment standards.

## Architecture and rollout contract

- The database adds only `public.skills` rows (`taxonomy_version=2`), via a guarded, idempotent transaction using stable slugs and PostgreSQL-generated IDs.
- It does **not** insert `skill_aliases`: ordinary words such as "speaking", "writing" and "monitoring" are risky to match automatically in resumes.
- It does **not** insert or update `user_skills`, `skill_evidence`, `skill_history`, `career_goals`, `role_skill_requirements`, assessment content, or plans.
- Current learner abilities remain unchanged. Merely adding a catalog item cannot imply measured proficiency or skill readiness.
- The original `canonical-skill-snapshot-v1.json` and `review-decisions-v1.json` remain intact for provenance.
- The new `canonical-skill-snapshot-v2.json` and `review-decisions-v2.json` are separate, versioned sources. The mapping workbench switches to v2. **The v2 review ledger starts with zero approvals.**
- Name matches can now produce candidate suggestions (including exact-name candidates), but none are approved until reviewers use the PR-backed process. All nine external O*NET occupations remain EXPLORATORY.
- No role-model version, target-score or assessment rubric is created for an O*NET occupation in this release.

## Implementation

1. Add 17 precise SkillTwin-authored definitions by stable slug, each tagged `NOT_REVIEWED` and `UNASSESSED` in the additions artifact.
2. Add an additive SQL migration with preflight validation of existing entries, `ON CONFLICT(slug) DO NOTHING` for safe reruns, and a postcondition check; do not hardcode generated skill IDs.
3. Version the canonical snapshot from 36 to 53 and initialize the separate v2 review ledger.
4. Update the mapping UI, CLI and crosswalk export to v2; preserve the old version.
5. Test additive preservation, sourcing of labels, source/catalog version match, no auto-approval, and migration scope.
6. Pass CI then merge to `main`. Apply the recorded migration to Supabase and deploy the exact tested `main` commit to Railway. Observe health/readiness and compare counts.
7. If any migration or post-release check fails, stop; do not partially rebuild learner evidence or apply a destructive rollback.

## Release verification

Before applying SQL, record **aggregate** counts of `skills`, `user_skills`, `skill_evidence`, and `role_skill_requirements`. No personal data is required. After migration:
- exactly 17 new canonical slugs from the additions file, all active with `taxonomy_version=2`
- original 36 slugs still present with unchanged metadata and IDs
- no increase in user skill/evidence rows or role requirements caused by migration
- mapping manifest v2 still unapproved
- RLS remains enabled for public.skills
- `/occupations/mappings` renders the 53-item taxonomy context; it must not display any readiness score
- Railway reports the new SHA and production health succeeds

## Future work after this release

- Human review of 17 source-to-canonical equivalence candidates; reviewers must inspect meaning, not rely on exact text alone.
- Curated subskill design for regulated professions and India-specific occupational qualifications.
- Item banks and practical assessment validation before assigning capability scores to these new skills.
- Reviewed role model versions before any new career contributes to learner gap or roadmap calculations.

## Source & attribution

O*NET OnLine occupational skill names are taken from the frozen 2026 selection at `data/occupations/onet-online-curated-2026-10-13-v1.json`. O*NET OnLine is produced by USDOL/ETA, licensed under CC BY 4.0 (https://www.onetonline.org/help/license). SkillTwin selected skill labels, supplied its own competency definitions, and is not endorsed or assessed by USDOL/ETA.
