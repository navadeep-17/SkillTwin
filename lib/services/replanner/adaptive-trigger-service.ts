import "server-only";
import { createHash } from "node:crypto";
import { getSql } from "@/lib/db/postgres";
import { getPlanPatchEngine, type PlanPatchOperation } from "@/lib/services/replanner/plan-patch-engine";

export const REPLAN_TRIGGER_VERSION = "replan-trigger-f2";
export const REPLAN_SELECTOR_VERSION = "replan-selector-f1";

type Row=Record<string,unknown>;
const rows=(value:unknown)=>value as Row[];

function lowerDifficulty(value:string) {
  return value==="ADVANCED"?"STANDARD":"BASIC";
}
function raiseDifficulty(value:string) {
  return value==="BASIC"?"STANDARD":"ADVANCED";
}
function addDays(iso:string,days:number) {
  const date=new Date(iso); date.setUTCDate(date.getUTCDate()+days); return date.toISOString();
}
function jsonStrings(value:unknown){return Array.isArray(value)?value.map(String):[];}

type ActiveContext={
  active:Row;
  futureTasks:Row[];
  objectives:Row[];
};

export class AdaptiveTriggerService {
  async considerAssessment(input:{
    userId:string;
    assessmentId:string;
    skillId:string;
    weaknesses:string[];
    strengths?:string[];
    normalizedScore?:number;
    assessmentConfidence?:number;
    evidenceIds:string[];
    gapSnapshotId?:string|null;
  }) {
    const context=await this.activeContext(input.userId);
    if(!context) return this.noOp(input.userId,"ASSESSMENT_COMPLETED",input.assessmentId,"NO_ACTIVE_PLAN","No active roadmap exists to adapt.",null);
    const {active,futureTasks,objectives}=context;
    const skillTasks=futureTasks.filter(task=>String(task.skill_id)===input.skillId);
    const score=input.normalizedScore ?? 0.5;
    const assessmentConfidence=input.assessmentConfidence ?? 0.5;

    if(score>=0.85 && assessmentConfidence>=0.80){
      const redundant=skillTasks.find(task=>String(task.status)==="PLANNED" && String(task.type)==="LEARN")
        ?? skillTasks.find(task=>String(task.status)==="PLANNED" && String(task.type)==="PRACTICE" && String(task.difficulty)!=="ADVANCED");
      if(!redundant) return this.noOp(input.userId,"ASSESSMENT_COMPLETED",input.assessmentId,"NO_REDUNDANT_FUTURE_WORK","Strong validation found no redundant mutable future work.",active);
      const operation:PlanPatchOperation=String(redundant.type)==="LEARN"
        ? {type:"REMOVE_TASK",taskLogicalId:String(redundant.logical_task_id),reasonCode:"VALIDATED_ABOVE_TARGET",reasonRefs:[input.assessmentId,...input.evidenceIds]}
        : {type:"CHANGE_DIFFICULTY",taskLogicalId:String(redundant.logical_task_id),after:{difficulty:raiseDifficulty(String(redundant.difficulty))},reasonRefs:[input.assessmentId,...input.evidenceIds]};
      return this.persistPatch({
        userId:input.userId,active,triggerType:"ASSESSMENT_COMPLETED",triggerRef:input.assessmentId,
        evidenceRefs:input.evidenceIds,operations:[operation],
        summary:"Roadmap advanced after strong validation",
        reason:"High-confidence performance made one untouched future activity redundant or too easy."
      });
    }

    const repeatedWeaknesses:string[]=[];
    if(input.weaknesses.length){
      const sql=getSql();
      for(const concept of input.weaknesses){
        const countRows=rows(await sql.unsafe(
          "select count(*)::int count from public.skill_assessment_concept_signals where user_id=$1::uuid and skill_id=$2::uuid and concept_id=$3 and polarity in ('CONTRADICTS','NEGATIVE') and created_at>=now()-interval '30 days'",
          [input.userId,input.skillId,concept]
        ));
        if(Number(countRows[0]?.count ?? 0)>=2) repeatedWeaknesses.push(concept);
      }
    }

    const latestGap=await this.latestGap(input.userId,input.skillId);
    const broadLow=score<0.55 && ["HIGH","CRITICAL"].includes(String(latestGap?.priority_band ?? ""));
    if(!repeatedWeaknesses.length && !broadLow){
      return this.noOp(input.userId,"ASSESSMENT_COMPLETED",input.assessmentId,"WEAK_SIGNAL_BELOW_THRESHOLD","Assessment evidence changed learner state but did not cross a roadmap materiality rule.",active);
    }

    const objective=objectives.find(row=>String(row.skill_id)===input.skillId && futureTasks.some(task=>String(task.objective_id)===String(row.id)));
    if(!objective) return this.noOp(input.userId,"ASSESSMENT_COMPLETED",input.assessmentId,"SKILL_OUTSIDE_ACTIONABLE_HORIZON","The affected skill has no mutable objective in the current plus next two weeks.",active);

    const existingCoverage=skillTasks.find(task=>
      String(task.status)==="PLANNED" &&
      ["PRACTICE","VALIDATE"].includes(String(task.type)) &&
      String(task.rationale_code)==="ASSESSMENT_CONCEPT_WEAKNESS"
    );
    if(existingCoverage) return this.noOp(input.userId,"ASSESSMENT_COMPLETED",input.assessmentId,"EXISTING_COVERAGE_SUFFICIENT","A future reinforcement task already addresses this signal.",active);

    const operations:PlanPatchOperation[]=[];
    const firstMutable=skillTasks.find(task=>String(task.status)==="PLANNED");
    if(broadLow && firstMutable && String(firstMutable.difficulty)!=="BASIC"){
      operations.push({
        type:"CHANGE_DIFFICULTY",
        taskLogicalId:String(firstMutable.logical_task_id),
        after:{difficulty:lowerDifficulty(String(firstMutable.difficulty))},
        reasonRefs:[input.assessmentId,"low-summary"]
      });
    }

    const objectiveLogical=String(objective.logical_objective_id);
    const dueAt=this.nextLearningDueAt(active,String(objective.week_end ?? objective.end_date ?? new Date().toISOString()));
    operations.push({
      type:"ADD_TASK",
      task:{
        objectiveLogicalId:objectiveLogical,
        skillId:input.skillId,
        taskType:"PRACTICE",
        title:repeatedWeaknesses.length
          ? "Reinforce "+repeatedWeaknesses.map(this.humanize).join(" + ")
          : "Targeted "+String(objective.skill_name ?? "skill")+" reinforcement",
        durationMinutes:25,
        dueAt,
        difficulty:"BASIC",
        rationaleCode:repeatedWeaknesses.length?"REPEATED_CONCEPT_STRUGGLE":"LOW_ASSESSMENT_SUMMARY",
        flexible:false
      },
      reasonRefs:[input.assessmentId,...repeatedWeaknesses.map(item=>"concept:"+item),...input.evidenceIds]
    });

    return this.persistPatch({
      userId:input.userId,active,triggerType:"ASSESSMENT_COMPLETED",triggerRef:input.assessmentId,
      evidenceRefs:input.evidenceIds,operations,
      summary:"Roadmap adapted after validation",
      reason:repeatedWeaknesses.length
        ? "Repeated validated concept errors crossed the reinforcement threshold."
        : "Broad low assessment performance on a high-priority gap requires lower-difficulty reinforcement before validation."
    });
  }

