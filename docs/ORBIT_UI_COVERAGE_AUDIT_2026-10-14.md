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
| Settings | `/orbit-settings` | **New this branch**: native form skin reusing the existing four secure preference controls |

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
| `/settings` | Preferences and notification controls | Orbit-framed classic fallback; native `/orbit-settings` is now available |
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

- **Phase 1 (this branch):** no feature stranded outside Orbit navigation; ship shared feature shell, global More menu, native Agent Activity, native four-preference Settings, and safe fixture tests. Avoid a large backend/schema rewrite.
- **Phase 2:** fully redesign Certifications + Project Defense + Projects; keep source-specific trust status and account writes intact.
- **Phase 3:** redesign Evidence Passport + Progress/weekly report + Occupation Atlas, adding responsive charts only from persisted history.
- **Phase 4:** unify chat and assistant dock, settings, practice/task flows, error/auth states and cross-feature animations.
- **Release gates:** CI, responsive snapshots, real authenticated click-through, keyboard/contrast/reduced-motion inspection, error/empty/loading states, and rollback via the existing flag.

Avoid marking an interior 'Orbit-native' just because it receives the Orbit header. Native status requires its own component-level responsive, interaction and accessibility review.


## 2026-10-14 follow-up — Native interior styling (second UI integration wave)

The previous audit listed secondary features as **Orbit-framed light content islands**. The `design/orbit-certifications-projects-phase2-20261014` branch now enables **dark native surface styling** within those original interactive React components, not only their header. The change is exclusively CSS and navigation/layout presentation:

- Certifications / personal certification preparation: responsive dark panels, issuer links, role-fit callouts, preserved meaningful warning and **self-reported** status labels, readable interactive inputs, keyboard focus.
- Projects and provisional Project Defense: native cards, guided inspection/evaluation surfaces, code provenance emphasis, readable error/empty/loading states.
- Evidence Passport, Progress/weekly reports, Occupation Atlas, Journey Chat and Practice: shared dark semantic surfaces, chart labels/grids, form controls, action buttons and preserved state-specific alert colors.
- Login/password recovery and floating agent chat/activity drawer: dark Orbit material with safe focus, touch, and reduced-motion treatment.

**What is *not* implied:** these features do **not** yet have bespoke redesigned interaction layouts, new charts or extra domain capability. Their original page/component markup and service contracts are retained. The shared native styling is intended to make the existing complete application visually coherent before feature-by-feature interaction redesign. Source trust, agent approvals, async state and scoring are not altered.

**Risk controls:** all dark skins are opt-in behind `isOrbitDefaultEnabled()` (directly for authentication and the assistant, indirectly through the authenticated secondary-workspace shell), existing classic styles survive when the flag is off, and static tests cover canonical certification issuer links, self-reported status, concurrency version tokens, project inspection service routes and tenant-scoped project reads. Public browser fixtures inspect computed colors and responsive overflow; real signed-in acceptance remains pending.
