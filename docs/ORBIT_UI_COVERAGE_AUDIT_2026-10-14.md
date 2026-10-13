# SkillTwin Orbit — Frontend Coverage Audit (2026-10-14)

## Evidence and scope

Reviewed the actual Next.js `app/` route tree on `main`, the component composition of each page, the active Orbit prototype routes, and the original **Component G: Frontend + Visualizations** specification. This is a **UI coverage** report, not a backend implementation audit.

**Core invariant from Component G:** render persisted, server-computed state; do not invent capability, confidence, readiness, scores or plan changes in the browser. Preserve access to evidence provenance, plan explanations and human control. All new UI on this branch respects these boundaries.

### Native Orbit destinations already implemented

| Domain feature | New route | Presentational status |
| --- | --- | --- |
| Home / mission control | `/` and `/orbit-beta` | Orbit marketing + native signed-in Today |
| Build your Twin | `/orbit-onboarding` | Orbit hero / existing functional onboarding form |
| Skill graph & evidence | `/orbit-skills` | Native skill constellation + real skill state |
| Learning roadmap / plan history | `/orbit-journey` | Native timeline and persisted PlanDiff/NO_OP |
| Prove / assessments | `/orbit-prove` and session subroute | Native proof inspector; existing evaluator retained |
| Career exploration | `/orbit-explore` | Native requirement/transferability explorer |
| Agent Activity | `/orbit-activity` | **New this branch**: native filtered read-only event timeline, owned event refs scoped to account |

### Shared Orbit shell applied to existing secondary modules on this branch

These pages continue to use their **functional existing React components** and server/API contracts; they now gain a consistent Orbit top navigation, grouped More menu, contextual dark hero, quick links, responsive shell and **accessible light content island**. This is **integration**, **not yet a full interior redesign**.

| Existing route | Primary capability | Status after this branch |
| --- | --- | --- |
| `/certifications` | Certification discovery and recommendations | Orbit-framed existing explorer |
| `/certifications/journey` | Preparation milestones and saved credentials | Orbit-framed existing tracker |
| `/projects` | Projects and project evidence submission | Orbit-framed existing workspace |
| `/project-defense` | Public repository inspection/defense | Orbit-framed existing workbench |
| `/passport` | Evidence Passport and provenance | Orbit-framed existing document |
| `/journey` | Journey Chat and confirmed agent actions | Orbit-framed existing chat |
| `/progress` | Progress and weekly reports | Orbit-framed existing analytics |
| `/occupations` and nested routes | Occupation Atlas | Orbit-framed existing atlas |
| `/settings` | Preferences and notification controls | Orbit-framed existing form |
| `/practice` and nested routes | Practice launcher and existing assessments | Orbit-framed existing practice UI |
| `/activity` | Existing classic Agent Activity | Orbit-framed fallback; native alternative `/orbit-activity` |

**Security and fallback:** The bridge is enabled only when the learner is signed in **and** the server-provided Orbit-default flag is active. Classic UI remains available through `/overview?classic=1` and existing routes when the flag is disabled. No migrations, evidence writes, scoring changes or new LLM prompts.

## Still missing a full Orbit-native interior

1. **Certifications / Journey**: replace interior cards/filters/preparation form styling while preserving official source attribution, status labels and self-report safeguards.
2. **Projects / Project Defense**: native portfolio cards, guided GitHub inspection, loading/evaluation states and source-backed defense results.
3. **Evidence Passport**: native profile/proof layout, evidence provenance, downloadable view and the distinction between possession, confidence and validation.
4. **Journey Chat / Agent Activity global drawer**: unify chat bubbles, thread history, source references, guarded actions and the assistant dock with Orbit's dark language.
5. **Progress / weekly reports**: native responsive charts driven only by recorded trends and real saved reports.
6. **Occupation Atlas**: fully integrated comparison and research views with preserved source status, release/year, country context and licensing.
7. **Settings**: Native Orbit controls for the four persisted presentation preferences are implemented. Goal, learning-calendar, adaptation-mode and broader privacy controls in Component G require a separate verified persistence/API contract before UI design.
8. **Practice Hub / legacy assessment alternate flows**: native task states and transitions while keeping current scoring and evidence services.
9. **Errors, not-found, sign-in and password recovery**: continue visual alignment and accessible fallback design.
10. **Authenticated end-to-end QA** of real learner routes remains outstanding; fixture browser screenshots only prove presentation and interaction in fictional previews.

## Recommended delivery order

- **Phase 1 (this branch):** no feature stranded outside Orbit navigation; ship shared feature shell, global More menu, native Agent Activity and safe fixture tests. Avoid a large backend/schema rewrite.
- **Phase 2:** fully redesign Certifications + Project Defense + Projects; keep source-specific trust status and account writes intact.
- **Phase 3:** redesign Evidence Passport + Progress/weekly report + Occupation Atlas, adding responsive charts only from persisted history.
- **Phase 4:** unify chat and assistant dock, settings, practice/task flows, error/auth states and cross-feature animations.
- **Release gates:** CI, responsive snapshots, real authenticated click-through, keyboard/contrast/reduced-motion inspection, error/empty/loading states, and rollback via the existing flag.

Avoid marking an interior 'Orbit-native' just because it receives the Orbit header. Native status requires its own component-level responsive, interaction and accessibility review.