  async considerTaskBehavior(input:{userId:string;taskId:string}) {
    const context=await this.activeContext(input.userId);
    if(!context) return this.noOp(input.userId,"TASK_BEHAVIOR",input.taskId,"NO_ACTIVE_PLAN","No active roadmap exists to adapt.",null);
    const {active,futureTasks}=context;
    const sql=getSql();
    const task=rows(await sql.unsafe(
      "select t.*,w.end_date week_end from public.learning_tasks t join public.learning_plans p on p.id=t.plan_id join public.plan_weeks w on w.id=t.week_id where t.id=$1::uuid and p.user_id=$2::uuid limit 1",
      [input.taskId,input.userId]
    ))[0];
    if(!task) throw new Error("TASK_NOT_FOUND");

    const operations:PlanPatchOperation[]=[];
    const eventRows=rows(await sql.unsafe(
      "select * from public.task_activity_events where user_id=$1::uuid and task_id=$2::uuid order by created_at desc limit 10",
      [input.userId,input.taskId]
    ));
    const postponements=eventRows.filter(row=>["RESCHEDULED","SKIPPED"].includes(String(row.event_type))).length+Number(task.reschedule_count ?? 0);
    if(postponements>=2){
      if(String(task.status)==="PLANNED"){
        const nextDue=this.nextLearningDueAt(active,addDays(String(task.due_at ?? new Date().toISOString()),1));
        operations.push({type:"MOVE_TASK",taskLogicalId:String(task.logical_task_id),before:{dueAt:task.due_at==null?null:String(task.due_at)},after:{dueAt:nextDue},reasonRefs:[input.taskId,"repeated-postponement"]});
        if(Number(task.duration_minutes)>Number(active.preferred_session_minutes ?? 60)){
          operations.push({type:"CHANGE_DURATION",taskLogicalId:String(task.logical_task_id),after:{durationMinutes:Number(active.preferred_session_minutes ?? 60)},reasonRefs:[input.taskId,"repeated-postponement"]});
        }
      } else if(String(task.status)==="SKIPPED"){
        const objective=rows(await sql.unsafe("select logical_objective_id,skill_id from public.learning_objectives where id=$1::uuid",[String(task.objective_id)]))[0];
        if(objective){
          operations.push({
            type:"ADD_TASK",
            task:{
              objectiveLogicalId:String(objective.logical_objective_id),skillId:String(task.skill_id),taskType:String(task.type) as "LEARN"|"PRACTICE"|"BUILD"|"VALIDATE",
              title:"Replacement: "+String(task.title),durationMinutes:Math.max(20,Math.min(Number(task.duration_minutes),Number(active.preferred_session_minutes ?? 60))),
              dueAt:this.nextLearningDueAt(active,addDays(String(task.due_at ?? new Date().toISOString()),1)),
              difficulty:String(task.difficulty) as "BASIC"|"STANDARD"|"ADVANCED",rationaleCode:"REPEATED_POSTPONEMENT_REPLACEMENT",flexible:true
            },reasonRefs:[input.taskId,"repeated-postponement"]
          });
        }
      }
    }

    const comparable=rows(await sql.unsafe(
      "select t.duration_minutes,e.actual_minutes from public.task_activity_events e join public.learning_tasks t on t.id=e.task_id join public.learning_plans p on p.id=t.plan_id where e.user_id=$1::uuid and p.goal_id=$2::uuid and t.type=$3 and e.event_type in ('COMPLETED','DURATION_RECORDED') and e.actual_minutes is not null order by e.created_at desc limit 8",
      [input.userId,String(active.goal_id),String(task.type)]
    ));
    const mismatches=comparable.filter(row=>Number(row.actual_minutes)>1.5*Number(row.duration_minutes)).length;
    if(mismatches>=2){
      const future=futureTasks.find(row=>String(row.status)==="PLANNED" && String(row.type)===String(task.type) && Number(row.duration_minutes)>Number(active.preferred_session_minutes ?? 60));
      if(future && !operations.some(op=>"taskLogicalId" in op && op.taskLogicalId===String(future.logical_task_id))){
        operations.push({type:"CHANGE_DURATION",taskLogicalId:String(future.logical_task_id),after:{durationMinutes:Number(active.preferred_session_minutes ?? 60)},reasonRefs:[input.taskId,"duration-mismatch"]});
      }
    }

    if(!operations.length) return this.noOp(input.userId,"TASK_BEHAVIOR",input.taskId,"BEHAVIOR_BELOW_THRESHOLD","Behavior was recorded but did not cross a scheduling materiality rule.",active);
    return this.persistPatch({
      userId:input.userId,active,triggerType:"TASK_BEHAVIOR",triggerRef:input.taskId,evidenceRefs:[],operations,
      summary:"Roadmap adjusted to your working pace",
      reason:"Repeated postponement or actual-duration mismatch crossed a deterministic planning threshold. This changes scheduling, not skill capability."
    });
  }

