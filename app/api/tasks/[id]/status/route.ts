import { z } from "zod";
import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";
import { getSql } from "@/lib/db/postgres";
import { getEvidenceEngine } from "@/lib/services/skills/evidence-service";

const schema=z.object({
  status:z.enum(["PLANNED","IN_PROGRESS","COMPLETED","SKIPPED"]),
  actualMinutes:z.number().int().min(0).max(1440).nullable().optional(),
  dueAt:z.string().datetime().nullable().optional()
});

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function PATCH(request:Request,context:{params:Promise<{id:string}>}) {
  const requestId=await getRequestId();
  try {
    const {id}=await context.params;
    const {user}=await requireUser();
    const parsed=schema.safeParse(await request.json());
    if(!parsed.success) return fail(requestId,400,"VALIDATION_ERROR","Invalid task update.",parsed.error.flatten().fieldErrors);
    const sql=getSql();
    const taskRows=await sql.unsafe(
      "select t.*,p.status plan_status,p.version plan_version from public.learning_tasks t join public.learning_plans p on p.id=t.plan_id where t.id=$1::uuid and p.user_id=$2::uuid limit 1",
      [id,user.id]
    ) as Array<Record<string,unknown>>;
    const task=taskRows[0];
    if(!task) return fail(requestId,404,"NOT_FOUND","Learning task not found.");
    if(String(task.plan_status)!=="ACTIVE") return fail(requestId,409,"STALE_PLAN_TASK","This task belongs to an older roadmap version.");
    if(String(task.status)==="COMPLETED" && parsed.data.status!=="COMPLETED") return fail(requestId,409,"COMPLETED_IMMUTABLE","Completed task history cannot be rewritten.");
    if(String(task.type)==="VALIDATE" && parsed.data.status==="COMPLETED") return fail(requestId,409,"VALIDATION_REQUIRED","Complete validation tasks through Challenge Me.");

    const fromDue=task.due_at==null?null:String(task.due_at);
    const toDue=Object.prototype.hasOwnProperty.call(parsed.data,"dueAt") ? parsed.data.dueAt ?? null : fromDue;
    const rescheduled=fromDue!==toDue;
    const now=new Date().toISOString();

    await sql.begin(async tx=>{
      await tx.unsafe(
        "update public.learning_tasks set status=$1,started_at=case when $1='IN_PROGRESS' then coalesce(started_at,now()) else started_at end,completed_at=case when $1='COMPLETED' then coalesce(completed_at,now()) else completed_at end,skipped_at=case when $1='SKIPPED' then now() else skipped_at end,actual_minutes=coalesce($2,actual_minutes),due_at=$3::timestamptz,reschedule_count=reschedule_count+case when $4 then 1 else 0 end where id=$5::uuid",
        [parsed.data.status,parsed.data.actualMinutes ?? null,toDue,rescheduled,id]
      );
      const eventType=rescheduled?"RESCHEDULED":parsed.data.status==="IN_PROGRESS"?"STARTED":parsed.data.status==="COMPLETED"?"COMPLETED":parsed.data.status==="SKIPPED"?"SKIPPED":"DURATION_RECORDED";
      await tx.unsafe(
        "insert into public.task_activity_events(user_id,task_id,event_type,from_due_at,to_due_at,actual_minutes,metadata) values ($1::uuid,$2::uuid,$3,$4::timestamptz,$5::timestamptz,$6,$7::jsonb)",
        [user.id,id,eventType,fromDue,toDue,parsed.data.actualMinutes ?? null,JSON.stringify({planVersion:Number(task.plan_version),recordedAt:now})]
      );
      await tx.unsafe(
        "insert into public.agent_events(user_id,event_type,trigger_type,trigger_ref,summary,entity_refs,metadata) values ($1::uuid,$2,'LEARNING_TASK',$3,$4,$5::jsonb,$6::jsonb)",
        [user.id,"task."+eventType.toLowerCase(),id,(eventType==="RESCHEDULED"?"Rescheduled ":"Updated ")+String(task.title)+".",JSON.stringify([{type:"learning_task",id},{type:"learning_plan",id:String(task.plan_id)}]),JSON.stringify({eventType,actualMinutes:parsed.data.actualMinutes ?? null,fromDue,toDue})]
      );
    });

    let evidence=null;
    if(parsed.data.status==="COMPLETED"){
      evidence=await getEvidenceEngine().ingestBatch({
        userId:user.id,
        trigger:{type:"LEARNING_TASK_COMPLETED",ref:id},
        producerVersion:"task-status-h1",
        candidates:[{
          skillId:String(task.skill_id),
          sourceType:"LEARNING_TASK_COMPLETED",
          sourceRef:id,
          sourceGroupId:"task:"+String(task.logical_task_id),
          claim:"Completed roadmap task: "+String(task.title),
          levelSignal:null,
          directness:0.65,quality:0.35,coverage:0.20,
          metadata:{taskId:id,logicalTaskId:String(task.logical_task_id),taskType:String(task.type),actualMinutes:parsed.data.actualMinutes ?? null},
          idempotencyKey:"learning-task:"+String(task.logical_task_id)+":complete"
        }]
      });
    }

    return ok(requestId,{taskId:id,status:parsed.data.status,rescheduled,evidence},{
      skill_delta:evidence?.deltas ?? [],
      notifications:[{title:"Task updated",message:parsed.data.status==="COMPLETED"?"Completion evidence was recorded conservatively.":"Roadmap execution state updated.",tone:"success"}]
    });
  } catch(error){
    if(error instanceof UnauthenticatedError) return fail(requestId,401,"UNAUTHENTICATED","Sign in to update your roadmap.");
    return fail(requestId,500,"TASK_STATUS_FAILED","Could not update this learning task.");
  }
}
