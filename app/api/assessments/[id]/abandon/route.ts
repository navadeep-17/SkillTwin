import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";
import { getAssessmentService } from "@/lib/services/assessment/assessment-service";

export async function POST(_request:Request,context:{params:Promise<{id:string}>}) {
  const requestId=await getRequestId();
  try {
    const {id}=await context.params;
    const {user}=await requireUser();
    return ok(requestId,await getAssessmentService().abandon(user.id,id),{
      notifications:[{title:"Challenge stopped",message:"No SkillTwin capability change was created from the abandoned session.",tone:"info"}],
      next_action:{type:"OPEN_PRACTICE",label:"Back to practice",href:"/practice"}
    });
  } catch(error){
    if(error instanceof UnauthenticatedError) return fail(requestId,401,"UNAUTHENTICATED","Sign in to stop this assessment.");
    const message=error instanceof Error?error.message:String(error);
    if(message==="ASSESSMENT_NOT_ACTIVE") return fail(requestId,409,"ASSESSMENT_NOT_ACTIVE","This assessment is no longer active.");
    return fail(requestId,500,"ASSESSMENT_ABANDON_FAILED","Could not stop this assessment.");
  }
}
