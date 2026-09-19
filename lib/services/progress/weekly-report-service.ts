import "server-only";
import { getSql } from "@/lib/db/postgres";

export const WEEKLY_REPORT_VERSION="weekly-report-g1";
type Row=Record<string,unknown>;
const rows=(value:unknown)=>value as Row[];

export interface WeeklyReportDto extends Record<string,unknown> {
  id:string;
  user_id:string;
  goal_id:string|null;
  week_start:string;
  week_end:string;
  readiness_start:number|null;
  readiness_end:number|null;
  tasks_completed:number;
  learning_minutes:number;
  assessments_completed:number;
  skills_changed:number;
  roadmap_changes:number;
  improving_skill_ids:unknown;
  attention_skill_ids:unknown;
  summary:string;
  recommended_next_step:string|null;
  report_version:string;
  roadmapOperationCounts:{moved:number;added:number;removed:number};
}

function weekBounds() {
  const now=new Date();
  const day=now.getUTCDay() || 7;
  const start=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()));
  start.setUTCDate(start.getUTCDate()-(day-1));
  const end=new Date(start); end.setUTCDate(end.getUTCDate()+6);
  return {start:start.toISOString().slice(0,10),end:end.toISOString().slice(0,10)};
}
function strings(value:unknown){return Array.isArray(value)?value.map(String):[];}

