# My Certification Journey — stacked Phase C implementation

**Status:** feature branch based on PR #45. CI and migration review pending. Not deployed; no production migration applied. See `docs/CERTIFICATIONS_IMPLEMENTATION.md` for the catalog and ranking phase.

## Working feature scope
- Save an issuer credential from the curated catalog into a learner-owned list. Saving is idempotent per user and catalog ID.
- Track **SAVED → PREPARING → EXAM_PLANNED** (user-selected target date, *not* a confirmed issuer booking).
- Mark official syllabus topic summaries as completed in a self-reported checklist. Progress is **study checklist coverage**, not measured exam readiness.
- Optionally report a credential as `EARNED_SELF_REPORTED` with an earned date and HTTPS claim link. A link **does not prove issuer verification**; no issuer verification endpoint is called.
- The learner can remove tracking, explicitly confirming the deletion.
- Browsing remains available for learners with no goal, no evidence, or no saved certifications.

## Implementation boundaries
- `supabase/migrations/0026_user_certification_journey.sql`: own table, unique `(user_id, certification_id)`, RLS policies scoped to `auth.uid()`, version counter and immutable owner/catalog columns.
- `GET/POST /api/certifications/journey`: read own goals, idempotently save allowlisted credentials.
- `PATCH/DELETE /api/certifications/journey/:id`: owner-scoped, compare-and-swap on `version`; reject stale writes (HTTP 409).
- `lib/domain/certification-journey.ts`: pure transition/URL/date/topic validators; only catalog-defined study topics accepted by the application API.
- `/certifications/journey` and `Save to My Journey`: authenticated UI with a reviewed issuer link and clear non-verification labels.
- No edits to `user_skills`, `skill_evidence`, `learning_plans`, `plan_diffs`, `agent_events`, or issuer bookings.
- Browser session authentication is mandatory; user ID is derived from auth, never the incoming JSON body.
- Stacked PR must not be merged before PR #45. Apply migration before deploying routes that read this new table.

## Before release
1. Get CI green: core tests, all existing tests, production Next.js build and anonymous-access smoke checks for the new page and APIs.
2. Review the migration for correct RLS (users A and B cannot read/edit each other's goals), grants, idempotence, and version-trigger behavior.
3. Apply migration to the correct Supabase project only when ready to activate the feature, and verify `pg_policies`, correct `authenticated` privileges and a two-account RLS smoke.
4. Deploy the parent catalog PR and this dependent feature in order, only after Railway's image-build timeout is resolved; verify the deployed commit.
5. With a **dedicated test learner**: save one credential, refresh, start, toggle topics, set a planned date, report earned as self-reported, switch accounts, confirm cross-user isolation, remove the goal.
6. Test concurrent updates from two tabs: one must win; one receives 409; no silent overwrite.
7. Review submitted HTTPS links; no network fetches or verification are performed.
8. Do not claim complete agent certification orchestration: recommendation-agent read tool and approval-gated roadmap mutations belong to a future separate milestone.

## Known limitations
- Catalog mapping is approximate, particularly vendor-specific hands-on exam objectives.
- Self-reported checklist completion is not independent assessment evidence.
- Saving or reporting a credential does **not** raise SkillTwin skill capability scores or readiness. Issuer verification is future work.
- Exam date is a personal target, not a booked slot.
- Credential URL and earned date can be user-submitted and require issuer verification before a high-trust passport label is possible.
- No private student data should be inserted merely to make a judge demo look successful.
