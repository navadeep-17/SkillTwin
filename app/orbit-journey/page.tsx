import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OrbitPreviewNav } from "@/components/orbit/orbit-preview-nav";
import { OrbitJourney, type JourneyModel, type JourneyWeek, type JourneyDecision, type JourneyDiff } from "./orbit-journey";
import "../orbit-lab/orbit-lab.css";
import "./orbit-journey.css";

type RoleVersion = { target_roles?: {name?: string} | Array<{name?: string}> };
type ObjectiveRow = { id: string; week_id: string; type: string; success_criteria: string; target_score: number; skills: {canonical_name?:string} | Array<{canonical_name?:string}> | null };
type TaskRow = { id: string; week_id: string; objective_id: string; type: string; title: string; status: string; duration_minutes: number; due_at: string | null; difficulty: string };
function one<T>(value:T | T[] | null | undefined): T | null { return Array.isArray(value)?value[0]??null:value??null; }
function readArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") { try { const parsed=JSON.parse(value); return Array.isArray(parsed)?parsed:[]; } catch { return []; } }
  return [];
}
export const metadata = { title: "Your Journey — SkillTwin Orbit", description: "Your real learning milestones, weekly task progress, and explainable adaptive plan history." };

export default async function OrbitJourneyPage() {
  const supabase = await createClient();
  const {data:auth} = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=%2Forbit-journey");

  const {data:goal,error:goalError} = await supabase.from("career_goals")
    .select("id,role_version_id,role_versions!inner(target_roles!inner(name))")
    .eq("user_id",auth.user.id).eq("status","ACTIVE").limit(1).maybeSingle();
  if(goalError)throw goalError;

  const roleName=one(one(goal?.role_versions as RoleVersion | RoleVersion[] | null)?.target_roles)?.name??null;
  let model:JourneyModel={roleName,plan:null,weeks:[],diffs:[],decisions:[],versions:0};
  if (goal?.id) {
    const [planResult,versionsResult,diffsResult,decisionsResult] = await Promise.all([
      supabase.from("learning_plans")
        .select("id,version,start_date,end_date,planned_minutes,adaptation_buffer_minutes,created_at")
        .eq("user_id",auth.user.id).eq("goal_id",goal.id).eq("status","ACTIVE")
        .order("version",{ascending:false}).limit(1).maybeSingle(),
      supabase.from("learning_plans").select("id",{count:"exact",head:true})
        .eq("user_id",auth.user.id).eq("goal_id",goal.id),
      supabase.from("plan_diffs")
        .select("id,status,from_version,to_version,summary,reason,operations,timeline_impact,total_minute_delta,touch_count,complexity,created_at,applied_at")
        .eq("user_id",auth.user.id).eq("goal_id",goal.id)
        .order("created_at",{ascending:false}).limit(20),
      supabase.from("replan_decisions")
        .select("id,decision,reason_code,reason,material,from_version,trigger_type,created_at")
        .eq("user_id",auth.user.id).eq("goal_id",goal.id)
        .order("created_at",{ascending:false}).limit(15)
    ]);
    for(const result of [planResult,versionsResult,diffsResult,decisionsResult])if(result.error)throw result.error;
    const plan=planResult.data;
    const diffs:JourneyDiff[]=(diffsResult.data??[]).map(d=>({
      id:String(d.id),status:String(d.status),fromVersion:Number(d.from_version),toVersion:d.to_version==null?null:Number(d.to_version),
      summary:String(d.summary),reason:String(d.reason),operationsCount:readArray(d.operations).length,
      timelineImpact:String(d.timeline_impact),minuteDelta:Number(d.total_minute_delta),touchCount:Number(d.touch_count),
      complexity:String(d.complexity),createdAt:String(d.created_at),appliedAt:d.applied_at??null
    }));
    const decisions:JourneyDecision[]=(decisionsResult.data??[]).map(d=>({
      id:String(d.id),decision:String(d.decision),reasonCode:String(d.reason_code),
      reason:String(d.reason),material:Boolean(d.material),fromVersion:d.from_version==null?null:Number(d.from_version),
      triggerType:String(d.trigger_type),createdAt:String(d.created_at)
    }));
    let weeks:JourneyWeek[]=[];
    if(plan?.id){
      const [weekResult,objectiveResult,taskResult]=await Promise.all([
        supabase.from("plan_weeks").select("id,week_index,start_date,end_date,capacity_minutes,planned_minutes,rationale")
          .eq("plan_id",plan.id).order("week_index",{ascending:true}),
        supabase.from("learning_objectives").select("id,week_id,type,success_criteria,target_score,skills!inner(canonical_name)")
          .eq("plan_id",plan.id),
        supabase.from("learning_tasks").select("id,week_id,objective_id,type,title,status,duration_minutes,due_at,difficulty")
          .eq("plan_id",plan.id).order("due_at",{ascending:true,nullsFirst:false})
      ]);
      for(const result of [weekResult,objectiveResult,taskResult])if(result.error)throw result.error;
      const objectives=(objectiveResult.data??[]) as ObjectiveRow[];
      const tasks=(taskResult.data??[]) as TaskRow[];
      weeks=(weekResult.data??[]).map(w=>({
        id:String(w.id),index:Number(w.week_index),startDate:String(w.start_date),endDate:String(w.end_date),
        capacityMinutes:Number(w.capacity_minutes),plannedMinutes:Number(w.planned_minutes),rationale:w.rationale??null,
        objectives:objectives.filter(o=>o.week_id===w.id).map(o=>({
          id:String(o.id),type:String(o.type),name:one(o.skills)?.canonical_name??"Skill objective",
          successCriteria:String(o.success_criteria),targetScore:Number(o.target_score)
        })),
        tasks:tasks.filter(t=>t.week_id===w.id).map(t=>({
          id:String(t.id),objectiveId:String(t.objective_id),type:String(t.type),title:String(t.title),status:String(t.status),
          minutes:Number(t.duration_minutes),dueAt:t.due_at??null,difficulty:String(t.difficulty)
        }))
      }));
    }
    model={
      roleName,versions:versionsResult.count??0,weeks,diffs,decisions,
      plan:plan?{
        id:String(plan.id),version:Number(plan.version),startDate:String(plan.start_date),endDate:String(plan.end_date),
        plannedMinutes:Number(plan.planned_minutes),adaptationBufferMinutes:Number(plan.adaptation_buffer_minutes),
        createdAt:String(plan.created_at)
      }:null
    };
  }
  return <main className="orbit-lab orbit-journey">
    <OrbitPreviewNav/>
    <OrbitJourney model={model}/>
  </main>;
}
