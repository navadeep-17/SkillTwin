# Agentic Project Defense — public GitHub pilot

## Problem and goal

SkillTwin's existing `/api/profile/projects` analyzes learner-submitted project descriptions and technologies. An artifact URL is stored as metadata but the service **does not inspect linked code**. The pilot adds a separate real-code interview: source inspection → pinned provenance → three interview questions → provisional structured evaluation.

The product claim is **defending the reasoning behind actual code**, not verifying authorship or professional certification. It is available to signed-in learners at `/project-defense` and from `/projects`.

## Scope and constraints

1. User submits a public `https://github.com/{owner}/{repo}` URL. The parser refuses arbitrary hosts, credentials, ports, query strings, tree/blob deep links, and non-HTTPS schemes. No personal GitHub access tokens are accepted.
2. The server uses the unauthenticated GitHub REST API, pins the current HEAD commit SHA, and fetches the recursive tree. It rejects truncated/large tree responses and inspects only **three bounded code blobs** (.py, .js, .jsx, .ts, .tsx, .sql; generated/vendor/test paths excluded; files 120–12,000 bytes).
3. Each excerpt is capped at 30 lines/2,800 characters with a link to its GitHub commit and lines. The server never clones, executes, builds or tests external code.
4. The three deterministic questions address implementation flow, design trade-offs, and failure/testing. Each is tied to one source excerpt and has a transparent rubric.
5. After the learner provides three substantial answers, evaluation **re-fetches** the repository and compares the HEAD commit SHA with the pinned inspected commit. A changed commit forces reinspection.
6. The Gemini structured evaluator receives only bounded source excerpts, questions/rubrics and learner responses, all marked untrusted. It must return STRONG/PARTIAL/INSUFFICIENT, grounded explanation and follow-up question per source. Question IDs must match exactly; if Gemini is not configured, the UI says unavailable instead of forging a score.
7. This pilot **does not persist** the interview (browser session only), create trusted SkillTwin evidence, claim proof of code authorship, or change skill scores/roadmaps. Capability assessment remains in `/challenge-my-twin`.

## Guardrails and known limits

- Public GitHub API is rate-limited. Large repositories, fewer than three supported files, and private repositories may be rejected.
- Three top-ranked source files are **not** a full repository audit. Questions are source-grounded but do not claim whole-project understanding. A repo may contain generated or hostile text.
- Source/answer prompt injection is explicitly treated as untrusted data. Structured output and ID validation reduce—but cannot eliminate—evaluator risk.
- No arbitrary fetch URL, GitHub token, user-supplied file paths, shell execution, cloud VM execution or privileged repository writes.
- The evaluator is **provisional feedback**, not a verified score. It cannot be fed into `user_skills` or the Evidence Passport until a separately reviewed assessment protocol and real signed-in end-to-end test are complete.
- The pilot limits repository response sizes and uses a per-request timeout. It is not a production-scale code-hosting or anti-cheating service; abuse controls and controlled assessment sampling are future work.

## Manual acceptance

1. Sign in and open `/project-defense`.
2. Submit an existing public repo with at least three small source files (e.g. a training or backend project). Confirm 3 distinct source paths, pinned commit SHA, file-excerpt line links, and 3 questions.
3. Answer all three. If Gemini is available, inspect three provisional reviewer notes and follow-up questions; if not, the UI must explicitly report AI unavailable.
4. Refresh and ensure the interview is not falsely claimed to be stored as assessed evidence.
5. Submit `https://github.com.evil.com/x/y` and verify rejection, as well as private repo or fewer-than-three-files cases.
6. Inspect the normal `/challenge-my-twin` and `/passport` flows; the pilot must have caused **no** capability or evidence writes.
7. Re-check on a mobile viewport. Test a repo whose HEAD changes during the interview: evaluation must request reinspection.
8. Verify signed-out access redirects to `/login`, CI passes, Railway SHA matches `main`, and runtime errors are absent.

## After hackathon

A fully governed Project Defense can add pinned-review persistence, contribution/ownership verification, multi-turn questions, independent assessment calibration, explicit learner consent, and evidence proposals requiring human or calibrated assessor approval. Do not present those as implemented today.
