import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";

export const dynamic="force-dynamic";

export async function GET(_request:Request,context:{params:Promise<{id:string}>}) {
  const requestId=await getRequestId();
  try {
    const {id}=await context.params;
    const {user,supabase}=await requireUser();
    const {data,error}=await supabase.from("skill_assessment_outcomes")
      .select("*,skills!inner(slug,canonical_name,category),skill_assessments!inner(mode,status,started_at,completed_at)")
      .eq("assessment_id",id).eq("user_id",user.id).maybeSingle();
    if(error) throw error;
    if(!data) return fail(requestId,404,"NOT_FOUND","Completed assessment result not found.");
    return ok(requestId,{result:data});
  } catch(error){
    if(error instanceof UnauthenticatedError) return fail(requestId,401,"UNAUTHENTICATED","Sign in to view this assessment result.");
    return fail(requestId,500,"ASSESSMENT_RESULT_FAILED","Could not load assessment result.");
  }
}
