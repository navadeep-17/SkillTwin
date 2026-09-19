import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";

export const dynamic="force-dynamic";

export async function GET(_request:Request,context:{params:Promise<{id:string}>}) {
  const requestId=await getRequestId();
  try {
    const {id}=await context.params;
    const {user,supabase}=await requireUser();
    const {data:snapshot,error}=await supabase.from("gap_snapshots")
      .select("id,readiness,evidence_coverage,selected_alternatives,created_at")
      .eq("goal_id",id).eq("user_id",user.id).order("created_at",{ascending:false}).limit(1).maybeSingle();
    if (error) throw error;
    if (!snapshot) return ok(requestId,{snapshot:null,gaps:[]});
    const {data:gaps,error:gapError}=await supabase.from("skill_gap_results")
      .select("*,skills!inner(slug,canonical_name,category)")
      .eq("snapshot_id",snapshot.id).order("priority_score",{ascending:false});
    if (gapError) throw gapError;
    return ok(requestId,{snapshot,gaps:gaps ?? []});
  } catch (error) {
    if (error instanceof UnauthenticatedError) return fail(requestId,401,"UNAUTHENTICATED","Sign in to view role gaps.");
    return fail(requestId,500,"GOAL_GAPS_FAILED","Could not load role gaps.");
  }
}
