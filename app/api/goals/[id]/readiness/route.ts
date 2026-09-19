import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";

export const dynamic="force-dynamic";

export async function GET(_request:Request,context:{params:Promise<{id:string}>}) {
  const requestId=await getRequestId();
  try {
    const {id}=await context.params;
    const {user,supabase}=await requireUser();
    const {data,error}=await supabase.from("gap_snapshots")
      .select("id,readiness,evidence_coverage,created_at")
      .eq("goal_id",id).eq("user_id",user.id).order("created_at",{ascending:true}).limit(30);
    if (error) throw error;
    return ok(requestId,{current:data?.at(-1) ?? null,trend:data ?? []});
  } catch (error) {
    if (error instanceof UnauthenticatedError) return fail(requestId,401,"UNAUTHENTICATED","Sign in to view readiness.");
    return fail(requestId,500,"READINESS_FAILED","Could not load readiness.");
  }
}
