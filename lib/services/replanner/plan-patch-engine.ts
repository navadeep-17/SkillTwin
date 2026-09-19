import "server-only";
import { getSql } from "@/lib/db/postgres";

export const PLAN_PATCH_ENGINE_VERSION = "plan-patch-engine-f2";

type Row = Record<string, unknown>;
const rows = (value: unknown) => value as Row[];

export type PlanPatchOperation =
  | {
      type: "ADD_TASK";
      task: {
        objectiveLogicalId: string;
        skillId: string;
        taskType: "LEARN" | "PRACTICE" | "BUILD" | "VALIDATE";
        title: string;
        durationMinutes: number;
        dueAt: string;
        difficulty: "BASIC" | "STANDARD" | "ADVANCED";
        rationaleCode: string;
        flexible?: boolean;
        resourceId?: string | null;
      };
      reasonRefs?: string[];
    }
  | {
      type: "MOVE_TASK";
      taskLogicalId: string;
      before?: { dueAt?: string | null };
      after: { dueAt: string };
      reasonRefs?: string[];
    }
  | {
      type: "REMOVE_TASK";
      taskLogicalId: string;
      reasonCode: "VALIDATED_ABOVE_TARGET" | "DUPLICATE_COVERAGE" | "REPLACED_BY_HIGHER_VALUE_TASK";
      reasonRefs?: string[];
    }
  | {
      type: "CHANGE_DIFFICULTY";
      taskLogicalId: string;
      after: { difficulty: "BASIC" | "STANDARD" | "ADVANCED" };
      reasonRefs?: string[];
    }
  | {
      type: "CHANGE_DURATION";
      taskLogicalId: string;
      after: { durationMinutes: number };
      reasonRefs?: string[];
    }
  | {
      type: "CHANGE_RESOURCE";
      taskLogicalId: string;
      after: { resourceId: string };
      reasonRefs?: string[];
    };

function asOperation(value: unknown): PlanPatchOperation {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_PLAN_OPERATION");
  return value as PlanPatchOperation;
}

function dateOnly(value: unknown) {
  return String(value).slice(0, 10);
}

function weekdayName(value: string) {
  return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][new Date(value).getUTCDay()];
}

function taskStatusMutable(operation: PlanPatchOperation["type"], status: string) {
  if (status === "COMPLETED" || status === "SKIPPED") return false;
  if (status === "IN_PROGRESS") return operation === "CHANGE_RESOURCE" || operation === "CHANGE_DURATION";
  return status === "PLANNED";
}

function difficultyRank(value: string) {
  return ({ BASIC: 1, STANDARD: 2, ADVANCED: 3 } as Record<string, number>)[value] ?? 0;
}

