import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";

export const dynamic="force-dynamic";

export async function GET() {
  const requestId=await getRequestId();
  try {
    const {user,supabase}=await requireUser();
    const [{data:goal,error:goalError},{data:snapshot,error:snapshotError},{data:plan,error:planError},{data:skills,error:skillsError},{data:event,error:eventError}] = await Promise.all([
      supabase.from("career_goals").select("id,career_objective,target_date,hours_per_week,role_version_id,role_versions!inner(target_roles!inner(name,family))").eq("user_id",user.id).eq("status","ACTIVE").limit(1).maybeSingle(),
      supabase.from("gap_snapshots").select("id,readiness,evidence_coverage,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(1).maybeSingle(),
      supabase.from("learning_plans").select("id,version,status,start_date,end_date,planned_minutes,adaptation_buffer_minutes").eq("user_id",user.id).eq("status","ACTIVE").order("version",{ascending:false}).limit(1).maybeSingle(),
      supabase.from("user_skills").select("skill_id,level_value,confidence,conflict_state").eq("user_id",user.id),
      supabase.from("agent_events").select("id,event_type,summary,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(1).maybeSingle()
    ]);
    for(const error of [goalError,snapshotError,planError,skillsError,eventError]) if(error) throw error;

    let gaps:Array<Record<string,unknown>>=[],tasks:Array<Record<string,unknown>>=[];
    if(snapshot?.id){
      const {data,error}=await supabase.from("skill_gap_results").select("skill_id,status,priority_score,priority_band,recommended_action,skills!inner(canonical_name,category)").eq("snapshot_id",snapshot.id).order("priority_score",{ascending:false}).limit(8);
      if(error) throw error; gaps=data ?? [];
    }
    if(plan?.id){
      const {data,error}=await supabase.from("learning_tasks").select("id,title,type,duration_minutes,due_at,status,difficulty,skill_id,skills!inner(canonical_name)").eq("plan_id",plan.id).in("status",["PLANNED","IN_PROGRESS"]).order("due_at",{ascending:true}).limit(8);
      if(error) throw error; tasks=data ?? [];
    }

    const counts={strong:gaps.filter(g=>g.status==="STRONG").length,developing:gaps.filter(g=>g.status==="DEVELOPING").length,gaps:gaps.filter(g=>g.status==="GAP").length};
    const validationCandidate=gaps.find(g=>["VALIDATE","VALIDATE_FIRST"].includes(String(g.recommended_action))) ?? gaps[0] ?? null;

    return ok(requestId,{
      goal,
      snapshot,
      plan,
      skillSummary:{
        tracked:skills?.length ?? 0,
        highConfidence:(skills ?? []).filter(skill=>Number(skill.confidence)>=0.75).length,
        unresolvedConflicts:(skills ?? []).filter(skill=>skill.conflict_state==="UNRESOLVED").length,
        roleStatusCounts:counts
      },
      todayPlan:tasks,
      validationCandidate,
      latestInsight:event ?? null
    });
  } catch(error){
    if(error instanceof UnauthenticatedError) return fail(requestId,401,"UNAUTHENTICATED","Sign in to view your dashboard.");
    console.error("dashboard.failed",{requestId,error:error instanceof Error?error.message:String(error)});
    return fail(requestId,500,"DASHBOARD_FAILED","Could not load dashboard.");
  }
}
