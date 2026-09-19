import "server-only";
import { createHash } from "node:crypto";
import { getSql } from "@/lib/db/postgres";
import { getPlanPatchEngine, type PlanPatchOperation } from "@/lib/services/replanner/plan-patch-engine";

type Row=Record<string,unknown>;
const rows=(value:unknown)=>value as Row[];

export class PlanUndoService {
  async undo(userId:string,diffId:string){
    const sql=getSql();
    const original=rows(await sql.unsafe(
      "select * from public.plan_diffs where id=$1::uuid and user_id=$2::uuid limit 1",
      [diffId,userId]
    ))[0];
    if(!original) throw new Error("PLAN_DIFF_NOT_FOUND");
    if(String(original.status)!=="APPLIED" || !original.to_plan_id) throw new Error("PLAN_DIFF_NOT_UNDOABLE");

    const active=rows(await sql.unsafe(
      "select * from public.learning_plans where id=$1::uuid and user_id=$2::uuid and status='ACTIVE' limit 1",
      [String(original.to_plan_id),userId]
    ))[0];
    if(!active || Number(active.version)!==Number(original.to_version)) throw new Error("UNDO_STALE_BASELINE");

    const [fromTasksRaw,toTasksRaw,fromObjectivesRaw,toObjectivesRaw,fromAssignmentsRaw,toAssignmentsRaw] = await Promise.all([
      sql.unsafe("select t.*,o.logical_objective_id from public.learning_tasks t join public.learning_objectives o on o.id=t.objective_id where t.plan_id=$1::uuid",[String(original.from_plan_id)]),
      sql.unsafe("select t.*,o.logical_objective_id from public.learning_tasks t join public.learning_objectives o on o.id=t.objective_id where t.plan_id=$1::uuid",[String(original.to_plan_id)]),
      sql.unsafe("select * from public.learning_objectives where plan_id=$1::uuid",[String(original.from_plan_id)]),
      sql.unsafe("select * from public.learning_objectives where plan_id=$1::uuid",[String(original.to_plan_id)]),
      sql.unsafe("select a.* from public.task_resource_assignments a join public.learning_tasks t on t.id=a.task_id where t.plan_id=$1::uuid",[String(original.from_plan_id)]),
      sql.unsafe("select a.* from public.task_resource_assignments a join public.learning_tasks t on t.id=a.task_id where t.plan_id=$1::uuid",[String(original.to_plan_id)])
    ]);
    const fromTasks=rows(fromTasksRaw),toTasks=rows(toTasksRaw);
    const fromObjectives=rows(fromObjectivesRaw),toObjectives=rows(toObjectivesRaw);
    const fromAssignments=rows(fromAssignmentsRaw),toAssignments=rows(toAssignmentsRaw);

    const fromByLogical=new Map(fromTasks.map(task=>[String(task.logical_task_id),task]));
    const toByLogical=new Map(toTasks.map(task=>[String(task.logical_task_id),task]));
    const fromObjById=new Map(fromObjectives.map(obj=>[String(obj.id),obj]));
    const toObjById=new Map(toObjectives.map(obj=>[String(obj.id),obj]));
    const fromAssignByTask=new Map(fromAssignments.map(item=>[String(item.task_id),item]));
    const toAssignByTask=new Map(toAssignments.map(item=>[String(item.task_id),item]));

    const operations:PlanPatchOperation[]=[];

    for(const [logicalId,toTask] of toByLogical){
      const fromTask=fromByLogical.get(logicalId);
      if(!fromTask){
        operations.push({
          type:"REMOVE_TASK",
          taskLogicalId:logicalId,
          reasonCode:"REPLACED_BY_HIGHER_VALUE_TASK",
          reasonRefs:[diffId,"undo:new-task"]
        });
        continue;
      }

      if(String(fromTask.due_at ?? "")!==String(toTask.due_at ?? "")){
        if(!fromTask.due_at) throw new Error("UNDO_UNSUPPORTED_NULL_DUE_DATE");
        operations.push({
          type:"MOVE_TASK",
          taskLogicalId:logicalId,
          before:{dueAt:toTask.due_at==null?null:String(toTask.due_at)},
          after:{dueAt:String(fromTask.due_at)},
          reasonRefs:[diffId,"undo:move"]
        });
      }
      if(String(fromTask.difficulty)!==String(toTask.difficulty)){
        operations.push({
          type:"CHANGE_DIFFICULTY",
          taskLogicalId:logicalId,
          after:{difficulty:String(fromTask.difficulty) as "BASIC"|"STANDARD"|"ADVANCED"},
          reasonRefs:[diffId,"undo:difficulty"]
        });
      }
      if(Number(fromTask.duration_minutes)!==Number(toTask.duration_minutes)){
        operations.push({
          type:"CHANGE_DURATION",
          taskLogicalId:logicalId,
          after:{durationMinutes:Number(fromTask.duration_minutes)},
          reasonRefs:[diffId,"undo:duration"]
        });
      }

      const fromAssignment=fromAssignByTask.get(String(fromTask.id));
      const toAssignment=toAssignByTask.get(String(toTask.id));
      const fromResource=fromAssignment?.resource_id==null?null:String(fromAssignment.resource_id);
      const toResource=toAssignment?.resource_id==null?null:String(toAssignment.resource_id);
      if(fromResource!==toResource){
        if(!fromResource) throw new Error("UNDO_UNSUPPORTED_RESOURCE_REMOVAL");
        operations.push({
          type:"CHANGE_RESOURCE",
          taskLogicalId:logicalId,
          after:{resourceId:fromResource},
          reasonRefs:[diffId,"undo:resource"]
        });
      }
    }

    for(const [logicalId,fromTask] of fromByLogical){
      if(toByLogical.has(logicalId)) continue;
      const fromObjective=fromObjById.get(String(fromTask.objective_id));
      if(!fromObjective) throw new Error("UNDO_OBJECTIVE_NOT_FOUND");
      const fromAssignment=fromAssignByTask.get(String(fromTask.id));
      if(!fromTask.due_at) throw new Error("UNDO_UNSUPPORTED_NULL_DUE_DATE");
      operations.push({
        type:"ADD_TASK",
        task:{
          objectiveLogicalId:String(fromObjective.logical_objective_id),
          skillId:String(fromTask.skill_id),
          taskType:String(fromTask.type) as "LEARN"|"PRACTICE"|"BUILD"|"VALIDATE",
          title:String(fromTask.title),
          durationMinutes:Number(fromTask.duration_minutes),
          dueAt:String(fromTask.due_at),
          difficulty:String(fromTask.difficulty) as "BASIC"|"STANDARD"|"ADVANCED",
          rationaleCode:"UNDO_RESTORE_TASK",
          flexible:Boolean(fromTask.flexible),
          resourceId:fromAssignment?.resource_id==null?null:String(fromAssignment.resource_id)
        },
        reasonRefs:[diffId,"undo:restore-task"]
      });
    }

    if(!operations.length) throw new Error("UNDO_NO_DIFFERENCE");
    if(operations.length>12) throw new Error("UNDO_TOO_COMPLEX");

    const fingerprint=createHash("sha256").update(JSON.stringify({
      originalDiffId:diffId,
      activePlanId:String(active.id),
      activeVersion:Number(active.version),
      inverseOperations:operations,
      version:"plan-undo-f2"
    })).digest("hex");
    const existing=rows(await sql.unsafe(
      "select * from public.plan_diffs where user_id=$1::uuid and input_fingerprint=$2 limit 1",
      [userId,fingerprint]
    ))[0];
    if(existing){
      if(String(existing.status)==="APPLIED") return getPlanPatchEngine().dto(existing,true);
      return getPlanPatchEngine().applyDiff(userId,String(existing.id));
    }

    const totalMinuteDelta=operations.reduce((sum,operation)=>{
      if(operation.type==="ADD_TASK") return sum+operation.task.durationMinutes;
      if(operation.type==="REMOVE_TASK"){
        const task=toByLogical.get(operation.taskLogicalId);
        return sum-Number(task?.duration_minutes ?? 0);
      }
      if(operation.type==="CHANGE_DURATION"){
        const task=toByLogical.get(operation.taskLogicalId);
        return sum+operation.after.durationMinutes-Number(task?.duration_minutes ?? 0);
      }
      return sum;
    },0);

    const diffRows=rows(await sql.unsafe(
      "insert into public.plan_diffs(user_id,goal_id,from_plan_id,from_version,status,trigger_type,trigger_refs,evidence_refs,summary,reason,operations,weekly_impact,timeline_impact,total_minute_delta,touch_count,complexity,can_undo,generator_version,validator_version,input_fingerprint) values ($1::uuid,$2::uuid,$3::uuid,$4,'PROPOSED','UNDO',$5::jsonb,$6::jsonb,$7,$8,$9::jsonb,'[]'::jsonb,'NONE',$10,$11,$12,false,'plan-undo-f2','replan-validator-f2',$13) returning *",
      [
        userId,String(active.goal_id),String(active.id),Number(active.version),
        JSON.stringify([diffId]),JSON.stringify(Array.isArray(original.evidence_refs)?original.evidence_refs:[]),
        "Undo roadmap change",
        "Create a compensating immutable plan version that restores the previous future-plan state where task progress still allows it.",
        JSON.stringify(operations),totalMinuteDelta,operations.length,operations.length>3?"MAJOR":"MINOR",fingerprint
      ]
    ));
    const undoDiffId=String(diffRows[0].id);
    const applied=await getPlanPatchEngine().applyDiff(userId,undoDiffId);

    await sql.begin(async tx=>{
      await tx.unsafe(
        "update public.plan_diffs set status='UNDONE',can_undo=false where id=$1::uuid and user_id=$2::uuid",
        [diffId,userId]
      );
      await tx.unsafe(
        "insert into public.agent_events(user_id,event_type,trigger_type,trigger_ref,summary,entity_refs,evidence_refs,metadata) values ($1::uuid,'plan.undo.applied','UNDO',$2,$3,$4::jsonb,$5::jsonb,$6::jsonb)",
        [
          userId,diffId,
          "Created a compensating roadmap version from "+operations.length+" inverse operation"+(operations.length===1?"":"s")+".",
          JSON.stringify([{type:"plan_diff",id:undoDiffId},{type:"plan_diff",id:diffId},{type:"learning_plan",id:applied.diff.toPlanId}]),
          JSON.stringify(Array.isArray(original.evidence_refs)?original.evidence_refs:[]),
          JSON.stringify({inverseOperations:operations.map(operation=>operation.type)})
        ]
      );
    });
    return applied;
  }
}

let service:PlanUndoService|null=null;
export function getPlanUndoService(){if(!service) service=new PlanUndoService();return service;}
