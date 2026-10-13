# SkillTwin Agent V3 — Overnight RAG Slice (14 October 2026)

## Deadline and hard scope
Deliver one **read-only, source-linked GitHub-code retrieval flow in Ask SkillTwin**, backed by the existing public-repository inspector and authenticated project records. Keep Railway production unchanged until CI and signed-in QA pass. This is **keyword-ranked RAG over bounded, live-fetched code excerpts**, not a vector database or a general autonomous agent.

## Milestones (focused engineering estimate, not guaranteed schedule)

| Milestone | Scope | Effort | Exit gate |
| --- | --- | ---: | --- |
| M0 | Current-state audit and scope freeze | 20–30 min | Identify existing reader, agent tools, and action boundaries |
| M1 | Pure source-ranked retrieval and citations | 45–60 min | Relevant queries select correct bounded code excerpt; irrelevant queries abstain |
| M2 | Authenticated project RAG read service | 45–75 min | Only saved learner-owned public GitHub projects; pinned source links |
| M3 | Integrate V3 tool into Journey Chat | 45–75 min | Project questions route to read-only retrieval; no action without approval |
| M4 | Tests and GitHub CI | 45–75 min | Typecheck, routing, grounding, security regressions and build pass |
| M5 | Staging/signed-in smoke and potential release | 60–90 min | Test project questions, unavailable GitHub, cross-user access, fallback and latency |

**Expected overnight focused MVP:** roughly 4–6 hours if integrations cooperate. **Not included before morning:** pgvector/embeddings, OCR, crawlers, writable RAG tool execution, durable job queues, autonomous agent swarms, credentialed private repository access, automatic evidence updates and production SLAs.

## Architecture
User message -> existing intent classifier -> approved read-tool planner -> user-scoped project lookup -> validated public GitHub URL -> existing Project Defense bounded inspector (pinned commit) -> pure lexical ranker -> optional bounded Gemini synthesis -> grounded response with exact pinned GitHub source links -> persisted chat.

The source is **untrusted**. Its comments, filenames and contents can never command the agent. No URL or SQL is ever accepted from a model tool call. The learner's identity is derived from their authenticated session, not model output.

## Non-negotiable boundaries
- Read only: no edits to evidence, capability, assessments, plans, role readiness or action approvals.
- Missing source / failed public fetch / ambiguous multiple projects -> an honest explanation, not invented source material.
- Text-based code excerpts are limited to the three files already fetched by the secure Project Defense inspector; provenance includes a commit SHA and line range.
- All documented cited links must be returned by the server-owned inspector; no model-generated URLs.
- Prompts and code snippets are untrusted content and should not override system instructions.
- No changes to production Supabase tables, Railway settings or credentials in this initial slice.

## QA fixtures and acceptance tests
1. Ask how authentication was implemented in a saved public project; retrieve a matching inspected file and return pinned source link.
2. Ask about a missing concept; show uncertainty and inspector coverage limitation.
3. Submit unrelated prompt-injection instructions inside code; do not dispatch extra tools or actions.
4. Learner with no saved public GitHub URL receives a helpful no-source response.
5. Learner with multiple saved public projects is asked to identify the project instead of guessing.
6. Confirm same git commit appears in all cited links; include line range; no fabricated citations.
7. Regression: Challenge Me confirmation, evidence engine and roadmap endpoints remain untouched.
8. Validate privacy, rate limits and answer behavior with a signed-in test learner before merging.

## Post-overnight roadmap
Once this source-linked vertical slice is verified: add a dedicated indexing pipeline, source registry, Postgres full-text + pgvector hybrid search, approved careers/certification corpora, multi-turn context retrieval, durable workflows and rigorous RAG evaluation. Those are later milestones, not implied to be delivered overnight.