  async considerSkillConflict(input:{userId:string;skillId:string;triggerRef:string}) {
    const context=await this.activeContext(input.userId);
    if(!context) return this.noOp(input.userId,"SKILL_CONFLICT",input.triggerRef,"NO_ACTIVE_PLAN","No active roadmap exists to adapt.",null);
    const state=rows(await getSql().unsafe(
      "select conflict_state,confidence from public.user_skills where user_id=$1::uuid and skill_id=$2::uuid limit 1",
      [input.userId,input.skillId]
    ))[0];
    if(!state || String(state.conflict_state)!=="UNRESOLVED") return this.noOp(input.userId,"SKILL_CONFLICT",input.triggerRef,"NO_UNRESOLVED_CONFLICT","No unresolved important evidence conflict exists.",context.active);
    const task=context.futureTasks.find(row=>String(row.skill_id)===input.skillId && String(row.status)==="PLANNED");
    const objective=context.objectives.find(row=>String(row.skill_id)===input.skillId);
    if(!objective) return this.noOp(input.userId,"SKILL_CONFLICT",input.triggerRef,"NO_MUTABLE_OBJECTIVE","The conflicted skill has no mutable objective.",context.active);
    if(task && String(task.type)==="VALIDATE") return this.noOp(input.userId,"SKILL_CONFLICT",input.triggerRef,"EXISTING_COVERAGE_SUFFICIENT","A validation task already covers the unresolved conflict.",context.active);
    const operation:PlanPatchOperation={
      type:"ADD_TASK",
      task:{
        objectiveLogicalId:String(objective.logical_objective_id),skillId:input.skillId,taskType:"VALIDATE",title:"Resolve conflicting evidence",
        durationMinutes:30,dueAt:this.nextLearningDueAt(context.active,new Date().toISOString()),difficulty:"STANDARD",
        rationaleCode:"UNRESOLVED_EVIDENCE_CONFLICT",flexible:false
      },reasonRefs:[input.triggerRef,"conflict:UNRESOLVED"]
    };
    return this.persistPatch({
      userId:input.userId,active:context.active,triggerType:"SKILL_CONFLICT",triggerRef:input.triggerRef,evidenceRefs:[],operations:[operation],
      summary:"Validation added to resolve conflicting evidence",
      reason:"Important skill evidence is unresolved, so SkillTwin prefers validation over aggressive level-specific learning."
    });
  }

