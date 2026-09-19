import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";
import { getAdaptiveTriggerService } from "@/lib/services/replanner/adaptive-trigger-service";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function POST(_request:Request,context:{params:Promise<{id:string}>}) {
  const requestId=await getRequestId();
  try {
    const {id}=await context.params;
    const {user}=await requireUser();
    const result=await getAdaptiveTriggerService().accept(user.id,id);
    return ok(requestId,result,{
      plan_diff:result.diff,
      notifications:[{title:"Roadmap change applied",message:"The proposed patch passed validation and created a new immutable plan version.",tone:"success"}],
      next_action:{type:"OPEN_ROADMAP",label:"View updated roadmap",href:"/roadmap"}
    });
  } catch(error){
    if(error instanceof UnauthenticatedError) return fail(requestId,401,"UNAUTHENTICATED","Sign in to accept this roadmap change.");
    const message=error instanceof Error?error.message:String(error);
    if(message==="PLAN_DIFF_NOT_FOUND") return fail(requestId,404,"NOT_FOUND","Plan change not found.");
    if(message==="STALE_BASELINE") return fail(requestId,409,"STALE_BASELINE","The roadmap changed since this proposal was created. Re-evaluate the trigger.");
    if(message.startsWith("PLAN_DIFF_VALIDATION_FAILED")) return fail(requestId,409,"PLAN_DIFF_VALIDATION_FAILED","This proposal no longer passes the current roadmap safety validators.");
    console.error("plan.diff.accept.failed",{requestId,error:message});
    return fail(requestId,500,"PLAN_DIFF_ACCEPT_FAILED","Could not apply this roadmap change.");
  }
}
