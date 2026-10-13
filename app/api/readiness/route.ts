import { getRequestId } from "@/lib/api/request-context";
import { ok } from "@/lib/api/responses";
import { getServerEnv } from "@/lib/config/env";
import { getSql } from "@/lib/db/postgres";
import { getDeploymentIdentity } from "@/lib/runtime/deployment";
import { checkDatabaseSecurity } from "@/lib/qa/database-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = await getRequestId();
  const startedAt = Date.now();
  const env = getServerEnv();
  const deployment = getDeploymentIdentity();

  let database: "ready" | "missing_config" | "unreachable" = "missing_config";
  let databaseError: string | null = null;
  let schemaMigration: { version: string; name: string } | null = null;
  let systemMetadata: Record<string, string> = {};
  let databaseSecurity: Awaited<ReturnType<typeof checkDatabaseSecurity>> | null = null;
  let databasePingMs: number | null = null;
  let releaseMetadataMs: number | null = null;
  let securityChecksMs: number | null = null;

  if (env.SUPABASE_DB_URL) {
    try {
      const sql = getSql();
      const pingStartedAt = Date.now();
      await sql.unsafe("select 1 as ready");
      databasePingMs = Date.now() - pingStartedAt;
      database = "ready";

      const releaseStartedAt = Date.now();
      const [migrationRows, metadataRows] = await Promise.all([
        sql.unsafe("select version,name from supabase_migrations.schema_migrations order by version desc limit 1") as Promise<Array<Record<string, unknown>>>,
        sql.unsafe("select key,value from public.system_metadata order by key") as Promise<Array<Record<string, unknown>>>
      ]);
      releaseMetadataMs = Date.now() - releaseStartedAt;
      if (migrationRows[0]) {
        schemaMigration = {
          version: String(migrationRows[0].version),
          name: String(migrationRows[0].name)
        };
      }
      systemMetadata = Object.fromEntries(
        metadataRows.map(row => [String(row.key), String(row.value)])
      );

      const securityStartedAt = Date.now();
      databaseSecurity = await checkDatabaseSecurity();
      securityChecksMs = Date.now() - securityStartedAt;
    } catch (error) {
      database = "unreachable";
      databaseError = error instanceof Error ? error.message.slice(0, 180) : "Database check failed";
    }
  }

  const aiConfigured =
    env.AI_PROVIDER === "gemini"
      ? Boolean(env.GEMINI_API_KEY)
      : Boolean(env.OPENAI_API_KEY);

  const requiredReady =
    database === "ready"
    && databaseSecurity?.status === "ready";

  // Only log operation timings and readiness status, never SQL text, secrets,
  // learner data or raw error objects. HTTP response contract is unchanged.
  const durationMs = Date.now() - startedAt;
  if (durationMs > 2500 || !requiredReady) {
    console.warn("readiness.diagnostics", {
      requestId, durationMs, databasePingMs, releaseMetadataMs, securityChecksMs,
      database, securityStatus: databaseSecurity?.status ?? "not_checked"
    });
  }

  return ok(requestId, {
    status: requiredReady ? "ready" : "not_ready",
    service: "skilltwin-web",
    ...deployment,
    checks: {
      publicSupabase: "configured",
      database,
      databaseSecurity: databaseSecurity?.status ?? "not_checked",
      aiEnhancement: aiConfigured ? "configured" : "optional_not_configured",
      deterministicFallback: env.DEMO_FALLBACK_ENABLED === "true" ? "enabled" : "disabled"
    },
    security: databaseSecurity,
    releaseState: {
      schemaMigration,
      schemaContractVersion: systemMetadata.schema_contract_version ?? null,
      seedVersion: systemMetadata.seed_version ?? null,
      resourceCatalogVersion: systemMetadata.resource_catalog_version ?? null,
      demoFixtureVersion: systemMetadata.demo_fixture_version ?? null
    },
    notes: [
      ...(databaseError ? ["Database check failed: " + databaseError] : []),
      ...(databaseSecurity?.status === "failed"
        ? ["Database security invariants are not fully satisfied."]
        : [])
    ]
  });
}