export class PlanPatchEngine {
  async applyDiff(userId: string, diffId: string) {
    const sql = getSql();
    const diffRows = rows(await sql.unsafe(
      "select * from public.plan_diffs where id=$1::uuid and user_id=$2::uuid limit 1",
      [diffId, userId]
    ));
    const diff = diffRows[0];
    if (!diff) throw new Error("PLAN_DIFF_NOT_FOUND");
    if (String(diff.status) === "APPLIED") return this.dto(diff, true);
    if (String(diff.status) !== "PROPOSED") throw new Error("PLAN_DIFF_NOT_APPLICABLE");

    const activeRows = rows(await sql.unsafe(
      "select p.*,g.learning_days,g.preferred_session_minutes,g.min_session_minutes from public.learning_plans p join public.career_goals g on g.id=p.goal_id where p.id=$1::uuid and p.user_id=$2::uuid and p.status='ACTIVE' limit 1",
      [String(diff.from_plan_id), userId]
    ));
    const active = activeRows[0];
    if (!active || Number(active.version) !== Number(diff.from_version)) throw new Error("STALE_BASELINE");

    const [weeksRaw, objectivesRaw, tasksRaw, assignmentsRaw] = await Promise.all([
      sql.unsafe("select * from public.plan_weeks where plan_id=$1::uuid order by week_index",[String(active.id)]),
      sql.unsafe("select * from public.learning_objectives where plan_id=$1::uuid order by created_at,id",[String(active.id)]),
      sql.unsafe("select * from public.learning_tasks where plan_id=$1::uuid order by created_at,id",[String(active.id)]),
      sql.unsafe("select tra.* from public.task_resource_assignments tra join public.learning_tasks t on t.id=tra.task_id where t.plan_id=$1::uuid",[String(active.id)])
    ]);
    const weeks=rows(weeksRaw), objectives=rows(objectivesRaw), tasks=rows(tasksRaw), assignments=rows(assignmentsRaw);
    const operations=(Array.isArray(diff.operations)?diff.operations:[]).map(asOperation);
    if (!operations.length || operations.length > 12) throw new Error("INVALID_PLAN_OPERATION_COUNT");

    const validation=await this.validateOperations({
      active,weeks,objectives,tasks,operations,userId
    });
    if (!validation.valid) {
      throw new Error("PLAN_DIFF_VALIDATION_FAILED:"+validation.errors.join("|"));
    }

    const taskByLogical=new Map(tasks.map(task=>[String(task.logical_task_id),task]));
    const objectiveByLogical=new Map(objectives.map(obj=>[String(obj.logical_objective_id),obj]));
    const weekById=new Map(weeks.map(week=>[String(week.id),week]));
    const assignmentByTaskId=new Map(assignments.map(item=>[String(item.task_id),item]));
    const resourceChanges=new Map<string,string>();
    const removed=new Set<string>();
    const taskChanges=new Map<string,Partial<Row>>();
    const added:Array<Extract<PlanPatchOperation,{type:"ADD_TASK"}>>=[];

    for (const operation of operations) {
      if (operation.type==="ADD_TASK") {
        added.push(operation);
        continue;
      }
      const logicalId=operation.taskLogicalId;
      const current=taskByLogical.get(logicalId)!;
      if (operation.type==="REMOVE_TASK") {
        removed.add(logicalId);
      } else if (operation.type==="MOVE_TASK") {
        taskChanges.set(logicalId,{...(taskChanges.get(logicalId) ?? {}),due_at:operation.after.dueAt,reschedule_count:Number(current.reschedule_count ?? 0)+1});
      } else if (operation.type==="CHANGE_DIFFICULTY") {
        taskChanges.set(logicalId,{...(taskChanges.get(logicalId) ?? {}),difficulty:operation.after.difficulty});
      } else if (operation.type==="CHANGE_DURATION") {
        taskChanges.set(logicalId,{...(taskChanges.get(logicalId) ?? {}),duration_minutes:operation.after.durationMinutes});
      } else if (operation.type==="CHANGE_RESOURCE") {
        resourceChanges.set(logicalId,operation.after.resourceId);
      }
    }

    const simulated = tasks
      .filter(task=>!removed.has(String(task.logical_task_id)))
      .map(task=>({...task,...(taskChanges.get(String(task.logical_task_id)) ?? {})}));
    for (const operation of added) {
      const objective=objectiveByLogical.get(operation.task.objectiveLogicalId)!;
      simulated.push({
        id:"new:"+added.indexOf(operation),
        logical_task_id:"new:"+added.indexOf(operation),
        week_id:objective.week_id,
        objective_id:objective.id,
        skill_id:operation.task.skillId,
        type:operation.task.taskType,
        title:operation.task.title,
        duration_minutes:operation.task.durationMinutes,
        due_at:operation.task.dueAt,
        status:"PLANNED",
        difficulty:operation.task.difficulty,
        flexible:Boolean(operation.task.flexible),
        rationale_code:operation.task.rationaleCode,
        reschedule_count:0
      });
    }

    const simulatedWeekMinutes=new Map<string,number>();
    for (const week of weeks) simulatedWeekMinutes.set(String(week.id),0);
    const weekForDate=(dueAt:unknown, fallbackWeekId:string) => {
      if (!dueAt) return fallbackWeekId;
      const date=dateOnly(dueAt);
      return String(weeks.find(week=>date>=dateOnly(week.start_date)&&date<=dateOnly(week.end_date))?.id ?? fallbackWeekId);
    };
    for (const task of simulated) {
      const weekId=weekForDate(task.due_at,String(task.week_id));
      simulatedWeekMinutes.set(weekId,(simulatedWeekMinutes.get(weekId) ?? 0)+Number(task.duration_minutes));
    }
    for (const [weekId,minutes] of simulatedWeekMinutes) {
      const week=weekById.get(weekId);
      if (!week) throw new Error("PLAN_DIFF_WEEK_NOT_FOUND");
      if (minutes>Number(week.capacity_minutes)) throw new Error("PLAN_DIFF_CAPACITY_EXCEEDED");
    }

    let applied:Row|null=null;
    await sql.begin(async tx=>{
      const locked=rows(await tx.unsafe(
        "select id,version,status from public.learning_plans where id=$1::uuid and user_id=$2::uuid for update",
        [String(active.id),userId]
      ))[0];
      if(!locked || String(locked.status)!=="ACTIVE" || Number(locked.version)!==Number(active.version)) throw new Error("STALE_BASELINE");

      const nextVersion=Number(active.version)+1;
      await tx.unsafe("update public.learning_plans set status='SUPERSEDED' where id=$1::uuid and status='ACTIVE'",[String(active.id)]);

      const latestGap=rows(await tx.unsafe(
        "select id from public.gap_snapshots where goal_id=$1::uuid and user_id=$2::uuid order by created_at desc limit 1",
        [String(active.goal_id),userId]
      ))[0];
      const totalPlanned=simulated.reduce((sum,task)=>sum+Number(task.duration_minutes),0);
      const planRows=rows(await tx.unsafe(
        "insert into public.learning_plans(user_id,goal_id,version,status,start_date,end_date,gap_snapshot_id,constraint_fingerprint,planner_version,generation_key,planned_minutes,adaptation_buffer_minutes,rationale,warnings,parent_plan_id) values ($1::uuid,$2::uuid,$3,'ACTIVE',$4::date,$5::date,$6::uuid,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14::uuid) returning id",
        [
          userId,String(active.goal_id),nextVersion,dateOnly(active.start_date),dateOnly(active.end_date),
          latestGap?.id?String(latestGap.id):String(active.gap_snapshot_id),String(active.constraint_fingerprint),
          String(active.planner_version),"patch:"+diffId+":v"+nextVersion,totalPlanned,Number(active.adaptation_buffer_minutes),
          JSON.stringify(active.rationale ?? {}),JSON.stringify(active.warnings ?? []),String(active.id)
        ]
      ));
      const nextPlanId=String(planRows[0].id);

      const weekMap=new Map<string,string>();
      for(const week of weeks){
        const minutes=simulatedWeekMinutes.get(String(week.id)) ?? 0;
        const inserted=rows(await tx.unsafe(
          "insert into public.plan_weeks(plan_id,week_index,start_date,end_date,capacity_minutes,planned_minutes,focus_skill_ids,rationale) values ($1::uuid,$2,$3::date,$4::date,$5,$6,$7::jsonb,$8) returning id",
          [nextPlanId,Number(week.week_index),dateOnly(week.start_date),dateOnly(week.end_date),Number(week.capacity_minutes),minutes,JSON.stringify(week.focus_skill_ids ?? []),week.rationale==null?null:String(week.rationale)]
        ));
        weekMap.set(String(week.id),String(inserted[0].id));
      }

      const objectiveMap=new Map<string,string>();
      const objectiveLogicalToNewId=new Map<string,string>();
      for(const objective of objectives){
        const inserted=rows(await tx.unsafe(
          "insert into public.learning_objectives(plan_id,week_id,skill_id,requirement_id,type,start_score,target_score,success_criteria,priority_at_creation,status,logical_objective_id) values ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7,$8,$9,$10,$11::uuid) returning id",
          [
            nextPlanId,weekMap.get(String(objective.week_id))!,String(objective.skill_id),String(objective.requirement_id),
            String(objective.type),objective.start_score==null?null:Number(objective.start_score),Number(objective.target_score),
            String(objective.success_criteria),Number(objective.priority_at_creation),String(objective.status),String(objective.logical_objective_id)
          ]
        ));
        objectiveMap.set(String(objective.id),String(inserted[0].id));
        objectiveLogicalToNewId.set(String(objective.logical_objective_id),String(inserted[0].id));
      }

      const oldToNewTask=new Map<string,string>();
      const logicalToNewTask=new Map<string,string>();
      for(const task of simulated.filter(item=>!String(item.id).startsWith("new:"))){
        const original=taskByLogical.get(String(task.logical_task_id))!;
        const targetOldWeekId=weekForDate(task.due_at,String(original.week_id));
        const inserted=rows(await tx.unsafe(
          "insert into public.learning_tasks(plan_id,week_id,objective_id,skill_id,type,title,duration_minutes,due_at,status,difficulty,flexible,rationale_code,inserted_by_plan_diff_id,completed_at,logical_task_id,started_at,skipped_at,actual_minutes,reschedule_count) values ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7,$8::timestamptz,$9,$10,$11,$12,$13::uuid,$14::timestamptz,$15::uuid,$16::timestamptz,$17::timestamptz,$18,$19) returning id",
          [
            nextPlanId,weekMap.get(targetOldWeekId)!,objectiveMap.get(String(original.objective_id))!,String(task.skill_id),
            String(task.type),String(task.title),Number(task.duration_minutes),task.due_at==null?null:String(task.due_at),
            String(task.status),String(task.difficulty),Boolean(task.flexible),String(task.rationale_code),
            task.inserted_by_plan_diff_id==null?null:String(task.inserted_by_plan_diff_id),
            task.completed_at==null?null:String(task.completed_at),String(task.logical_task_id),
            task.started_at==null?null:String(task.started_at),task.skipped_at==null?null:String(task.skipped_at),
            task.actual_minutes==null?null:Number(task.actual_minutes),Number(task.reschedule_count ?? 0)
          ]
        ));
        oldToNewTask.set(String(original.id),String(inserted[0].id));
        logicalToNewTask.set(String(task.logical_task_id),String(inserted[0].id));
      }

      for(const operation of added){
        const originalObjective=objectiveByLogical.get(operation.task.objectiveLogicalId)!;
        const targetWeekId=weekForDate(operation.task.dueAt,String(originalObjective.week_id));
        const inserted=rows(await tx.unsafe(
          "insert into public.learning_tasks(plan_id,week_id,objective_id,skill_id,type,title,duration_minutes,due_at,status,difficulty,flexible,rationale_code,inserted_by_plan_diff_id) values ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7,$8::timestamptz,'PLANNED',$9,$10,$11,$12::uuid) returning id,logical_task_id",
          [
            nextPlanId,weekMap.get(targetWeekId)!,objectiveLogicalToNewId.get(operation.task.objectiveLogicalId)!,
            operation.task.skillId,operation.task.taskType,operation.task.title,operation.task.durationMinutes,operation.task.dueAt,
            operation.task.difficulty,Boolean(operation.task.flexible),operation.task.rationaleCode,diffId
          ]
        ));
        logicalToNewTask.set(String(inserted[0].logical_task_id),String(inserted[0].id));
        if(operation.task.resourceId){
          await tx.unsafe(
            "insert into public.task_resource_assignments(task_id,resource_id,rank_score,ranker_version,explanation) values ($1::uuid,$2::uuid,1,'replan-explicit-f2','Verified resource selected by adaptive replanner.')",
            [String(inserted[0].id),operation.task.resourceId]
          );
        }
      }

      for(const assignment of assignments){
        const originalTask=tasks.find(task=>String(task.id)===String(assignment.task_id));
        if(!originalTask || removed.has(String(originalTask.logical_task_id))) continue;
        const newTaskId=oldToNewTask.get(String(originalTask.id));
        if(!newTaskId) continue;
        const replacement=resourceChanges.get(String(originalTask.logical_task_id));
        await tx.unsafe(
          "insert into public.task_resource_assignments(task_id,resource_id,rank_score,ranker_version,explanation) values ($1::uuid,$2::uuid,$3,$4,$5)",
          [
            newTaskId,replacement ?? String(assignment.resource_id),
            replacement?1:Number(assignment.rank_score),
            replacement?"resource-ranker-f2":String(assignment.ranker_version),
            replacement?"Verified alternative selected after learner/resource signal.":String(assignment.explanation)
          ]
        );
      }
      for(const [logicalId,replacement] of resourceChanges){
        const original=taskByLogical.get(logicalId)!;
        if(assignmentByTaskId.has(String(original.id))) continue;
        const newTaskId=oldToNewTask.get(String(original.id));
        if(newTaskId){
          await tx.unsafe(
            "insert into public.task_resource_assignments(task_id,resource_id,rank_score,ranker_version,explanation) values ($1::uuid,$2::uuid,1,'resource-ranker-f2','Verified alternative selected after learner/resource signal.')",
            [newTaskId,replacement]
          );
        }
      }

      const updated=rows(await tx.unsafe(
        "update public.plan_diffs set to_plan_id=$1::uuid,to_version=$2,status='APPLIED',applied_at=now() where id=$3::uuid and status='PROPOSED' returning *",
        [nextPlanId,nextVersion,diffId]
      ));
      applied=updated[0];

      await tx.unsafe(
        "insert into public.agent_events(user_id,event_type,trigger_type,trigger_ref,summary,entity_refs,evidence_refs,metadata) values ($1::uuid,'plan.adapted',$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb)",
        [
          userId,String(diff.trigger_type),diffId,
          "Roadmap updated from Plan v"+String(active.version)+" to v"+nextVersion+" using "+operations.length+" validated patch operation"+(operations.length===1?"":"s")+".",
          JSON.stringify([{type:"plan_diff",id:diffId},{type:"learning_plan",id:nextPlanId}]),
          JSON.stringify(Array.isArray(diff.evidence_refs)?diff.evidence_refs:[]),
          JSON.stringify({operations:operations.map(item=>item.type),engineVersion:PLAN_PATCH_ENGINE_VERSION})
        ]
      );
    });

    return this.dto(applied!,false);
  }