export class WeeklyReportService {
  async getOrGenerate(userId:string):Promise<WeeklyReportDto> {
    const sql=getSql();
    const {start,end}=weekBounds();
    const existing=rows(await sql.unsafe(
      "select * from public.weekly_reports where user_id=$1::uuid and week_start=$2::date and report_version=$3 limit 1",
      [userId,start,WEEKLY_REPORT_VERSION]
    ))[0];

    const goal=rows(await sql.unsafe(
      "select g.id,tr.name role_name from public.career_goals g join public.role_versions rv on rv.id=g.role_version_id join public.target_roles tr on tr.id=rv.role_id where g.user_id=$1::uuid and g.status='ACTIVE' limit 1",
      [userId]
    ))[0] ?? null;

    const snapshots=rows(await sql.unsafe(
      "select readiness,evidence_coverage,created_at from public.gap_snapshots where user_id=$1::uuid and created_at >= $2::date and created_at < ($3::date + interval '1 day') order by created_at",
      [userId,start,end]
    ));
    const before=rows(await sql.unsafe(
      "select readiness from public.gap_snapshots where user_id=$1::uuid and created_at < $2::date order by created_at desc limit 1",
      [userId,start]
    ))[0];

    const tasks=rows(await sql.unsafe(
      "select t.id,t.status,t.duration_minutes,t.actual_minutes,t.skill_id,s.canonical_name from public.learning_tasks t join public.learning_plans p on p.id=t.plan_id join public.skills s on s.id=t.skill_id where p.user_id=$1::uuid and coalesce(t.completed_at,t.created_at) >= $2::date and coalesce(t.completed_at,t.created_at) < ($3::date + interval '1 day')",
      [userId,start,end]
    ));
    const assessments=rows(await sql.unsafe(
      "select id,skill_id,normalized_score,created_at from public.skill_assessment_outcomes where user_id=$1::uuid and created_at >= $2::date and created_at < ($3::date + interval '1 day')",
      [userId,start,end]
    ));
    const history=rows(await sql.unsafe(
      "select h.*,s.canonical_name from public.skill_history h join public.skills s on s.id=h.skill_id where h.user_id=$1::uuid and h.created_at >= $2::date and h.created_at < ($3::date + interval '1 day') order by h.created_at",
      [userId,start,end]
    ));
    const diffs=rows(await sql.unsafe(
      "select operations,total_minute_delta,status from public.plan_diffs where user_id=$1::uuid and created_at >= $2::date and created_at < ($3::date + interval '1 day') and status in ('APPLIED','UNDONE')",
      [userId,start,end]
    ));

    const readinessStart=before?.readiness==null?(snapshots[0]?.readiness==null?null:Number(snapshots[0].readiness)):Number(before.readiness);
    const readinessEnd=snapshots.at(-1)?.readiness==null?readinessStart:Number(snapshots.at(-1)!.readiness);
    const completed=tasks.filter(task=>String(task.status)==="COMPLETED");
    const learningMinutes=completed.reduce((sum,task)=>sum+Number(task.actual_minutes ?? task.duration_minutes ?? 0),0);

    const changedSkillIds=[...new Set(history.map(item=>String(item.skill_id)))];
    const improving=history.filter(item=>{
      const beforeState=item.before_state && typeof item.before_state==="object"?item.before_state as Record<string,unknown>:{};
      const afterState=item.after_state && typeof item.after_state==="object"?item.after_state as Record<string,unknown>:{};
      return Number(afterState.capabilityScore ?? -1)>Number(beforeState.capabilityScore ?? -1) || Number(afterState.confidence ?? 0)>Number(beforeState.confidence ?? 0)+0.04;
    }).map(item=>String(item.skill_id));
    const attention=assessments.filter(item=>Number(item.normalized_score)<0.60).map(item=>String(item.skill_id));

    let moved=0,added=0,removed=0;
    for(const diff of diffs){
      for(const op of Array.isArray(diff.operations)?diff.operations as Array<Record<string,unknown>>:[]){
        if(op.type==="MOVE_TASK") moved+=1;
        if(op.type==="ADD_TASK") added+=1;
        if(op.type==="REMOVE_TASK") removed+=1;
      }
    }

    const nextGap=rows(await sql.unsafe(
      "select s.canonical_name,sgr.recommended_action,sgr.priority_band from public.skill_gap_results sgr join public.skills s on s.id=sgr.skill_id where sgr.snapshot_id=(select id from public.gap_snapshots where user_id=$1::uuid order by created_at desc limit 1) and sgr.status<>'STRONG' order by sgr.priority_score desc limit 1",
      [userId]
    ))[0];
    const recommendation=nextGap
      ? "Focus next on "+String(nextGap.canonical_name)+" ("+String(nextGap.priority_band).toLowerCase()+" priority) with action "+String(nextGap.recommended_action)+"."
      : "Maintain validated skills and continue the active roadmap.";

    const summary=[
      readinessStart!=null&&readinessEnd!=null?"Readiness "+readinessStart+"% → "+readinessEnd+"%.":null,
      completed.length+" learning task"+(completed.length===1?"":"s")+" completed.",
      assessments.length+" validation"+(assessments.length===1?"":"s")+" completed.",
      diffs.length+" roadmap change"+(diffs.length===1?"":"s")+" applied/undone."
    ].filter(Boolean).join(" ");

    if(existing){
      const refreshed=rows(await sql.unsafe(
        "update public.weekly_reports set goal_id=$1::uuid,week_end=$2::date,readiness_start=$3,readiness_end=$4,tasks_completed=$5,learning_minutes=$6,assessments_completed=$7,skills_changed=$8,roadmap_changes=$9,improving_skill_ids=$10::jsonb,attention_skill_ids=$11::jsonb,summary=$12,recommended_next_step=$13 where id=$14::uuid returning *",
        [goal?.id?String(goal.id):null,end,readinessStart,readinessEnd,completed.length,learningMinutes,assessments.length,changedSkillIds.length,diffs.length,JSON.stringify([...new Set(improving)]),JSON.stringify([...new Set(attention)]),summary,recommendation,String(existing.id)]
      ))[0];
      return {...refreshed,roadmapOperationCounts:{moved,added,removed}} as WeeklyReportDto;
    }

    const inserted=rows(await sql.unsafe(
      "insert into public.weekly_reports(user_id,goal_id,week_start,week_end,readiness_start,readiness_end,tasks_completed,learning_minutes,assessments_completed,skills_changed,roadmap_changes,improving_skill_ids,attention_skill_ids,summary,recommended_next_step,report_version) values ($1::uuid,$2::uuid,$3::date,$4::date,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14,$15,$16) returning *",
      [userId,goal?.id?String(goal.id):null,start,end,readinessStart,readinessEnd,completed.length,learningMinutes,assessments.length,changedSkillIds.length,diffs.length,JSON.stringify([...new Set(improving)]),JSON.stringify([...new Set(attention)]),summary,recommendation,WEEKLY_REPORT_VERSION]
    ))[0];
    return {...inserted,roadmapOperationCounts:{moved,added,removed}} as WeeklyReportDto;
  }
}

let service:WeeklyReportService|null=null;
export function getWeeklyReportService(){if(!service) service=new WeeklyReportService();return service;}
