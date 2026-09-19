# SkillTwin

SkillTwin is an evidence-backed adaptive learning agent for the Product Space AI Agent Hackathon 2026.

## Product loop

`profile evidence -> SkillTwin -> target-role gaps -> adaptive roadmap -> Challenge Me -> assessment evidence -> SkillDelta -> gap refresh -> minimal PlanDiff -> updated roadmap -> grounded explanation`

## Engineering status

Implementation has started. The repository is being built in dependency order from the frozen architecture:

1. Foundation and deterministic domain core
2. SkillTwin Evidence Engine
3. Target-role gap/readiness engine
4. Learning planner
5. Challenge Me assessment
6. Adaptive replanning
7. Persistent Supabase integration
8. Frontend and agent surfaces
9. Deployment and QA

## Core architecture rules

- AI proposes interpretations; application logic owns canonical state.
- Capability and confidence are separate.
- Missing evidence is UNKNOWN, not zero ability.
- Evidence/history and plan versions are auditable.
- Resource URLs come only from a verified catalog.
- Completed learning work is immutable history.
- Replanning makes the smallest safe future-plan patch.
- Journey Chat is grounded and read-only by default.

## Local commands

```bash
npm install
npm run typecheck:core
npm run test:core
npm run demo
```

The first implementation checkpoint is the deterministic vertical slice:

`evidence -> skill state -> gaps/readiness -> Week 1 plan -> assessment evidence -> SkillDelta -> PlanDiff`.
