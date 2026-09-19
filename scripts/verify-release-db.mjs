import postgres from "postgres";

const url=process.env.SUPABASE_DB_URL;
if(!url) throw new Error("SUPABASE_DB_URL is required for qa:db.");

const sql=postgres(url,{max:1,prepare:false,connect_timeout:10});
const expectedTables=[
  "users","user_skills","skill_evidence","skill_history","career_goals","gap_snapshots","skill_gap_results",
  "profile_documents","document_parse_runs","profile_analysis_runs","profile_source_blocks","candidate_skill_claims",
  "profile_projects","profile_manual_sources","unresolved_skill_terms","learning_plans","plan_weeks","learning_objectives",
  "learning_tasks","task_resource_assignments","plan_generation_runs","skill_assessments","skill_assessment_questions",
  "skill_assessment_attempts","skill_assessment_concept_signals","skill_assessment_outcomes","replan_decisions","plan_diffs",
  "journey_chat_threads","journey_chat_messages","chat_action_proposals","agent_events","user_learning_settings",
  "role_generation_runs","resource_feedback","task_activity_events","project_recommendations","weekly_reports","demo_reset_runs"
];

try{
  const metadata=await sql.unsafe("select key,value from public.system_metadata where key in ('schema_contract_version','seed_version','resource_catalog_version','demo_fixture_version')");
  const map=new Map(metadata.map(row=>[row.key,row.value]));
  const expected={
    schema_contract_version:"skilltwin-full-spec-v1",
    seed_version:"seed-2026-09-19-v2",
    resource_catalog_version:"resource-catalog-d2",
    demo_fixture_version:"demo-backend-v1"
  };
  for(const [key,value] of Object.entries(expected)){
    if(map.get(key)!==value) throw new Error("Metadata mismatch for "+key);
  }

  const rls=await sql.unsafe("select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'");
  const rlsMap=new Map(rls.map(row=>[row.relname,row.relrowsecurity]));
  const missing=expectedTables.filter(name=>rlsMap.get(name)!==true);
  if(missing.length) throw new Error("RLS not enabled on: "+missing.join(", "));

  const role=(await sql.unsafe("select count(*)::int count from public.role_versions rv join public.target_roles tr on tr.id=rv.role_id where tr.slug='backend-engineer' and rv.version=1 and rv.status='ACTIVE' and tr.owner_user_id is null"))[0];
  if(Number(role.count)!==1) throw new Error("Backend Engineer v1 seed mismatch.");

  const resources=(await sql.unsafe("select count(*) filter(where is_verified=true and status='ACTIVE' and catalog_version='resource-catalog-d2')::int verified, count(*) filter(where status='ACTIVE' and (is_verified=false or url !~ '^https://'))::int invalid from public.learning_resources"))[0];
  if(Number(resources.verified)<20 || Number(resources.invalid)!==0) throw new Error("Resource catalog invariant failed.");

  const bank=(await sql.unsafe("select count(*)::int count from public.assessment_question_bank where skill_id='10000000-0000-0000-0000-000000000007'::uuid and is_active=true"))[0];
  if(Number(bank.count)<9) throw new Error("REST assessment bank incomplete.");

  const bucket=(await sql.unsafe("select count(*)::int count from storage.buckets where id='profile-documents' and public=false"))[0];
  if(Number(bucket.count)!==1) throw new Error("profile-documents bucket is missing or public.");

  console.log(JSON.stringify({
    ok:true,
    metadata:Object.fromEntries(map),
    rlsTables:expectedTables.length,
    verifiedResources:Number(resources.verified),
    restQuestions:Number(bank.count),
    privateStorage:true
  },null,2));
}finally{
  await sql.end({timeout:2});
}