  private async validateOperations(input:{
    active:Row;weeks:Row[];objectives:Row[];tasks:Row[];operations:PlanPatchOperation[];userId:string;
  }) {
    const errors:string[]=[];
    const taskByLogical=new Map(input.tasks.map(task=>[String(task.logical_task_id),task]));
    const objectiveByLogical=new Map(input.objectives.map(obj=>[String(obj.logical_objective_id),obj]));
    const learningDays=Array.isArray(input.active.learning_days)?input.active.learning_days.map(String):["Mon","Tue","Wed","Thu","Fri","Sat"];
    const planStart=dateOnly(input.active.start_date), planEnd=dateOnly(input.active.end_date);
    const sql=getSql();

    for(const operation of input.operations){
      if(operation.type==="ADD_TASK"){
        const objective=objectiveByLogical.get(operation.task.objectiveLogicalId);
        if(!objective) {errors.push("ADD_TASK_OBJECTIVE_NOT_FOUND");continue;}
        if(String(objective.skill_id)!==operation.task.skillId) errors.push("ADD_TASK_SKILL_OBJECTIVE_MISMATCH");
        if(operation.task.durationMinutes<10 || operation.task.durationMinutes>240) errors.push("ADD_TASK_DURATION_INVALID");
        const date=dateOnly(operation.task.dueAt);
        if(date<planStart || date>planEnd) errors.push("ADD_TASK_OUTSIDE_PLAN");
        if(!learningDays.includes(weekdayName(operation.task.dueAt))) errors.push("ADD_TASK_NON_LEARNING_DAY");
        if(operation.task.resourceId){
          const resource=rows(await sql.unsafe(
            "select id from public.learning_resources where id=$1::uuid and is_verified=true and status='ACTIVE' limit 1",
            [operation.task.resourceId]
          ))[0];
          if(!resource) errors.push("ADD_TASK_RESOURCE_INVALID");
        }
        continue;
      }

      const task=taskByLogical.get(operation.taskLogicalId);
      if(!task) {errors.push(operation.type+"_TASK_NOT_FOUND");continue;}
      if(!taskStatusMutable(operation.type,String(task.status))) {errors.push(operation.type+"_TASK_IMMUTABLE");continue;}

      if(operation.type==="MOVE_TASK"){
        const date=dateOnly(operation.after.dueAt);
        if(date<planStart || date>planEnd) errors.push("MOVE_TASK_OUTSIDE_PLAN");
        if(!learningDays.includes(weekdayName(operation.after.dueAt))) errors.push("MOVE_TASK_NON_LEARNING_DAY");
        if(Number(task.reschedule_count ?? 0)>=4) errors.push("MOVE_TASK_STABILITY_COOLDOWN");
      } else if(operation.type==="REMOVE_TASK"){
        if(String(task.type)==="BUILD") errors.push("REMOVE_BUILD_REQUIRES_MAJOR_CONFIRMATION");
      } else if(operation.type==="CHANGE_DIFFICULTY"){
        if(!["BASIC","STANDARD","ADVANCED"].includes(operation.after.difficulty)) errors.push("CHANGE_DIFFICULTY_INVALID");
        if(Math.abs(difficultyRank(String(task.difficulty))-difficultyRank(operation.after.difficulty))>1) errors.push("CHANGE_DIFFICULTY_TOO_LARGE");
      } else if(operation.type==="CHANGE_DURATION"){
        const preferred=Number(input.active.preferred_session_minutes ?? 60);
        const minimum=Number(input.active.min_session_minutes ?? 20);
        if(operation.after.durationMinutes<Math.min(10,minimum) || operation.after.durationMinutes>Math.max(240,preferred*2)) errors.push("CHANGE_DURATION_INVALID");
      } else if(operation.type==="CHANGE_RESOURCE"){
        const resource=rows(await sql.unsafe(
          "select id from public.learning_resources where id=$1::uuid and is_verified=true and status='ACTIVE' limit 1",
          [operation.after.resourceId]
        ))[0];
        if(!resource) errors.push("CHANGE_RESOURCE_INVALID");
      }
    }
    return {valid:errors.length===0,errors};
  }

  dto(diff:Row,reused:boolean) {
    return {
      changed:true,reused,
      diff:{
        diffId:String(diff.id),status:String(diff.status),fromPlanId:String(diff.from_plan_id),fromVersion:Number(diff.from_version),
        toPlanId:diff.to_plan_id?String(diff.to_plan_id):null,toVersion:diff.to_version==null?null:Number(diff.to_version),
        headline:String(diff.summary),triggerLabel:String(diff.trigger_type),
        whatChanged:Array.isArray(diff.operations)?diff.operations:[],
        weeklyImpact:Array.isArray(diff.weekly_impact)?diff.weekly_impact:[],
        timelineImpact:String(diff.timeline_impact),totalMinuteDelta:Number(diff.total_minute_delta),
        touchCount:Number(diff.touch_count),complexity:String(diff.complexity),canUndo:Boolean(diff.can_undo),reason:String(diff.reason),
        requiresConfirmation:String(diff.status)==="PROPOSED"
      }
    };
  }
}

let engine:PlanPatchEngine|null=null;
export function getPlanPatchEngine(){if(!engine) engine=new PlanPatchEngine();return engine;}
