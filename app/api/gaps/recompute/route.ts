import { getRequestId } from "@/lib/api/request-context";
import { fail,ok } from "@/lib/api/responses";
import { requireUser,UnauthenticatedError } from "@/lib/auth/require-user";
import { getGapAnalysisService } from "@/lib/services/gaps/gap-analysis-service";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function POST(){
  const requestId=await getRequestId();
  try{
    const {user}=await requireUser();
    const result=await getGapAnalysisService().recompute(user.id,{type:"MANUAL_RECOMPUTE",ref:requestId});
    return ok(requestId,result,{notifications:[{title:"Gap analysis updated",message:`Career readiness is ${result.readiness}%.`,tone:"success"}]});
  }catch(error){
    if(error instanceof UnauthenticatedError) return fail(requestId,401,"UNAUTHENTICATED","Sign in to analyze your target-role gaps.");
    console.error("gaps.recompute.failed",{requestId,error:error instanceof Error?error.message:String(error)});
    return fail(requestId,500,"GAP_ANALYSIS_FAILED","Could not recompute role gaps.");
  }
}
