# Sparks Canary Charging Test

Keep `SKILLTWIN_SPARKS_CHARGING_ENABLED=false` globally. The optional
`SKILLTWIN_SPARKS_CANARY_USER_IDS` contains **explicitly approved**, comma-separated
UUIDs of authenticated test accounts only. No UUIDs configured means **all users stay free**.

Never choose users by their email, guessed IDs, or heuristics, and never expose
the test user's password/session. Select a dedicated throwaway account, not
a real learner's career/assessment data. Update variable via Railway without
unrelated deployment changes. Charging for a UUID is server-enforced, not
controlled by the browser.

1. Record the test wallet balance and prior Sparks ledger/usage counts.
2. Verify non-canary account still reports `chargingEnabled=false` and no charges.
3. Verify canary wallet reports `chargingEnabled=true`.
4. First three successful Enhanced AI responses cost 0; fourth successful
   AI-selected response costs 5 and produces one AI_ACTION transaction.
5. A forced Gemini fallback or failed AI returns credits; retry IDs cannot charge twice.
6. First resume analysis free; second new successful resume uses 15; cached repeat is free.
7. Ineligible weekly claims return no award; eligible 20-Spark claim is idempotent.
8. Confirm 0 minimum negative balances, wallet balance = 100 + net ledger deltas,
   and no persistent RESERVED operation older than 15 minutes after wallet recovery.

When finished, clear `SKILLTWIN_SPARKS_CANARY_USER_IDS`.
Only enable `SKILLTWIN_SPARKS_CHARGING_ENABLED=true` after verifying *all*
actual authenticated production workflows, getting explicit release approval,
and confirming no account-level discrepancies.

Rollback: set global=false and canaryIds empty, then inspect outstanding
reservations/refunds. Rollback does not delete ledger entries or undo already
completed paid AI operations.
