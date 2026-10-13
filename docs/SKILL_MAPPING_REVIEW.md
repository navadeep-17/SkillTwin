# SkillTwin O*NET → Canonical Skill Mapping Review

**Current stage:** Git-reviewed mapping crosswalk, not automatic occupation model promotion.

The selected O*NET 2026 occupational snapshot contains nine occupations with seven Essential and five Transferable skill entries each. Duplicate source labels are reviewed **once per source-group and normalized label**, but retain every occupation of occurrence and official O*NET URL.

SkillTwin's original canonical catalog (v1) included **36 active skills**. Taxonomy v2 adds 17 cross-domain definitions for **53 skills**; see `docs/CROSS_DOMAIN_TAXONOMY_V2.md`. The v1 snapshot and decisions are retained for audit, while current review actions use `canonical-skill-snapshot-v2.json` and `review-decisions-v2.json`. The new ledger starts with zero approved mappings. Static snapshots prevent silent drift when source or canonical skills change.

## Process

1. Check out this repository and run `npm install && npm run build:core`.
2. Run `node scripts/occupation-mapping-review.mjs list` to see pending O*NET skill concepts and lexical suggestions.
3. Before approving an equivalence, inspect the official O*NET descriptions and the canonical SkillTwin skill definition. A lexical match is **not** reliable semantic evidence. Do not approve based on keyword overlap alone.
4. Choose one of `APPROVED`, `REJECTED`, `NEEDS_NEW_SKILL`. An approval requires a real current canonical **slug** and documented rationale. If no equivalent canonical competency exists, select `NEEDS_NEW_SKILL`, which *does not* create a new canonical skill.
5. Example for an actual reviewer (replace the sample handle with your own and inspect the source first):

```bash
node scripts/occupation-mapping-review.mjs decide --key "ESSENTIAL::active listening" --decision NEEDS_NEW_SKILL --reviewer "@your-github-handle" --reason "No equivalently defined communication competency is present in the current canonical SkillTwin catalog; new skill ontology review is required."
```

6. The CLI edits `data/occupation-mappings/review-decisions-v1.json` locally, not the database. Submit a GitHub pull request; a **separate maintainer** must review the source meaning, reviewer identity, rationale, mapping choice and PR diff before merge.
7. CI validates referential integrity, source version, canonical IDs, rationale length, decision state and anonymous route protection. A GitHub handle typed in JSON is **not automatically identity verification**; the actual review is the authenticated GitHub PR approval.
8. To export approved mapping IDs for a **future, separately reviewed** intake pipeline, run:

```bash
npm run build:core
node scripts/export-reviewed-occupation-crosswalk.mjs > reviewed-crosswalk.json
```

The export is a machine-readable reference only; importing these links into role requirements requires a further explicit review of source locality, qualifications, role-model versioning, target proficiency, and assessment validity.

## Audit / reversals

The human review ledger is versioned in Git, making every edit attributable to a PR and commit. The CLI refuses an existing decision rather than silently overwriting it. Corrections or supersessions require a separate documented PR showing why a decision is replaced, its prior commit, a new reviewer rationale and whether any consumer of the previous approved crosswalk needs updating.

## Data integrity

- Source identity: `sourceSnapshotId` from O*NET OnLine dated snapshot
- Canonical identity: `canonicalSnapshotId` and stable SkillTwin skill slug
- Review key: `ESSENTIAL::normalized source label` or `TRANSFERABLE::normalized source label`
- Provenance: original official occupation profile URLs and occupational importance values
- Decisions: reviewer, ISO UTC timestamp, at least 20-character rationale, one of the three explicit outcomes
- No personal learning records, resumes, or user evidence are involved

## What is not provided

This first release intentionally does **not** provide an online admin-write endpoint, automatic occupation-to-role conversion, new canonical skill creation, qualification/licensing judgments, employer-recognized credentials, or learning-plan generation for exploratory O*NET occupations.

Why: SkillTwin's existing canonical taxonomy is concentrated in software and product disciplines. An O*NET concept such as *Active Listening* should not be forced onto *User Research* merely because they overlap in language. We must extend the reviewed taxonomy where a true equivalent is missing before expanding assessed role models.

## Verification

- `npm run test:core` and `node --test tests/occupation-mapping.test.mjs`
- `npm run qa:contracts`, `npm run typecheck`, `npm run build`
- `node scripts/career-auth-guard-smoke.mjs`
- Manual authenticated walkthrough of `/occupations/mappings` on mobile and desktop; confirm no client-side ability to approve a mapping
- Railway deploy checked against exact merged main SHA and its health/readiness endpoints
