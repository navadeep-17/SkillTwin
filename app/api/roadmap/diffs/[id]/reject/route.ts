import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";
import { getAdaptiveTriggerService } from "@/lib/services/replanner/adaptive-trigger-service";

export async function POST(_request:Request,context:{params:Promise<{id:string}>}) {
  const requestId=await getRequestId();
  try {
    const {id}=await context.params;
    const {user}=await requireUser();
    const result=await getAdaptiveTriggerService().reject(user.id,id);
    return ok(requestId,result,{
      notifications:[{title:"Current roadmap kept",message:"The proposed adaptation was rejected. No learning-plan version was changed.",tone:"info"}],
      next_action:{type:"OPEN_ROADMAP",label:"Back to roadmap",href:"/roadmap"}
    });
  } catch(error){
    if(error instanceof UnauthenticatedError) return fail(requestId,401,"UNAUTHENTICATED","Sign in to reject this roadmap change.");
    const message=error instanceof Error?error.message:String(error);
    if(message==="PLAN_DIFF_NOT_REJECTABLE") return fail(requestId,409,"PLAN_DIFF_NOT_REJECTABLE","This proposal is no longer pending.");
    return fail(requestId,500,"PLAN_DIFF_REJECT_FAILED","Could not reject this roadmap change.");
  }
}
