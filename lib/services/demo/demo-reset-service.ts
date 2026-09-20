import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSql } from "@/lib/db/postgres";
import { DEMO_FIXTURE_VERSION, getDemoFixtureService } from "@/lib/services/demo/demo-fixture-service";

type Row=Record<string,unknown>;
const rows=(value:unknown)=>value as Row[];

export class DemoResetService{
  async reset(input:{userId:string;supabase:SupabaseClient;commitSha?:string|null}){
    const sql=getSql();
    const runRows=rows(await sql.unsafe(
      "insert into public.demo_reset_runs(user_id,status,fixture_version,commit_sha) values ($1::uuid,'STARTED',$2,$3) returning id",
      [input.userId,DEMO_FIXTURE_VERSION,input.commitSha?.slice(0,40) ?? "local"]
    ));
    const resetRunId=String(runRows[0].id);

    try{
      const documentRows=rows(await sql.unsafe(
        "select storage_path from public.profile_documents where user_id=$1::uuid order by created_at",
        [input.userId]
      ));
      const storagePaths=documentRows.map(row=>String(row.storage_path ?? "")).filter(Boolean);
      if(storagePaths.length){
        const {error:storageError}=await input.supabase.storage.from("profile-documents").remove(storagePaths);
        if(storageError) throw new Error("DEMO_RESET_STORAGE_FAILED:"+storageError.message);
      }

      const deleted=await sql.begin(async tx=>{
        const counts:Record<string,number>={};
        async function remove(label:string,query:string){
          const result=await tx.unsafe(query,[input.userId]);
          counts[label]=Number(result.count ?? 0);
        }

        await remove("journeyThreads","delete from public.journey_chat_threads where user_id=$1::uuid");
        await remove("assessments","delete from public.skill_assessments where user_id=$1::uuid");
        await remove("resourceFeedback","delete from public.resource_feedback where user_id=$1::uuid");
        await remove("taskActivity","delete from public.task_activity_events where user_id=$1::uuid");
        await remove("projectRecommendations","delete from public.project_recommendations where user_id=$1::uuid");
        await remove("weeklyReports","delete from public.weekly_reports where user_id=$1::uuid");
        await remove("replanDecisions","delete from public.replan_decisions where user_id=$1::uuid");
        await remove("planDiffs","delete from public.plan_diffs where user_id=$1::uuid");
        await remove("planGenerationRuns","delete from public.plan_generation_runs where user_id=$1::uuid");
        await remove("learningPlans","delete from public.learning_plans where user_id=$1::uuid");
        await remove("skillGapResults","delete from public.skill_gap_results where user_id=$1::uuid");
        await remove("gapSnapshots","delete from public.gap_snapshots where user_id=$1::uuid");
        await remove("careerGoals","delete from public.career_goals where user_id=$1::uuid");
        await remove("profileProjects","delete from public.profile_projects where user_id=$1::uuid");
        await remove("profileAnalysisRuns","delete from public.profile_analysis_runs where user_id=$1::uuid");
        await remove("manualProfileSources","delete from public.profile_manual_sources where user_id=$1::uuid");
        await remove("profileDocuments","delete from public.profile_documents where user_id=$1::uuid");
        await remove("skillHistory","delete from public.skill_history where user_id=$1::uuid");
        await remove("skillEvidence","delete from public.skill_evidence where user_id=$1::uuid");
        await remove("userSkills","delete from public.user_skills where user_id=$1::uuid");
        await remove("roleGenerationRuns","delete from public.role_generation_runs where user_id=$1::uuid");
        await remove("agentEvents","delete from public.agent_events where user_id=$1::uuid");
        await remove("learningSettings","delete from public.user_learning_settings where user_id=$1::uuid");
        await remove("customRoles","delete from public.target_roles where owner_user_id=$1::uuid");

        await tx.unsafe(
          "update public.users set onboarding_step=0,onboarding_completed_at=null where id=$1::uuid",
          [input.userId]
        );
        return counts;
      });

      const fixture=await getDemoFixtureService().seed(input.userId);
      if(!fixture.verification.ready) throw new Error("DEMO_RESET_VERIFY_FAILED");

      await sql.unsafe(
        "update public.demo_reset_runs set status='READY',verification=$1::jsonb,completed_at=now() where id=$2::uuid and user_id=$3::uuid",
        [JSON.stringify(fixture.verification),resetRunId,input.userId]
      );

      return {
        reset:true,
        demoReady:true,
        resetRunId,
        fixtureVersion:DEMO_FIXTURE_VERSION,
        removedStorageObjects:storagePaths.length,
        deleted,
        fixture
      };
    }catch(error){
      const message=error instanceof Error?error.message:String(error);
      try{
        await sql.unsafe(
          "update public.demo_reset_runs set status='FAILED',error_code=$1,error_message=$2,completed_at=now() where id=$3::uuid and user_id=$4::uuid",
          [message.split(":")[0].slice(0,120),message.slice(0,1000),resetRunId,input.userId]
        );
      }catch(logError){
        console.error("demo.reset.log_failed",{resetRunId,error:logError instanceof Error?logError.message:String(logError)});
      }
      throw error;
    }
  }
}

let service:DemoResetService|null=null;
export function getDemoResetService(){if(!service) service=new DemoResetService();return service;}
