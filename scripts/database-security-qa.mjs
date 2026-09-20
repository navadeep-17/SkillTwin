import postgres from "postgres";

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error("DB_QA=SKIPPED (SUPABASE_DB_URL is not configured)");
  process.exit(2);
}

const sql = postgres(connectionString, {
  ssl: "require",
  max: 1,
  connect_timeout: 10,
  idle_timeout: 5
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const criticalTables = [
  "users","user_skills","skill_evidence","skill_history","career_goals",
  "gap_snapshots","skill_gap_results","learning_plans","plan_weeks",
  "learning_objectives","learning_tasks","skill_assessments",
  "skill_assessment_attempts","skill_assessment_outcomes","plan_diffs",
  "agent_events","profile_documents","profile_analysis_runs","profile_projects",
  "profile_manual_sources","project_recommendations","unresolved_skill_terms",
  "weekly_reports","role_generation_runs"
];

const userOwnedReadTables = [
  "user_skills","skill_evidence","skill_history","career_goals","gap_snapshots",
  "skill_gap_results","learning_plans","plan_weeks","learning_objectives",
  "learning_tasks","skill_assessments","skill_assessment_attempts",
  "skill_assessment_outcomes","plan_diffs","agent_events","profile_documents",
  "profile_analysis_runs","profile_projects","profile_manual_sources",
  "project_recommendations","unresolved_skill_terms","weekly_reports",
  "role_generation_runs"
];

const serverOwnedTables = [
  "user_skills","skill_evidence","skill_history","gap_snapshots",
  "skill_gap_results","learning_plans","plan_weeks","learning_objectives",
  "learning_tasks","skill_assessments","skill_assessment_attempts",
  "skill_assessment_outcomes","plan_diffs","agent_events",
  "project_recommendations","weekly_reports","role_generation_runs"
];

const realtimeTables = [
  "user_skills","gap_snapshots","learning_plans","skill_assessments",
  "plan_diffs","agent_events","profile_analysis_runs"
];

try {
  const tables = await sql.unsafe(
    "select c.relname as table_name,c.relrowsecurity as rls_enabled from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'"
  );
  const tableMap = new Map(tables.map(row => [row.table_name, row]));

  for (const table of criticalTables) {
    const row = tableMap.get(table);
    assert(Boolean(row), "missing critical table: " + table);
    assert(row.rls_enabled === true, "RLS is not enabled on " + table);
  }

  const policies = await sql.unsafe(
    "select tablename,policyname,cmd,roles::text as roles,qual,with_check from pg_policies where schemaname='public'"
  );

  for (const table of userOwnedReadTables) {
    const hasRead = policies.some(policy =>
      policy.tablename === table
      && policy.cmd === "SELECT"
      && String(policy.roles).includes("authenticated")
    );
    assert(hasRead, "missing authenticated SELECT policy for " + table);
  }

  for (const table of serverOwnedTables) {
    const unsafeWrite = policies.find(policy =>
      policy.tablename === table
      && ["INSERT","UPDATE","DELETE","ALL"].includes(policy.cmd)
      && String(policy.roles).includes("authenticated")
    );
    assert(!unsafeWrite, "server-owned table exposes authenticated write policy: " + table + "/" + unsafeWrite?.policyname);
  }

  const realtime = await sql.unsafe(
    "select tablename from pg_publication_tables where pubname='supabase_realtime' and schemaname='public'"
  );
  const realtimeSet = new Set(realtime.map(row => row.tablename));
  for (const table of realtimeTables) {
    assert(realtimeSet.has(table), "missing realtime publication table: " + table);
  }

  const buckets = await sql.unsafe(
    "select id,public from storage.buckets where id='profile-documents'"
  );
  assert(buckets.length === 1, "profile-documents storage bucket is missing");
  assert(buckets[0].public === false, "profile-documents storage bucket must remain private");

  const storagePolicies = await sql.unsafe(
    "select tablename,policyname,cmd,roles::text as roles,qual,with_check from pg_policies where schemaname='storage' and tablename='objects'"
  );
  const hasStorageSelect = storagePolicies.some(policy =>
    policy.cmd === "SELECT" && String(policy.roles).includes("authenticated")
  );
  const hasStorageInsert = storagePolicies.some(policy =>
    policy.cmd === "INSERT" && String(policy.roles).includes("authenticated")
  );
  assert(hasStorageSelect, "missing authenticated storage SELECT policy");
  assert(hasStorageInsert, "missing authenticated storage INSERT policy");

  console.log("DB_QA=PASS");
  console.log("RLS_TABLES=" + criticalTables.length);
  console.log("REALTIME_TABLES=" + realtimeTables.length);
  console.log("PRIVATE_PROFILE_BUCKET=PASS");
} finally {
  await sql.end({ timeout: 2 });
}
