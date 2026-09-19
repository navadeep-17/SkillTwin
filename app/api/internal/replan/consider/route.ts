import { z } from "zod";
import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";
import { getAdaptiveTriggerService } from "@/lib/services/replanner/adaptive-trigger-service";

const schema=z.discriminatedUnion("triggerType",[
  z.object({triggerType:z.literal("TASK_BEHAVIOR"),taskId:z.string().uuid()}),
  z.object({triggerType:z.literal("SKILL_CONFLICT"),skillId:z.string().uuid(),triggerRef:z.string().min(1).max(240)})
]);

export async function POST(request:Request) {
  const requestId=await getRequestId();
  try {
    const {user}=await requireUser();
    const parsed=schema.safeParse(await request.json());
    if(!parsed.success) return fail(requestId,400,"VALIDATION_ERROR","Invalid replan trigger.",parsed.error.flatten().fieldErrors);
    const result=parsed.data.triggerType==="TASK_BEHAVIOR"
      ? await getAdaptiveTriggerService().considerTaskBehavior({userId:user.id,taskId:parsed.data.taskId})
      : await getAdaptiveTriggerService().considerSkillConflict({userId:user.id,skillId:parsed.data.skillId,triggerRef:parsed.data.triggerRef});
    return ok(requestId,result,result.changed && "diff" in result ? {plan_diff:result.diff}:undefined);
  } catch(error){
    if(error instanceof UnauthenticatedError) return fail(requestId,401,"UNAUTHENTICATED","Sign in to evaluate a replan trigger.");
    return fail(requestId,500,"REPLAN_CONSIDER_FAILED","Could not evaluate this replan trigger.");
  }
}
