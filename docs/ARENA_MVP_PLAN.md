# SkillTwin Arena — 60-minute random 1v1 MVP sprint

Scope approved: random **real-human** matchmaking first; no fake opponents or invite-only gate. Build in feature branch, review CI, and apply DDL/deploy only after verification.

## User journey
1. Authenticated learner selects Python, SQL or JavaScript and taps **Find Rival**.
2. Server atomically pairs two active waiting learners with the *same topic*. Learner can't pair with themselves or enter multiple active games.
3. A 150-second match starts with five curated independent practice questions, 30 seconds per question. Both receive identical questions, server-controlled time and authoritative grading.
4. Each player submits a single answer per question. No correct answers or grading keys are returned before game completion.
5. Both see final verified scores and win/loss/tie after 150 seconds; another session can begin after cooldown.
6. Waiting learners can cancel. No opponents → remains in honest waiting mode, not a synthetic bot.

## In one-hour prototype
- 3 skill topics, 5 curated questions each, independent from the private SkillTwin evidence-based assessment bank.
- PostgreSQL queue/match/answer tables + authenticated SECURITY DEFINER RPC functions, RLS with no direct client score writes.
- Atomic queue pairing per topic using transaction-level advisory locks, membership checks, slot exclusivity, waiting heartbeat, inactivity expiration.
- Protected /arena UI with polling synchronization (not Supabase Realtime) and browser/desktop responsive interactions.
- Endpoint and domain security tests in CI and migration review.

## Explicitly postponed
Chat between strangers, random friend requests, AI opponents, ratings, rewards, rematches, groups, voice/video, AI-generated questions, official proficiency updates, competitive leaderboards, full disconnection recovery. No cross-user data beyond anonymous rival response status and score.
Do not change main roadmap or user skills from informal practice.

## Quality/release acceptance
- Simulate two **real authenticated test accounts** and verify match pairing once, same five questions, server deadlines and grading. This cannot be claimed done from static CI alone.
- Anonymous endpoints return 401; nonparticipant RPC calls forbidden; question answer keys never readable by authenticated users.
- Concurrent join and duplicate submission tests, cancellation, queue timeout, expired match and invalid topic/option checks.
- Review Supabase migration and obtain CI green before applying to the production DB.
- Verify successful Railway deploy and logged startup. If no second signed-in test account is available, mark real two-user test *pending* and don't claim verified multiplayer.
- No artificial learner data, no test account impersonation, no production resets.

## Planned deliverables
- `supabase/migrations/0027_arena_random_duel.sql`
- `lib/domain/arena.ts`
- `app/api/arena/match/route.ts`, `app/api/arena/state/route.ts`, `app/api/arena/answer/route.ts`
- `app/arena/page.tsx` and `components/arena/arena-duel.tsx`
- navigation and protected middleware, `tests/arena-duel.test.mjs`, CI smoke gates.