  async considerResourceFeedback(input:{userId:string;taskId:string;signal:string;feedbackId:string}) {
    const context=await this.activeContext(input.userId);
    if(!context) return this.noOp(input.userId,"RESOURCE_FEEDBACK",input.feedbackId,"NO_ACTIVE_PLAN","No active roadmap exists to adapt.",null);
    const sql=getSql();
    const task=rows(await sql.unsafe(
      "select t.*,tra.resource_id from public.learning_tasks t join public.learning_plans p on p.id=t.plan_id left join public.task_resource_assignments tra on tra.task_id=t.id where t.id=$1::uuid and p.user_id=$2::uuid and p.status='ACTIVE' limit 1",
      [input.taskId,input.userId]
    ))[0];
    if(!task || !["PLANNED","IN_PROGRESS"].includes(String(task.status))) return this.noOp(input.userId,"RESOURCE_FEEDBACK",input.feedbackId,"RESOURCE_TASK_NOT_MUTABLE","Resource feedback does not map to a mutable active-plan task.",context.active);
    if(!["NOT_HELPFUL","TOO_EASY","TOO_HARD","TOO_LONG","PREFERRED_FORMAT"].includes(input.signal)) return this.noOp(input.userId,"RESOURCE_FEEDBACK",input.feedbackId,"RESOURCE_FEEDBACK_INFORMATIONAL","Feedback was stored but does not require a resource change.",context.active);

    const skill=rows(await sql.unsafe("select slug from public.skills where id=$1::uuid",[String(task.skill_id)]))[0];
    const preferred=jsonStrings(context.active.preferred_formats);
    const alternatives=rows(await sql.unsafe(
      "select * from public.learning_resources where is_verified=true and status='ACTIVE' and ($1=any(select jsonb_array_elements_text(tags)) or tags ? $1) and id<>coalesce($2::uuid,'00000000-0000-0000-0000-000000000000'::uuid) order by quality desc,duration_minutes nulls last limit 20",
      [String(skill?.slug ?? ""),task.resource_id==null?null:String(task.resource_id)]
    ));
    const ranked=alternatives.map(resource=>{
      const format=String(resource.format).toLowerCase();
      const duration=Number(resource.duration_minutes ?? context.active.preferred_session_minutes ?? 60);
      let score=Number(resource.quality ?? 0);
      if(preferred.some(item=>format.includes(item==="documentation"?"docs":item))) score+=0.15;
      if(input.signal==="TOO_LONG") score+=Math.max(0,0.2-duration/1000);
      if(input.signal==="TOO_HARD" && jsonStrings(resource.levels).some(level=>["BEGINNER","AWARENESS"].includes(level))) score+=0.15;
      if(input.signal==="TOO_EASY" && jsonStrings(resource.levels).some(level=>["INTERMEDIATE","ADVANCED"].includes(level))) score+=0.15;
      return {resource,score};
    }).sort((a,b)=>b.score-a.score);
    const choice=ranked[0]?.resource;
    if(!choice) return this.noOp(input.userId,"RESOURCE_FEEDBACK",input.feedbackId,"RESOURCE_UNAVAILABLE","No verified alternative resource matches the task and learner preferences.",context.active);

    const operation:PlanPatchOperation={type:"CHANGE_RESOURCE",taskLogicalId:String(task.logical_task_id),after:{resourceId:String(choice.id)},reasonRefs:[input.feedbackId,"signal:"+input.signal]};
    return this.persistPatch({
      userId:input.userId,active:context.active,triggerType:"RESOURCE_FEEDBACK",triggerRef:input.feedbackId,evidenceRefs:[],operations:[operation],
      summary:"Learning resource updated",
      reason:"Learner feedback crossed a verified-resource rematch rule. SkillTwin selected an alternative from the catalog and did not invent a URL."
    });
  }

