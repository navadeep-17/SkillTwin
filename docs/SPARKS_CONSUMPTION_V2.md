# Sparks Consumption v2 — release checklist

This release extends the already-deployed wallet and referral system. It does not introduce payments. All prices are provisional.

## Policy
- 100 welcome Sparks; 50 Sparks to each person after a verified active-goal referral (5 rewards/inviter/calendar month).
- Standard deterministic Journey Chat, stored plans, first career exploration, ordinary tests, saved skill progress, and evidence-triggered replanning remain free.
- Enhanced AI read-tool selection is **opt in**; the first 3 successfully AI-selected responses are free. Subsequent successful AI-selected responses cost 5 Sparks. Deterministic fallback and errors refund the reservation. Proposed mutations are never metered.
- First completed resume analysis is free. Each additional new resume analysis is 15 Sparks, cached completed document analysis is free, and failures release the reservation. Prior completed analyses count toward the free allowance.
- Optional custom role creation costs 25; project defense evaluation costs 15 (existing MVP behavior).
- Weekly refill: 20 Sparks with an explicit claim, at most once every seven days, only when the balance is <= 30. The first refill becomes eligible seven days after wallet creation.
- Credits are reserved atomically in PostgreSQL; all ledgers and usage tables deny direct browser write/read. One active resume analysis per document; quotas count RESERVED and COMPLETED, not REFUNDED.
- **Important**: SKILLTWIN_SPARKS_CHARGING_ENABLED defaults to false. Deploy database migration 0030 first, code next, then validate with controlled accounts before enabling.

## Release gates
1. Run migration 0030 in Supabase and verify checks/RLS/column permissions.
2. Typecheck, production build, existing CI, Sparks tests, and deterministic core workflow regression all pass.
3. Signed-in QA: free standard chat, three free Enhanced AI successful calls, then 5 Spark debit; Gemini fallback is free; 402 with zero balance; concurrent/resubmitted operation id does not double-charge.
4. Signed-in QA: first resume free, second costs 15, failed analysis refunds; cached document does not charge twice.
5. Claim weekly after 7 days and <=30 balance; first claim +20, repeat yields zero, ineligible claims yield zero.
6. Existing paid custom roles and project-defense handling still return 402 on low balance and refund failures.
7. Verify Railway release health, GET /api/sparks UI/permissions, no high 5xx rate. Enable metering only after authenticated QA and a rollback plan.

## Deliberately deferred
Credit purchases, subscriptions, device fraud scoring, daily Spark streak incentives, custom AI assessment generation, and discretionary full roadmap regeneration are not in this release.
