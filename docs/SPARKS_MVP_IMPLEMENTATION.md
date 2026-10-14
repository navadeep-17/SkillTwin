# SkillTwin Sparks — 90-minute MVP execution plan

## Product scope
- Each authenticated learner receives 100 welcome Sparks once, lazily at first wallet access or paid action.
- Career browsing, initial role onboarding, original resume analysis, roadmap, study progress, routine assessments and evidence-driven replan stay free.
- Meter only optional custom role generation (25) and optional project defense evaluation (15) in this pilot.
- Each qualifying invitation gives the inviter and invitee 50 Sparks, after the invitee verifies email, signs in and activates a career goal. Maximum 5 rewarded invitations per inviter per calendar month.
- Never lock an existing roadmap or saved progress behind credits; no payments or credit packs in MVP.

## Build order and acceptance
1. Migration 0029: wallet, append-only transaction history, referral ledger, no direct browser privileges.
2. Server wallet service: atomic new-user grant, atomic nonnegative deduction, idempotent refund, one-time referral award, monthly cap and no self-referral.
3. Auth: capture referral code when account is first created; wallet endpoint activates only verified goal-bearing invitees.
4. Client: /sparks wallet, history, costs, and invitation link; desktop navigation.
5. Meter advanced actions, return actionable 402 error when insufficient, refund on unsuccessful operation.
6. Pilot feature flag: metering is OFF by default (SKILLTWIN_SPARKS_CHARGING_ENABLED=true only after authenticated QA).\n7. CI: TS production build, sparks domain assertions, authorization and boundary checks. Keep production unchanged until migration deployed and authenticated acceptance tests pass.

## Operational constraints
- Existing accounts also receive welcome Sparks when they first use the wallet.
- Referral codes in signup metadata are treated as untrusted: validate format and verify inviter, email and saved career goal server-side.
- Credit state never comes from the browser. Deduction/referral awards use PostgreSQL row locks and unique transaction keys.
- Failed AI calls refund idempotently; logs must never contain resume, project defense answers, or sensitive data.
- Rewards are provisional MVP growth incentives; stronger device/account fraud scoring, periodic replenishment, paid plans and financial analytics are deferred.
- Migration must precede release. Feature branch and PR CI alone do not establish production correctness.

## Essential manual acceptance checks
- Two GETs /api/sparks leave balance 100, exactly one WELCOME ledger entry.
- A 25 Spark custom role leaves 75; failed role generation restores 100.
- Balance below price returns 402 without invoking AI.
- Repeating the same operation key never charges twice.
- Verified invitee + real goal earns 50 each once; unverified, no goal, and self-invites earn zero.
- Account A cannot read or mutate account B's wallet, referrals, or ledger.
- Existing roadmap, challenges and reports work when balance is zero.