  async accept(userId:string,diffId:string) {
    return getPlanPatchEngine().applyDiff(userId,diffId);
  }

  async reject(userId:string,diffId:string) {
    const sql=getSql();
    const updated=rows(await sql.unsafe(
      "update public.plan_diffs set status='REJECTED',can_undo=false where id=$1::uuid and user_id=$2::uuid and status='PROPOSED' returning *",
      [diffId,userId]
    ));
    if(!updated[0]) throw new Error("PLAN_DIFF_NOT_REJECTABLE");
    await sql.unsafe(
      "insert into public.agent_events(user_id,event_type,trigger_type,trigger_ref,summary,entity_refs) values ($1::uuid,'plan.diff.rejected','PLAN_DIFF',$2,'Learner kept the current roadmap and rejected a proposed adaptive patch.',$3::jsonb)",
      [userId,diffId,JSON.stringify([{type:"plan_diff",id:diffId}])]
    );
    return getPlanPatchEngine().dto(updated[0],false);
  }

  private async activeContext(userId:string):Promise<ActiveContext|null> {
    const sql=getSql();
    const active=rows(await sql.unsafe(
      "select p.*,g.adaptation_mode,g.learning_days,g.preferred_session_minutes,g.min_session_minutes,g.preferred_formats from public.learning_plans p join public.career_goals g on g.id=p.goal_id where p.user_id=$1::uuid and p.status='ACTIVE' order by p.version desc limit 1",
      [userId]
    ))[0];
    if(!active) return null;
    const [tasksRaw,objectivesRaw]=await Promise.all([
      sql.unsafe(
        "select t.*,w.week_index,w.start_date week_start,w.end_date week_end,w.capacity_minutes,w.planned_minutes from public.learning_tasks t join public.plan_weeks w on w.id=t.week_id where t.plan_id=$1::uuid and (w.start_date<=current_date+interval '21 days' or t.due_at<=now()+interval '21 days') order by w.week_index,t.due_at nulls last,t.created_at",
        [String(active.id)]
      ),
      sql.unsafe(
        "select o.*,w.week_index,w.start_date week_start,w.end_date week_end,s.canonical_name skill_name from public.learning_objectives o join public.plan_weeks w on w.id=o.week_id join public.skills s on s.id=o.skill_id where o.plan_id=$1::uuid and w.start_date<=current_date+interval '21 days' order by w.week_index,o.created_at",
        [String(active.id)]
      )
    ]);
    return {active,futureTasks:rows(tasksRaw),objectives:rows(objectivesRaw)};
  }

