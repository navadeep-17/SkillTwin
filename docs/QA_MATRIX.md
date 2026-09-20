# SkillTwin QA Matrix

This matrix maps the frozen A-J architecture to executable checks in the repository.

| Component | Primary automated proof | Release rehearsal proof |
|---|---|---|
| A — Evidence Engine | `tests/core.test.mjs`, contract QA, DB/RLS QA | evidence -> SkillDelta/history without direct UI mutation |
| B — Profile Analyzer | build/typecheck, upload guards, release smoke project evidence | PDF/project -> canonical evidence -> SkillTwin |
| C — Role/Gap | core domain tests, role generator validation, DB constraints | target role -> deterministic gap/readiness |
| D — Planner/Resources | core planner tests, contract QA | Plan v1 respects capacity and verified resources |
| E — Assessment | adaptive + constructed fallback core tests | Challenge Me -> summary evidence -> SkillDelta |
| F — Replanner | operation vocabulary tests, evidence replan policy tests, contract QA | assessment/project/task/constraint signal -> no-op or versioned PlanDiff |
| G — Frontend | production build, route contract QA | desktop/mobile walkthrough, task detail, graph, drawers, loading/error states |
| H — DB/API | database-security QA, readiness | RLS, private storage, authenticated API boundary |
| I — Chat/Activity | contract QA + build | grounded explanation, confirmed action, matching AgentEvent |
| J — Release/QA | CI, `qa:contracts`, `qa:db`, `smoke:release` | exact Railway SHA + full judge rehearsal + rollback target |

## Required commands

```bash
npm install
npm run typecheck:core
npm run test:core
npm run qa:contracts
npm run typecheck
npm run build
```

With database QA credentials:

```bash
npm run qa:db
```

Against production:

```bash
EXPECTED_COMMIT_SHA=<main-sha> npm run smoke:release
```

For a dedicated destructive smoke learner, also configure the smoke authentication variables, `SMOKE_DESTRUCTIVE=true`, and `DEMO_RESET_SECRET`.
