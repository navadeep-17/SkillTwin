import { getRequestId } from "@/lib/api/request-context";
import { ok } from "@/lib/api/responses";
import { getServerEnv } from "@/lib/config/env";
import { getSql } from "@/lib/db/postgres";
import { getDeploymentIdentity } from "@/lib/runtime/deployment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = await getRequestId();
  const env = getServerEnv();
  const deployment = getDeploymentIdentity();

  let database: "ready" | "missing_config" | "unreachable" = "missing_config";
  let databaseError: string | null = null;
  let schemaMigration: { version: string; name: string } | null = null;
  let systemMetadata: Record<string, string> = {};

  if (env.SUPABASE_DB_URL) {
    try {
      const sql = getSql();
      await sql.unsafe("select 1 as ready");
      database = "ready";

      const [migrationRows, metadataRows] = await Promise.all([
        sql.unsafe("select version,name from supabase_migrations.schema_migrations order by version desc limit 1") as Promise<Array<Record<string, unknown>>>,
        sql.unsafe("select key,value from public.system_metadata order by key") as Promise<Array<Record<string, unknown>>>
      ]);
      if (migrationRows[0]) {
        schemaMigration = {
          version: String(migrationRows[0].version),
          name: String(migrationRows[0].name)
        };
      }
      systemMetadata = Object.fromEntries(
        metadataRows.map(row => [String(row.key), String(row.value)])
      );
    } catch (error) {
      database = "unreachable";
      databaseError = error instanceof Error ? error.message.slice(0, 180) : "Database check failed";
    }
  }

  const aiConfigured =
    env.AI_PROVIDER === "gemini"
      ? Boolean(env.GEMINI_API_KEY)
      : Boolean(env.OPENAI_API_KEY);

  const requiredReady = database === "ready";

  return ok(requestId, {
    status: requiredReady ? "ready" : "not_ready",
    service: "skilltwin-web",
    ...deployment,
    checks: {
      publicSupabase: "configured",
      database,
      aiEnhancement: aiConfigured ? "configured" : "optional_not_configured",
      deterministicFallback: env.DEMO_FALLBACK_ENABLED === "true" ? "enabled" : "disabled"
    },
    releaseState: {
      schemaMigration,
      schemaContractVersion: systemMetadata.schema_contract_version ?? null,
      seedVersion: systemMetadata.seed_version ?? null,
      resourceCatalogVersion: systemMetadata.resource_catalog_version ?? null,
      demoFixtureVersion: systemMetadata.demo_fixture_version ?? null
    },
    notes: databaseError ? ["Database check failed: " + databaseError] : []
  });
}
