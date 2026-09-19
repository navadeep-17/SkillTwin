import { getRequestId } from "@/lib/api/request-context";
import { fail,ok } from "@/lib/api/responses";
import { requireUser,UnauthenticatedError } from "@/lib/auth/require-user";
import { getGapAnalysisService } from "@/lib/services/gaps/gap-analysis-service";

export const dynamic="force-dynamic";

export async function GET(){
  const requestId=await getRequestId();
  try{
    const {user}=await requireUser();
    return ok(requestId,{analysis:await getGapAnalysisService().latest(user.id)});
  }catch(error){
    if(error instanceof UnauthenticatedError) return fail(requestId,401,"UNAUTHENTICATED","Sign in to view gap analysis.");
    console.error("gaps.read.failed",{requestId,error:error instanceof Error?error.message:String(error)});
    return fail(requestId,500,"INTERNAL_ERROR","Could not load gap analysis.");
  }
}
