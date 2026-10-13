# SkillTwin Orbit — Design Blueprint v0.1

**Status:** interactive design exploration, not production UI.  
**Branch:** `design/skilltwin-orbit-exploration`  
**Prototype route:** `/orbit-lab` when this branch is run or preview-deployed.  
**Owner boundary:** UI renders canonical domain state; it does not compute or commit skill capability, confidence, readiness, assessment outcomes or PlanDiffs.

## Product thesis

SkillTwin should feel like a living, evidence-grounded career intelligence system rather than a dashboard with unrelated AI features. Its unique moment is **claim → challenge → demonstrated proof → explainable update → adaptive decision**.

A memorable animation is helpful only when it makes a real state transition easier to understand. A skill never becomes green merely because a resume mentions it; visual status must reflect the canonical evidence/confidence rules.

## Audit of existing frontend (October 2026)

- Next.js 15, React 19, Tailwind 3, React Flow and React Query already exist.
- Current global CSS contains indigo/light product tokens, skeleton shimmer, page entry, progress fill, drawer entry, route progress and reduced-motion fallback.
- Navigation presently has five primary destinations plus nine secondary destinations; a user must learn internal feature names before using much of the app.
- Overview contains readiness, evidence coverage, confidence, high-priority gaps, and activity. It lacks a central primary-task experience and visually distinct Twin identity.
- Skills already includes an interactive React Flow graph; it needs a more focused evidence-inspection layer, related-skills navigation, history, and transition states.
- Route progress is timer-simulated. Keep it non-numeric/indeterminate until real operation status exists.
- Authenticated browser layout inspection, mobile/device QA, and a completed end-to-end proof→SkillDelta→PlanDiff production test remain release gates.

## Visual system — Orbit

| Token | Value | Intended meaning |
| --- | --- | --- |
| Canvas | `#0B1020` | Dark spatial environment |
| Surface | `#141B30` | Elevated reading and controls |
| Raised surface | `#1B2540` | Active cards and panels |
| Primary text | `#F4F7FF` | Highest information priority |
| Muted text | `#A6B2CE` | Supporting metadata |
| Twin violet | `#A99AFF` | Intelligence, links, focus |
| Verified mint | `#52E7C7` | Successfully validated evidence |
| Developing amber | `#F7C67E` | Developing/needs practice |
| Unknown neutral | `#8290AF` | Insufficient evidence |
| Conflict/error | Reserved accessible red | Explicit conflicts and destructive operations only |

Use typography with strong display hierarchy, 11–13px uppercase overlines sparingly, 16px minimum where long-form copy is read on mobile, and tabular numerals for scores. Evaluate Space Grotesk headings and an accessible body font in a later gated asset pass. The prototype currently uses a system font stack for reliability.

**Contrast:** all data labels, buttons and control states must meet WCAG 2.2 AA requirements. Treat status as icon + text + color, never color alone.

## Information architecture (target)

1. **Today** — one high-value action, plan queue, recent change and state summary.
2. **My Twin** — capability constellation, confidence, evidence sources, uncertainty and challenge entry points.
3. **Journey** — weekly plan, dependencies, tasks, resource details, PlanDiff history and undo.
4. **Prove** — Challenge My Twin, assessments, Project Defense and validation history.
5. **Explore** — Career Discovery, occupation atlas and transferable competencies.

Keep contextual Ask SkillTwin global. Put Evidence Passport under My Twin/Progress; technical mapping-review/model-builder screens belong in a separate maintainer tools area, not learner navigation.

## Prototype 1: Landing

**Goal:** communicate the distinctive promise in 5–10 seconds.

- Hero: “Meet the AI that evolves with you.”
- Responsive interactive/motion constellation; reduced-motion static state.
- Primary call to action: explore your Twin; secondary: see proof in action.
- Three product pillars: understand, see path, challenge/evolve.
- Next product implementation: genuine registration entry, lightweight deterministic interactive before/after demo, performance-safe animated asset, static Open Graph image and visual accessibility QA.

## Prototype 2: Today

**Goal:** give a learner a meaningful first action within seconds.

- Twin constellation is the hero; clicking a node selects a real skill-detail context in the eventual product.
- Readiness chart has explicit source and time window; display capability separate from evidence confidence.
- Action queue prioritizes one next task, then optional alternatives.
- Prototype tasks use local React state only; production completion must call the task service and refresh canonical projections.
- Provide new learner, partial profile, valid plan, no-plan, empty graph, error and recovery variants.

## Prototype 3: Challenge My Twin

**Goal:** show exactly how proof changes the system.

- Intro makes a specific, evidence-backed claim with an uncertainty explanation.
- Learner requests a targeted assessment; question selection/evaluation owned by Component E.
- On completion, show a factual before/after snapshot from Component A, refreshed role gap from C, and PlanDiff or NO_OP from F.
- Changes are animation events derived from committed SkillDelta/PlanDiff IDs; never optimistic score changes.
- Failed evaluation, insufficient evidence, incomplete challenge, NO_OP, ASK_FIRST and undo must be explicitly designed.
- The prototype uses **one mock MCQ and clearly labeled illustrative values**. It does not create, submit or grade actual learner assessments.

