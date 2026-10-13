/**
 * Read-only Agent V2 production release report.
 * Run only in an authorized shell with SUPABASE_DB_URL or DATABASE_URL set.
 * Prints aggregate counts and timings; NEVER prints learner text, user IDs,
 * secrets, message references, assessment answers or SQL diagnostics.
 */
import postgres from "postgres";

const databaseUrl=process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("AGENT_QA_UNAVAILABLE: authorized database connection not configured");
  process.exitCode=2;
} else {
  const sql=postgres(databaseUrl,{max:1,connect_timeout:8,ssl:"require"});
  try {
    const [conversations, modes, actions, reconciliation] = await Promise.all([
      sql`
        select
          (select count(*)::integer from public.journey_chat_threads) as threads,
          (select count(*)::integer from public.journey_chat_messages) as messages,
          (select count(*)::integer from public.journey_chat_messages where role='ASSISTANT') as assistant_messages
      `,
      sql`
        select coalesce(metadata->>'generator','unknown') as mode,
          count(*)::integer as samples,
          round(percentile_cont(0.50) within group (order by (metadata->>'durationMs')::numeric)::numeric) as p50_ms,
          round(percentile_cont(0.95) within group (order by (metadata->>'durationMs')::numeric)::numeric) as p95_ms
        from public.journey_chat_messages
        where role='ASSISTANT'
          and metadata ? 'durationMs'
          and (metadata->>'durationMs') ~ '^[0-9]{1,8}$'
        group by 1 order by 1
      `,
      sql`
        select status,count(*)::integer as total
        from public.chat_action_proposals group by status order by status
      `,
      sql`
        select
          count(*) filter (where p.status='CONFIRMED' and p.created_at<now()-interval '10 minutes')::integer as needs_reconciliation,
          count(*) filter (where p.status='EXECUTED' and e.id is null)::integer as executed_without_event
        from public.chat_action_proposals p
        left join public.agent_events e on e.user_id=p.user_id
          and e.event_type='chat.action.executed' and e.trigger_ref=p.id::text
      `
    ]);

    console.log(JSON.stringify({
      status:"READ_ONLY_AGGREGATES",
      conversations:conversations[0],
      responseLatencyByMode:modes,
      actionStatus:actions,
      actionAudit:reconciliation[0],
      caveats:[
        "Empty timing samples mean actual Gemini selection and latency are unmeasured.",
        "No counts prove cross-user isolation, browser behavior or prompt-injection resilience.",
        "A confirmed action without EXECUTED status may have run; reconcile before retrying."
      ]
    },null,2));
  } catch {
    console.error("AGENT_QA_FAILED: read-only aggregate query failed; no secrets logged");
    process.exitCode=1;
  } finally {
    await sql.end({timeout:5});
  }
}
