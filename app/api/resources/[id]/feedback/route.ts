import { z } from "zod";
import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";
import { getSql } from "@/lib/db/postgres";
import { getAdaptiveTriggerService } from "@/lib/services/replanner/adaptive-trigger-service";

const schema=z.object({
  taskId:z.string().uuid(),
  signal:z.enum(["HELPFUL","NOT_HELPFUL","TOO_EASY","TOO_HARD","TOO_LONG","PREFERRED_FORMAT"]),
  metadata:z.record(z.unknown()).optional()
});

export async function POST(request:Request,context:{params:Promise<{id:string}>}) {
  const requestId=await getRequestId();
  try {
    const {id:resourceId}=await context.params;
    const {user}=await requireUser();
    const parsed=schema.safeParse(await request.json());
    if(!parsed.success) return fail(requestId,400,"VALIDATION_ERROR","Invalid resource feedback.",parsed.error.flatten().fieldErrors);
    const sql=getSql();

    const ownership=await sql.unsafe(
      "select t.id from public.learning_tasks t join public.learning_plans p on p.id=t.plan_id left join public.task_resource_assignments a on a.task_id=t.id where t.id=$1::uuid and p.user_id=$2::uuid and a.resource_id=$3::uuid limit 1",
      [parsed.data.taskId,user.id,resourceId]
    ) as Array<Record<string,unknown>>;
    if(!ownership[0]) return fail(requestId,404,"NOT_FOUND","Resource assignment not found for this learner task.");

    const feedback=await sql.unsafe(
      "insert into public.resource_feedback(user_id,resource_id,task_id,signal,metadata) values ($1::uuid,$2::uuid,$3::uuid,$4,$5::jsonb) returning *",
      [user.id,resourceId,parsed.data.taskId,parsed.data.signal,JSON.stringify(parsed.data.metadata ?? {})]
    ) as Array<Record<string,unknown>>;

    let replan:unknown=null;
    try {
      replan=await getAdaptiveTriggerService().considerResourceFeedback({
        userId:user.id,taskId:parsed.data.taskId,signal:parsed.data.signal,feedbackId:String(feedback[0].id)
      });
    } catch(replanError){
      console.error("resource.feedback.replan.failed",{feedbackId:feedback[0].id,error:replanError instanceof Error?replanError.message:String(replanError)});
    }

    return ok(requestId,{feedback:feedback[0],replan},{
      plan_diff:replan && typeof replan==="object" && "changed" in replan && (replan as {changed:boolean}).changed && "diff" in replan
        ? (replan as {diff:unknown}).diff : undefined,
      notifications:[{title:"Resource feedback saved",message:"SkillTwin used this as planning evidence only; it does not lower your skill capability.",tone:"success"}]
    },201);
  } catch(error){
    if(error instanceof UnauthenticatedError) return fail(requestId,401,"UNAUTHENTICATED","Sign in to give resource feedback.");
    console.error("resource.feedback.failed",{requestId,error:error instanceof Error?error.message:String(error)});
    return fail(requestId,500,"RESOURCE_FEEDBACK_FAILED","Could not save resource feedback.");
  }
}