## Motion policy

| Tier | Typical time | Examples |
| --- | --- | --- |
| Micro | 100–180 ms | Hover, focus, press feedback, radio selection |
| Navigation | 180–350 ms | Panels, route content and drawers |
| Signature | 600–1200 ms | Evidence accept, Twin node transformation, PlanDiff reveal |

Use transform/opacity for most animated transitions; avoid layout thrashing. Do not loop large blur/filter effects across the viewport. Rive is optional for a single Twin identity asset; Motion for React can orchestrate UI layout transitions. Honor `prefers-reduced-motion`, pause controls for nonessential movement, and avoid auto-playing audio.

### Loading policy

- Route loading: slim **indeterminate** bar; skeleton matching expected content.
- Resume analysis: upload received → parsing → evidence proposals → canonical state → role gaps → plan. Each stage changes only when the server reports its status.
- Assessments: disable duplicate submission by request key; provide pending, success, recoverable failure and resume states.
- Do not display a fake percentage as if it came from the server.
- Long-running workflows should survive page reload and explain retry/recovery.

## Charts and graph contracts

- React Flow nodes reflect `UserSkill` and target-role dependencies. Unknown confidence must not be rendered as low capability.
- Recharts can power dated readiness history, skill target comparisons, and evidence-source composition; no invented time-series.
- Every chart needs readable axis/units, source/explanation, accessible table alternative and graceful missing-data treatment.
- Click/keyboard select in constellation → inspector → evidence sources → challenge route; graph view and matrix stay synchronized.

## Read-only beta preview (Phase 2)

A separate authenticated `/orbit-beta` route now shows the real active target, role requirements, prerequisite edges, saved UserSkill capability/confidence, evidence record counts, latest readiness/coverage, and high-priority role gaps.

- All values come from authenticated, user-scoped Supabase reads; the page exposes no mutation controls.
- Skill-node selection updates only local inspector visibility, not backend state.
- The preview intentionally avoids a historic readiness chart when no source-backed time series is available.
- If the user has no goal, role graph or gap snapshot, it shows an explicit setup state instead of manufactured metrics.
- A subset of at most 16 role requirements is shown on the prototype graph; the existing Skills page remains available for complete graph and evidence inspection.
- Readiness, confidence, target and gap status remain distinct. Colors are secondary to accessible status labels.
- The route is included in the authentication middleware and has contract tests in CI.
- **Not a production replacement:** the original `/overview`, `/skills`, `/roadmap` and `/challenge-my-twin` routes stay unchanged.

### Verification limitations

CI validates TypeScript, Next.js build, static read-only/auth invariants and test suites, but cannot establish actual visual layout quality. An authenticated browser walkthrough is still required to verify Supabase join behavior and visually inspect screen widths, focus handling, graph legibility, contrast and performance before offering this as a live beta.

## Route/data integration approach

Do **not** replace existing domain components or database logic. Extract a reusable OrbitShell and Orbit tokens. Integrate route by route behind an environment/feature gate, preserving old screens as a fallback until verified.

| Screen | Canonical data/action |
| --- | --- |
| Today | active career goal, gap snapshot, learning tasks, agent events |
| My Twin | canonical skills, UserSkill, skill evidence/history, role dependencies |
| Journey | active plan/version, resources, tasks, PlanDiff and undo |
| Prove | assessment sessions/questions/outcomes; immutable evidence and SkillDelta |
| Explore | seeded/reviewed career models and source-attributed occupation exploration |

The new UI must never infer skill rank, readiness or plan patch operations locally.

## Acceptance and testing gates

- Visual QA at 360, 390, 768, 1024, 1440px, both pointer and touch.
- Full keyboard navigation, focus visibility, no keyboard traps, screen reader labels and reduced motion.
- 4× CPU throttling and low-end mobile performance checks; keep LCP <=2.5s, INP <=200ms and CLS <=0.1 for good field experience.
- Empty/new learner, errored resume, loading, partial data and offline/retry variants.
- Actual authenticated proof→assessment→evidence→SkillDelta→gap→PlanDiff/NO_OP→audit browser test against an isolated test account.
- No change to learner records or production service until CI, E2E, security and owner review are complete.
- Measure first-task start, challenge completion, return-to-learn rate and navigation friction after release.

## Staged rollout

1. **Design review (this branch):** blueprint + three interactive sample-data screens.
2. **Design system:** components/tokens/motion, accessible theme, nav IA.
3. **Today & onboarding:** authenticated implementation + error/empty states.
4. **My Twin & Journey:** evidence-driven graph, tasks and PlanDiff animations.
5. **Prove:** real assessment/Project Defense integration with exact provenance.
6. **Explore & QA:** career comparison, visual regression, performance and gradual release.

**Do not merge this prototype as a replacement for the working product.** The `/orbit-lab` route exists solely for a visual and interaction review.
