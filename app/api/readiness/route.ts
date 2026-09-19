import { getRequestId } from "@/lib/api/request-context";
import { ok } from "@/lib/api/responses";
import { getServerEnv } from "@/lib/config/env";
import { getSql } from "@/lib/db/postgres";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const EXPECTED={
  schemaContract:"skilltwin-full-spec-v1",
  seedVersion:"seed-2026-09-19-v2",
  resourceCatalog:"resource-catalog-d2",
  demoFixture:"demo-backend-v1"
};

type Row=Record<string,unknown>;
const rows=(value:unknown)=>value as Row[];

export async function GET(){
  const requestId=await getRequestId();
  const env=getServerEnv();

  let database:"ready"|"missing_config"|"unreachable"="missing_config";
  let metadata:"ready"|"mismatch"|"unknown"="unknown";
  let backendRole:"ready"|"missing"|"unknown"="unknown";
  let resourceCatalog:"ready"|"invalid"|"unknown"="unknown";
  let assessmentBank:"ready"|"incomplete"|"unknown"="unknown";
  let privateStorage:"ready"|"invalid"|"unknown"="unknown";
  const notes:string[]=[];

  if(env.SUPABASE_DB_URL){
    try{
      const sql=getSql();
      const result=rows(await sql.unsafe(`
        select
          (select value from public.system_metadata where key='schema_contract_version') schema_contract,
          (select value from public.system_metadata where key='seed_version') seed_version,
          (select value from public.system_metadata where key='resource_catalog_version') resource_catalog_version,
          (select value from public.system_metadata where key='demo_fixture_version') demo_fixture_version,
          (select count(*)::int from public.role_versions rv join public.target_roles tr on tr.id=rv.role_id where tr.slug='backend-engineer' and rv.version=1 and rv.status='ACTIVE' and tr.owner_user_id is null) backend_role_count,
          (select count(*)::int from public.learning_resources where is_verified=true and status='ACTIVE' and catalog_version='resource-catalog-d2') verified_resource_count,
          (select count(*)::int from public.learning_resources where status='ACTIVE' and (is_verified=false or url !~ '^https://')) invalid_active_resource_count,
          (select count(*)::int from public.assessment_question_bank where skill_id='10000000-0000-0000-0000-000000000007'::uuid and is_active=true) rest_question_count,
          (select count(*)::int from storage.buckets where id='profile-documents' and public=false) private_bucket_count
      `));
      const row=result[0] ?? {};
      database="ready";

      const metadataReady=
        String(row.schema_contract ?? "")===EXPECTED.schemaContract &&
        String(row.seed_version ?? "")===EXPECTED.seedVersion &&
        String(row.resource_catalog_version ?? "")===EXPECTED.resourceCatalog &&
        String(row.demo_fixture_version ?? "")===EXPECTED.demoFixture;
      metadata=metadataReady?"ready":"mismatch";
      backendRole=Number(row.backend_role_count ?? 0)===1?"ready":"missing";

      const verifiedResources=Number(row.verified_resource_count ?? 0);
      const invalidResources=Number(row.invalid_active_resource_count ?? 0);
      resourceCatalog=verifiedResources>=20 && invalidResources===0?"ready":"invalid";

      assessmentBank=Number(row.rest_question_count ?? 0)>=9?"ready":"incomplete";
      privateStorage=Number(row.private_bucket_count ?? 0)===1?"ready":"invalid";

      if(metadata!=="ready") notes.push("Release metadata does not match the candidate contract.");
      if(backendRole!=="ready") notes.push("Seeded Backend Engineer v1 role is missing.");
      if(resourceCatalog!=="ready") notes.push("Verified resource catalog is incomplete or contains an invalid active row.");
      if(assessmentBank!=="ready") notes.push("Seeded REST validation bank is incomplete.");
      if(privateStorage!=="ready") notes.push("Private profile-documents storage bucket check failed.");
    }catch(error){
      database="unreachable";
      notes.push("Database readiness query failed.");
      console.error("readiness.database.failed",{
        requestId,
        error:error instanceof Error?error.message:String(error)
      });
    }
  }else{
    notes.push("Server database configuration is missing.");
  }

  const publicSupabaseConfigured=Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const aiConfigured=env.AI_PROVIDER==="gemini"
    ? Boolean(env.GEMINI_API_KEY)
    : Boolean(env.OPENAI_API_KEY);
  const fallbackEnabled=env.DEMO_FALLBACK_ENABLED==="true";
  const aiMode=aiConfigured?"live":fallbackEnabled?"seeded_fallback":"unavailable";

  const requiredReady=
    database==="ready" &&
    metadata==="ready" &&
    backendRole==="ready" &&
    resourceCatalog==="ready" &&
    assessmentBank==="ready" &&
    privateStorage==="ready" &&
    publicSupabaseConfigured &&
    aiMode!=="unavailable";

  return ok(requestId,{
    status:requiredReady?"ready":"not_ready",
    service:"skilltwin-web",
    appVersion:process.env.VERCEL_GIT_COMMIT_SHA?.slice(0,12) ?? "local",
    checks:{
      publicSupabase:publicSupabaseConfigured?"configured":"missing",
      database,
      schemaContract:metadata,
      seedVersion:metadata,
      backendRole,
      resourceCatalog,
      assessmentBank,
      privateStorage,
      aiMode,
      deterministicFallback:fallbackEnabled?"enabled":"disabled"
    },
    expected:EXPECTED,
    notes
  });
}
