# Arena — Human-first AI fallback

## User experience
- Find a human opponent by topic first. The default **AI fallback after 20 seconds** checkbox can be disabled before or while waiting.
- After 20 seconds of *server-measured queue time*, the browser can start AI preparation; a user who opted out can continue waiting indefinitely or select Play against AI.
- The database atomically leaves the real-player queue before creating the AI session, preventing one learner from being simultaneously matched to two opponents.
- Gemini receives five curated, key-free multiple-choice questions and selects an index for each without access to the grading keys.
- If no Gemini key is configured, output is invalid, or the request times out, the product **does not fabricate an AI score**. It starts a clearly labeled **Solo Practice** round instead.
- Human, AI, and Solo sessions have separate quiz labels and result views. All scoring remains server-authoritative. Results do not affect Skills, Evidence Passport or Roadmap.

## Technical scope
- Migration `0028_arena_ai_fallback.sql` adds non-heartbeat `queued_at` and owner-private `arena_ai_sessions`/`arena_ai_answers`, plus a guard against active human/AI overlap.
- `POST /api/arena/ai` requires auth, checks an actual 20-second server queue wait, transitions under the same advisory lock order as the human pairing transaction, and generates candidate choices in one bounded Gemini request.
- The AI generation schema accepts exactly five integers (0–3). No answer key is included in the prompt.
- `GET /api/arena/state` reads only the authenticated learner's AI/solo session or existing human state; redacted client state never contains the AI choice list.
- `POST /api/arena/answer` validates question number and option; for AI/solo uses an owner-filtered server SQL insertion with current server time and unique answer key.
- Model requests left in PREPARING for over 25 seconds recover as Solo to avoid indefinite spinners.
- API response is not cached. Browser polls every 1.5s while waiting and playing.

## Release order and acceptance
1. Run all TypeScript, core and Arena tests, anonymous-access regression, and Next/Docker CI successfully.
2. Review the SQL trigger, owner grants, AI sessions, and array shape check. Apply migration `0028` **before** deploying routes that use the new tables.
3. Verify read-only database checks: both new tables RLS enabled; `anon` and `authenticated` have no select/insert/update/delete privileges; zero unexpected user data.
4. Merge CI-green feature branch and deploy exact SHA to Railway. Verify SUCCESS and app startup.
5. **Authenticated acceptance test still required**: one learner waits >20s and enters AI or Solo; another learner chooses "wait for human"; two real learners still match and cannot be converted to AI afterward; quiz answers and results are correct for each mode; concurrent starts don't create duplicate matches.
6. Test no Gemini key and Gemini request failure as Solo; do not claim model participation without a recorded successful response. Log failure categories, not raw credentials or answer keys.

## Known MVP limitations
This is a demo-focused fallback. No leaderboards, chat, ratings, anti-abuse challenge quotas, notifications, adaptive AI difficulty or issuer-verified assessment integration. Model-generated answers can be incorrect or variable; they are independent opponent choices, not ground-truth grading. Real two-browser authenticated QA is not covered by anonymous CI and must be performed before claiming end-to-end verification.
