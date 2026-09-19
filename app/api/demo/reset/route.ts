import { createHash, timingSafeEqual } from "node:crypto";
import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";
import { getServerEnv } from "@/lib/config/env";
import { getSql } from "@/lib/db/postgres";
import { DEMO_FIXTURE_VERSION, getDemoFixtureService } from "@/lib/services/demo/demo-fixture-service";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;

type Row=Record<string,unknown>;
const rows=(value:unknown)=>value as Row[];

function secretMatches(provided:string,expected:string){
  const a=createHash("sha256").update(provided).digest();
  const b=createHash("sha256").update(expected).digest();
  return timingSafeEqual(a,b);
}

export async function POST(request:Request){
  const requestId=await getRequestId();
  let resetRunId:string|null=null;
  let resetUserId:string|null=null;

  try{
    const {user,supabase}=await requireUser();
    resetUserId=user.id;
    const env=getServerEnv();

    if(env.DEMO_FALLBACK_ENABLED!=="true" || !env.DEMO_RESET_SECRET){
      return fail(requestId,404,"NOT_FOUND","Demo reset is not enabled.");
    }
    const provided=request.headers.get("x-skilltwin-demo-secret") ?? "";
    if(!provided || !secretMatches(provided,env.DEMO_RESET_SECRET)){
      return fail(requestId,403,"FORBIDDEN","Invalid demo reset credential.");
    }

    const sql=getSql();
    const runRows=rows(await sql.unsafe(
      "insert into public.demo_reset_runs(user_id,status,fixture_version,commit_sha) values ($1::uuid,'STARTED',$2,$3) returning id",
      [user.id,DEMO_FIXTURE_VERSION,process.env.VERCEL_GIT_COMMIT_SHA?.slice(0,40) ?? "local"]
    ));
    resetRunId=String(runRows[0].id);

    const documentRows=rows(await sql.unsafe(
      "select storage_path from public.profile_documents where user_id=$1::uuid order by created_at",
      [user.id]
    ));
    const storagePaths=documentRows.map(row=>String(row.storage_path ?? "")).filter(Boolean);
    if(storagePaths.length){
      const {error:storageError}=await supabase.storage.from("profile-documents").remove(storagePaths);
      if(storageError) throw new Error("DEMO_RESET_STORAGE_FAILED:"+storageError.message);
    }

    const deleted=await sql.begin(async tx=>{
      const counts:Record<string,number>={};
      async function remove(label:string,query:string){
        const result=await tx.unsafe(query,[user.id]);
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
        [user.id]
      );
      return counts;
    });

    const fixture=await getDemoFixtureService().seed(user.id);
    if(!fixture.verification.ready) throw new Error("DEMO_RESET_VERIFY_FAILED");

    await sql.unsafe(
      "update public.demo_reset_runs set status='READY',verification=$1::jsonb,completed_at=now() where id=$2::uuid and user_id=$3::uuid",
      [JSON.stringify(fixture.verification),resetRunId,user.id]
    );

    return ok(requestId,{
      reset:true,
      demoReady:true,
      resetRunId,
      fixtureVersion:DEMO_FIXTURE_VERSION,
      removedStorageObjects:storagePaths.length,
      deleted,
      fixture
    },{
      notifications:[{
        title:"DEMO READY",
        message:"The learner was reset and the deterministic Backend Engineer baseline passed invariant verification.",
        tone:"success"
      }],
      next_action:{type:"OPEN_OVERVIEW",label:"Open demo baseline",href:"/overview"}
    });
  }catch(error){
    const message=error instanceof Error?error.message:String(error);
    if(error instanceof UnauthenticatedError){
      return fail(requestId,401,"UNAUTHENTICATED","Sign in before resetting demo state.");
    }

    if(resetRunId && resetUserId){
      try{
        const sql=getSql();
        await sql.unsafe(
          "update public.demo_reset_runs set status='FAILED',error_code=$1,error_message=$2,completed_at=now() where id=$3::uuid and user_id=$4::uuid",
          [message.split(":")[0].slice(0,120),message.slice(0,1000),resetRunId,resetUserId]
        );
      }catch(resetLogError){
        console.error("demo.reset.log_failed",{requestId,error:resetLogError instanceof Error?resetLogError.message:String(resetLogError)});
      }
    }

    console.error("demo.reset.failed",{requestId,resetRunId,error:message});
    return fail(requestId,500,"DEMO_RESET_FAILED","Could not reset and verify this demo learner safely.");
  }
}