  private async latestGap(userId:string,skillId:string) {
    const sql=getSql();
    return rows(await sql.unsafe(
      "select sgr.* from public.skill_gap_results sgr join public.gap_snapshots gs on gs.id=sgr.snapshot_id where sgr.user_id=$1::uuid and sgr.skill_id=$2::uuid order by gs.created_at desc limit 1",
      [userId,skillId]
    ))[0] ?? null;
  }

  private async persistPatch(input:{
    userId:string;active:Row;triggerType:string;triggerRef:string;evidenceRefs:string[];
    operations:PlanPatchOperation[];summary:string;reason:string;
  }) {
    const sql=getSql();
    const fingerprint=createHash("sha256").update(JSON.stringify({
      planId:String(input.active.id),version:Number(input.active.version),triggerType:input.triggerType,triggerRef:input.triggerRef,
      operations:input.operations,evidenceRefs:[...input.evidenceRefs].sort(),version:REPLAN_TRIGGER_VERSION
    })).digest("hex");
    const existing=rows(await sql.unsafe("select * from public.plan_diffs where user_id=$1::uuid and input_fingerprint=$2 limit 1",[input.userId,fingerprint]))[0];
    if(existing) return getPlanPatchEngine().dto(existing,true);

    const affectedWeeks=new Set<number>();
    let totalMinuteDelta=0, major=false;
    for(const operation of input.operations){
      if(operation.type==="ADD_TASK") totalMinuteDelta+=operation.task.durationMinutes;
      if(operation.type==="REMOVE_TASK"){
        const task=rows(await sql.unsafe("select duration_minutes,type,week_id from public.learning_tasks where logical_task_id=$1::uuid and plan_id=$2::uuid limit 1",[operation.taskLogicalId,String(input.active.id)]))[0];
        totalMinuteDelta-=Number(task?.duration_minutes ?? 0);
        if(String(task?.type)==="BUILD") major=true;
      }
      if(operation.type==="CHANGE_DURATION"){
        const task=rows(await sql.unsafe("select duration_minutes from public.learning_tasks where logical_task_id=$1::uuid and plan_id=$2::uuid limit 1",[operation.taskLogicalId,String(input.active.id)]))[0];
        totalMinuteDelta+=operation.after.durationMinutes-Number(task?.duration_minutes ?? 0);
      }
      if("taskLogicalId" in operation){
        const task=rows(await sql.unsafe(
          "select w.week_index,t.type from public.learning_tasks t join public.plan_weeks w on w.id=t.week_id where t.logical_task_id=$1::uuid and t.plan_id=$2::uuid limit 1",
          [operation.taskLogicalId,String(input.active.id)]
        ))[0];
        if(task) affectedWeeks.add(Number(task.week_index));
        if(operation.type==="MOVE_TASK" && String(task?.type)==="BUILD") major=true;
      }
    }
    if(input.operations.length>3 || affectedWeeks.size>=3) major=true;
    const weeklyCapacity=Number(input.active.hours_per_week ?? 0)*60 || 600;
    if(Math.abs(totalMinuteDelta)>weeklyCapacity*0.15) major=true;
    const complexity=major?"MAJOR":"MINOR";
    const decision=(String(input.active.adaptation_mode)==="AUTOMATIC" && !major)?"APPLY":"PROPOSE";

    const diffRows=rows(await sql.unsafe(
      "insert into public.plan_diffs(user_id,goal_id,from_plan_id,from_version,status,trigger_type,trigger_refs,evidence_refs,summary,reason,operations,weekly_impact,timeline_impact,total_minute_delta,touch_count,complexity,can_undo,generator_version,validator_version,input_fingerprint) values ($1::uuid,$2::uuid,$3::uuid,$4,'PROPOSED',$5,$6::jsonb,$7::jsonb,$8,$9,$10::jsonb,'NONE',$11,$12,$13,true,$14,$15,$16) returning *",
      [
        input.userId,String(input.active.goal_id),String(input.active.id),Number(input.active.version),input.triggerType,
        JSON.stringify([input.triggerRef]),JSON.stringify(input.evidenceRefs),input.summary,input.reason,
        JSON.stringify(input.operations),JSON.stringify([]),totalMinuteDelta,input.operations.length,complexity,
        REPLAN_TRIGGER_VERSION,"replan-validator-f2",fingerprint
      ]
    ));
    const diff=diffRows[0];
    await sql.unsafe(
      "insert into public.replan_decisions(user_id,goal_id,from_plan_id,from_version,trigger_type,trigger_ref,material,decision,reason_code,reason,input_fingerprint) values ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,true,$7,$8,$9,$10) on conflict(user_id,input_fingerprint) do nothing",
      [input.userId,String(input.active.goal_id),String(input.active.id),Number(input.active.version),input.triggerType,input.triggerRef,decision,"MATERIAL_PATCH",input.reason,fingerprint]
    );
    if(decision==="APPLY") return getPlanPatchEngine().applyDiff(input.userId,String(diff.id));
    return getPlanPatchEngine().dto(diff,false);
  }

