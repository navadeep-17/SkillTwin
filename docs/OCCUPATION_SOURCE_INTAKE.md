# Occupational Intelligence — O*NET source-backed exploratory catalog

## Release scope

A **read-only, source-backed occupation atlas**, not the same thing as an assessed or verified SkillTwin career model.

- A curated snapshot of 9 O*NET OnLine occupations across 9 fields, compiled from the official 2026 detail pages on 2026-10-13.
- Occupation code, source URL, description, source year, US-context label, top 7 source Essential Skills and top 5 source Transferable Skills for each record.
- Each skill retains its O*NET importance value (an occupation-level rating, **never** a learner capability, readiness or probability of hire).
- All 108 displayed source skill entries remain `UNMAPPED`. Matching labels to SkillTwin canonical IDs without review would be dishonest.
- The interface is an authenticated, exploratory search experience at `/occupations` reachable through Career Discovery and navigation.
- No skill evidence, active goal, gap analysis, assessment, or roadmap writes. No external API request required during page render. No new database tables in this first release.

## Sources and reuse

U.S. Department of Labor, Employment and Training Administration (USDOL/ETA), *O*NET OnLine*, https://www.onetonline.org/ ; license https://www.onetonline.org/help/license ; CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). O*NET® is a trademark of USDOL/ETA. We selected and reformatted portions of the occupational pages. USDOL/ETA has not approved, endorsed or tested these modifications.

Occupational profiles are **US-centric** and cannot be used to infer Indian qualifications, professional licenses or employer hiring standards. The US O*NET OnLine occupational pages were labeled "Updated 2026" when curated; O*NET's production database release was 31.0 at research time. This is a **manual curated page snapshot**, not a verified full copy of the 31.0 dataset. Do not advertise all O*NET skills or full occupation coverage.

See `data/occupations/onet-online-curated-2026-10-13-v1.json` for exact source URLs, metadata and selected values. Source IDs are canonical O*NET-SOC occupation codes, not fabricated SkillTwin target-role IDs.

## Data processing and safety

Input source: official O*NET OnLine `/link/details/<code>` pages.
1. Verify the official occupation code and title match the source URL.
2. Capture the occupation description as published and first 7 / first 5 importance-ranked entries from Essential Skills / Transferable Skills tables.
3. Mark occupation status `EXPLORATORY`, region `US`, each skill `UNMAPPED`.
4. Commit a stable, dated snapshot to source control rather than silently mutating it at runtime.
5. Validate duplicate IDs, URL/code matching, selected source/vintage/attribution, group count, rank ranges, mapping status, and absence of unreviewed SkillTwin IDs.
6. Run `node --test tests/occupation-snapshot.test.mjs` in CI and Next build/anonymous route checks.

**Review gate:** To integrate these records with canonical SkillTwin roles, create a separate change with explicit O*NET-to-SkillTwin skill mapping candidates, reviewer decisions, confidence, timestamp and source-version hashes. Domain experts must review qualification-sensitive skills and assessment rules. Do not automatically assign a target_score (0-4), "readiness", requirement importance or a learning roadmap from O*NET importance (0-100).

## Release acceptance criteria

- Source URL opens official occupation details
- Search supports occupation, field and named source skills
- At least three non-technology occupational families are discoverable
- No display of fit or readiness percentage for exploratory profiles
- Explicit US-context, CC BY attribution, license, dataset vintage, modification/no endorsement
- Anonymous requests are redirected; authenticated users can explore without editing their career goal
- Source snapshot safety tests, TypeScript, production build and middleware smoke pass
- Manual signed-in mobile and desktop smoke before claiming complete UX verification

## Future stages

- Structured official bulk dataset ingest with appropriate licensing and selected release snapshots
- Provenance registry and SkillTwin canonical mapping-review workflow with audit logs in Supabase
- Reviewable qualifications and occupation locality
- Versioned, calibrated role competencies for approved career models
- Independent assessment and outcome validation before career readiness scoring
