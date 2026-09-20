import "server-only";
import { getSql } from "@/lib/db/postgres";

type Row = Record<string, unknown>;

const criticalTables = [
  "users","user_skills","skill_evidence","skill_history","career_goals",
  "gap_snapshots","skill_gap_results","learning_plans","plan_weeks",
  "learning_objectives","learning_tasks","skill_assessments",
  "skill_assessment_attempts","skill_assessment_outcomes","plan_diffs",
  "agent_events","profile_documents","profile_analysis_runs","profile_projects",
  "profile_manual_sources","project_recommendations","unresolved_skill_terms",
  "weekly_reports","role_generation_runs"
] as const;

const userOwnedReadTables = [
  "user_skills","skill_evidence","skill_history","career_goals","gap_snapshots",
  "skill_gap_results","learning_plans","plan_weeks","learning_objectives",
  "learning_tasks","skill_assessments","skill_assessment_attempts",
  "skill_assessment_outcomes","plan_diffs","agent_events","profile_documents",
  "profile_analysis_runs","profile_projects","profile_manual_sources",
  "project_recommendations","unresolved_skill_terms","weekly_reports",
  "role_generation_runs"
] as const;

const serverOwnedTables = [
  "user_skills","skill_evidence","skill_history","gap_snapshots",
  "skill_gap_results","learning_plans","plan_weeks","learning_objectives",
  "learning_tasks","skill_assessments","skill_assessment_attempts",
  "skill_assessment_outcomes","plan_diffs","agent_events",
  "project_recommendations","weekly_reports","role_generation_runs"
] as const;

const realtimeTables = [
  "user_skills","gap_snapshots","learning_plans","skill_assessments",
  "plan_diffs","agent_events","profile_analysis_runs"
] as const;

function rows(value: unknown): Row[] {
  return value as Row[];
}

function ready(value: boolean) {
  return value ? "ready" as const : "failed" as const;
}

export async function checkDatabaseSecurity() {
  const sql = getSql();

  const [tablesResult, policiesResult, realtimeResult, bucketResult, storagePoliciesResult] = await Promise.all([
    sql.unsafe(
      "select c.relname as table_name,c.relrowsecurity as rls_enabled from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'"
    ),
    sql.unsafe(
      "select tablename,policyname,cmd,roles::text as roles from pg_policies where schemaname='public'"
    ),
    sql.unsafe(
      "select tablename from pg_publication_tables where pubname='supabase_realtime' and schemaname='public'"
    ),
    sql.unsafe(
      "select id,public from storage.buckets where id='profile-documents'"
    ),
    sql.unsafe(
      "select tablename,policyname,cmd,roles::text as roles from pg_policies where schemaname='storage' and tablename='objects'"
    )
  ]);

  const tables = rows(tablesResult);
  const policies = rows(policiesResult);
  const realtime = rows(realtimeResult);
  const buckets = rows(bucketResult);
  const storagePolicies = rows(storagePoliciesResult);

  const tableMap = new Map(tables.map(row => [String(row.table_name), row]));
  const rlsReady = criticalTables.every(table => tableMap.get(table)?.rls_enabled === true);

  const readPoliciesReady = userOwnedReadTables.every(table =>
    policies.some(policy =>
      String(policy.tablename) === table
      && String(policy.cmd) === "SELECT"
      && String(policy.roles).includes("authenticated")
    )
  );

  const serverWriteBoundaryReady = serverOwnedTables.every(table =>
    !policies.some(policy =>
      String(policy.tablename) === table
      && ["INSERT","UPDATE","DELETE","ALL"].includes(String(policy.cmd))
      && String(policy.roles).includes("authenticated")
    )
  );

  const realtimeSet = new Set(realtime.map(row => String(row.tablename)));
  const realtimeReady = realtimeTables.every(table => realtimeSet.has(table));

  const privateStorageReady =
    buckets.length === 1
    && buckets[0]?.public === false
    && storagePolicies.some(policy =>
      String(policy.cmd) === "SELECT"
      && String(policy.roles).includes("authenticated")
    )
    && storagePolicies.some(policy =>
      String(policy.cmd) === "INSERT"
      && String(policy.roles).includes("authenticated")
    );

  const checks = {
    rls: ready(rlsReady),
    authenticatedReads: ready(readPoliciesReady),
    serverOwnedWrites: ready(serverWriteBoundaryReady),
    realtime: ready(realtimeReady),
    privateStorage: ready(privateStorageReady)
  };

  const status = Object.values(checks).every(value => value === "ready")
    ? "ready" as const
    : "failed" as const;

  return {
    status,
    checks,
    counts: {
      criticalRlsTables: criticalTables.length,
      authenticatedReadTables: userOwnedReadTables.length,
      serverOwnedTables: serverOwnedTables.length,
      realtimeTables: realtimeTables.length
    }
  };
}
