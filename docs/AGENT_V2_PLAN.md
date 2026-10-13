# SkillTwin Agent V2 — evidence-grounded autonomous learning coach

Status: Phases 1-2 deployed; Phase 3 read-tool orchestration awaiting CI and browser verification.

## What is implemented today (code audit)
- Journey Chat persists conversations and retrieves the signed-in learner's skills, gap snapshot, tasks, plans, last assessment and latest applied PlanDiff.
- A deterministic keyword classifier chooses predefined intents; content is mostly server-composed templates, not an iterative model/tool planner.
- Three mutating actions can be proposed: START_ASSESSMENT, GENERATE_PLAN, and UNDO_PLAN_DIFF. The separate confirmation route performs permission checks and dispatches the domain services. No chat message may directly rewrite a skill score.
- The Evidence Engine, Adaptive Replanner and assessment evaluator operate outside Journey Chat. Agent Activity reads saved events, not imagined reasoning steps.
- Earlier code used naive substring skill matching and did not explain the exact assessment-linked before/after proficiency change plus NO_OP. Phase 1 addresses both.

## Agent V2 product promise
The learner can ask an open question, the system selects narrow read-only tools, retrieves fresh learner-owned evidence, produces a traceable explanation with references, and asks for explicit confirmation before any consequential action. If the evidence is missing or inconsistent, the agent abstains or requests clarification. It must never invent a readiness score, assessment result, accepted evidence or roadmap modification.

## Phase 1: Trustworthy proof-aware agent (implemented in PR, pending CI/release)
- EXPLAIN_ASSESSMENT intent covers "Why did my JavaScript drop?" and "Why didn't my plan change after my assessment?"
- Fetch latest relevant **completed** assessment, its exact matching skill-history entry, its same-ID replanning decision, and only assessment-linked applied PlanDiffs. All queries filter by signed-in user_id.
- Use the established pure buildTwinProofTrail helper; cite exact assessment and skill IDs, expose current and previous estimates, score and coverage, then state CHANGED, UNCHANGED or NOT_RECORDED honestly.
- Disambiguate exact skill names (Java vs JavaScript; React vs React Native).
- Tests prohibit unrelated PlanDiff attribution or ambiguous intent routing.

## Phase 2: Action authorization and stale-state protection (P0)
- [x] Validate allowlisted action payload types and UUID identifiers before execution.
- [x] Re-evaluate user-owned active-goal snapshot, active plan and version, approved PlanDiff status, and validation-question availability before dispatch.
- [x] Reject stale/expired/invalid proposals and only claim PROPOSED rows once using a conditional SQL update.
- [x] Record executed proposal status and an agent_events audit item in one transaction after a domain action succeeds; leave CONFIRMED for manual reconciliation if that result cannot be persisted.
- [x] Add focused agent action safety regression tests; UI invalidates rejected confirmation cards.
- [ ] Run authenticated concurrent action-confirmation smoke; verify no duplicate downstream mutation.
- [ ] Fully crash-safe execution recovery needs a durable result reference and a separate DB migration/transaction design. The current status is at-most-once dispatch, NOT guaranteed exactly-once, and a CONFIRMED state may require manual reconciliation after a process crash.

- Verify proposal baseline_ref against CURRENT gap snapshot, active Plan/PlanDiff version and selected skill before dispatch; rejected stale proposals must not launch side effects.
- Move from claim-first/dispatch-later failure semantics toward recoverable idempotent execution, with request IDs and explicit status transitions.
- Validate action payload server side; action proposals must never accept arbitrary SQL, URLs, targets or hidden model instructions.
- Test concurrent confirmations, duplicate HTTP requests, expired proposals and cross-user access.

## Phase 3: Bounded agentic orchestration (P1)
- [x] Seven server-owned, allowlisted read tools; Gemini selects at most three names.
- [x] Strict JSON validation and a 3.5-second Gemini request timeout with a deterministic fallback.
- [x] Read-only server-side execution; existing approval-gated actions remain unchanged.
- [x] Evidence-linked results and executed tool names are visible in Journey Chat.
- [ ] Production authenticated browser verification and adversarial evaluation are still required.

- Define allowlisted **read tools**: get_skill_state, get_assessment_proof, get_role_gap, get_active_plan, get_next_tasks, get_replan_reason, get_activity.
- Add a structured planning step (optional Gemini) to choose a maximum of 2–3 tools and return a constrained plan. Validate tool names/arguments with zod and server-owned user context; enforce wall-clock and token budgets.
- Execute only read tools automatically. Mutation tools remain separate proposals needing explicit user approval and are revalidated on execution. No recursive uncontrolled tool loops.
- Return a concise answer with exact source entity refs and an "unknown" path when there is no proof. Deterministic fallback when Gemini fails/disabled.
- Measure usefully different behavior from simple keyword routing; do not describe a single prompt as a multi-agent system.

## Phase 4: Agent memory and UX (P1)
- Restore existing conversation threads on browser reload and enable switching/history; persisted threads are already in Postgres.
- Show retrieved evidence, proposed action, why it was selected and state-change result in one conversation; Activity stays an audit log, not private chain-of-thought.
- Mobile-first agent entry, loading/error/timeout handling, keyboard support, accessible focus and reduced-motion support.

## Evaluation gates
- Benchmark at least 30 learner questions including incomplete profile, multiple similar skill names, correct NO_OP, conflicting evidence, missing assessment, stale plan, absent target role, and adversarial instructions in resume and project text.
- Accuracy: 100% ownership isolation, source IDs and confirmed changes must be real, no direct evidence/score writes from agent; no unauthorized mutation, no answer-key leakage; every action approval repeat-safe.
- Track grounded answer correctness and abstentions, tool-call precision, latency p50/p95, and failed Gemini fallback. Record measured values rather than inventing quality percentages.
- Run real signed-in browser smoke for one full assessment cycle before claiming the new agent is production-ready.

## Minimal judge demonstration
Ask "Why did my JavaScript skill drop?" -> agent cites completed assessment, shows Intermediate -> Beginner, 49% -> 81% confidence, then explains the actual SKILL_OUTSIDE_ACTIVE_HORIZON NO_OP. Ask "What should I work on next?" -> grounded current task and role goal. Ask "Challenge me" -> safe action proposal -> user confirmation -> real challenge. This is a clear Observe -> Explain -> Propose -> Act -> Verify story.
