import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";
import { getWeeklyReportService } from "@/lib/services/progress/weekly-report-service";

export const dynamic="force-dynamic";

export async function GET() {
  const requestId=await getRequestId();
  try {
    const {user,supabase}=await requireUser();
    const [{data:snapshots,error:snapshotError},{data:history,error:historyError},{data:assessments,error:assessmentError},{data:diffs,error:diffError},weeklyReport] = await Promise.all([
      supabase.from("gap_snapshots").select("id,readiness,evidence_coverage,created_at").eq("user_id",user.id).order("created_at",{ascending:true}).limit(30),
      supabase.from("skill_history").select("id,skill_id,trigger_type,explanation,before_state,after_state,created_at,skills!inner(canonical_name)").eq("user_id",user.id).order("created_at",{ascending:false}).limit(40),
      supabase.from("skill_assessment_outcomes").select("id,skill_id,normalized_score,coverage,assessment_confidence,created_at,skills!inner(canonical_name)").eq("user_id",user.id).order("created_at",{ascending:false}).limit(20),
      supabase.from("plan_diffs").select("id,status,from_version,to_version,summary,total_minute_delta,operations,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(20),
      getWeeklyReportService().getOrGenerate(user.id)
    ]);
    for(const error of [snapshotError,historyError,assessmentError,diffError]) if(error) throw error;
    return ok(requestId,{readinessTrend:snapshots ?? [],recentSkillHistory:history ?? [],assessments:assessments ?? [],roadmapChanges:diffs ?? [],weeklyReport});
  } catch(error){
    if(error instanceof UnauthenticatedError) return fail(requestId,401,"UNAUTHENTICATED","Sign in to view progress.");
    console.error("progress.aggregate.failed",{requestId,error:error instanceof Error?error.message:String(error)});
    return fail(requestId,500,"PROGRESS_FAILED","Could not load progress.");
  }
}