  private async noOp(userId:string,triggerType:string,triggerRef:string,reasonCode:string,reason:string,active:Row|null) {
    const sql=getSql();
    const goalId=active?String(active.goal_id):String(rows(await sql.unsafe("select id from public.career_goals where user_id=$1::uuid and status='ACTIVE' limit 1",[userId]))[0]?.id ?? "");
    const fingerprint=createHash("sha256").update(JSON.stringify({userId,triggerType,triggerRef,reasonCode,planId:active?.id ?? null,version:REPLAN_TRIGGER_VERSION})).digest("hex");
    if(goalId){
      const inserted=rows(await sql.unsafe(
        "insert into public.replan_decisions(user_id,goal_id,from_plan_id,from_version,trigger_type,trigger_ref,material,decision,reason_code,reason,input_fingerprint) values ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,false,'NO_OP',$7,$8,$9) on conflict(user_id,input_fingerprint) do update set input_fingerprint=excluded.input_fingerprint returning *",
        [userId,goalId,active?.id==null?null:String(active.id),active?.version==null?null:Number(active.version),triggerType,triggerRef,reasonCode,reason,fingerprint]
      ));
      return {changed:false,reused:false,decision:inserted[0]};
    }
    return {changed:false,reused:false,decision:{material:false,reasonCode,reason}};
  }

  private nextLearningDueAt(active:Row,fromIso:string) {
    const days=jsonStrings(active.learning_days);
    let date=new Date(fromIso);
    if(Number.isNaN(date.getTime())) date=new Date();
    for(let i=0;i<10;i+=1){
      const name=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][date.getUTCDay()];
      if(days.includes(name)){
        date.setUTCHours(12,0,0,0); return date.toISOString();
      }
      date.setUTCDate(date.getUTCDate()+1);
    }
    return date.toISOString();
  }
  private humanize(value:string){return value.replace(/[-_]/g," ").replace(/\b\w/g,char=>char.toUpperCase());}
}

let service:AdaptiveTriggerService|null=null;
export function getAdaptiveTriggerService(){if(!service) service=new AdaptiveTriggerService();return service;}
