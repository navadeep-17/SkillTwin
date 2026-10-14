# SkillTwin Focus Mode — 90-minute demo implementation plan

Status: standalone browser demo on isolated branch. No production or database changes.

## Product contract
- Opt-in Chrome/Edge Manifest V3 extension; selected websites only, not a device lock.
- Local first version: 60 seconds of foreground selected-site browsing then website checkpoint; three reviewed questions; reward of another 60 seconds. Two rewards per day.
- Extension popup allows website selection, 1–60 minute allowance, 1–30 minute reward, five-minute emergency bypass, disable, and reset.
- No remote browsing telemetry, network access to SkillTwin, authenticated learner data, Supabase access, Gemini, or Evidence Engine state mutation.

## Implementation schedule
| Minutes | Deliverable |
|---|---|
| 0–10 | Branch, spec, manifest |
| 10–30 | Domain/timer engine with tests |
| 30–45 | Chrome DNR redirect and checkpoint page |
| 45–65 | Quiz and review feedback |
| 65–75 | Reward unlock, replay cap, bypass |
| 75–90 | Tests, packaging, human Chrome walkthrough |

## Code layout
- extensions/chrome-focus-demo/core.mjs — pure policy and timer state
- extensions/chrome-focus-demo/questions.mjs — offline reviewed SQL/Python/DSA bank
- extensions/chrome-focus-demo/background.js — MV3 worker, DNR rules, persistent timer, messages
- extensions/chrome-focus-demo/popup.html / popup.js — opt-in controls
- extensions/chrome-focus-demo/blocked.html / blocked.js — questions, unlock, and bypass
- extensions/chrome-focus-demo/tests — policy, accounting, quiz, and worker integration tests

## Acceptance gates
1. Node tests pass, scripts pass syntax validation.
2. Load unpacked in desktop Chrome or Edge, enable selected website.
3. Reach allowance, verify active main-frame navigations redirect to checkpoint.
4. Answer three questions; one reward applied and redirect rule removed.
5. After reward is used, redirect resumes.
6. Verify idle/focus pause, browser restart, midnight reset, disable and emergency bypass.
7. Manual Chrome walkthrough remains required before claiming browser-level verification.

## Important boundaries
- Browser activity accounting is approximate, especially around browser sleep, delayed alarms, media playback, and idle-state sampling.
- Quiz source is in the extension; it can be inspected or tampered with and must not become validated SkillTwin evidence.
- A production integration must add separate FOCUS_MICRO assessments, scoped pairing credentials, rate limits, idempotent unlocks and privacy controls, without reusing the evidence-producing CHALLENGE_ME completion path.
- No Android/iOS enforcement or device-wide lockdown in this version.
