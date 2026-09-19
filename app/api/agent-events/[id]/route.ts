import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";

export const dynamic="force-dynamic";

export async function GET(_request:Request,context:{params:Promise<{id:string}>}){
  const requestId=await getRequestId();
  try{
    const {id}=await context.params;
    const {user,supabase}=await requireUser();
    const {data:event,error}=await supabase.from("agent_events")
      .select("id,event_type,trigger_type,trigger_ref,summary,entity_refs,evidence_refs,metadata,created_at")
      .eq("id",id).eq("user_id",user.id).maybeSingle();
    if(error) throw error;
    if(!event) return fail(requestId,404,"NOT_FOUND","Agent event not found.");

    const refs=Array.isArray(event.entity_refs)?event.entity_refs as Array<Record<string,unknown>>:[];
    const details:Record<string,unknown>={};
    for(const ref of refs.slice(0,8)){
      const type=String(ref.type ?? ""),entityId=String(ref.id ?? "");
      if(!entityId) continue;
      if(type==="plan_diff"){
        const {data}=await supabase.from("plan_diffs").select("id,status,from_version,to_version,summary,reason,operations,weekly_impact,timeline_impact,total_minute_delta,complexity,created_at,applied_at").eq("id",entityId).eq("user_id",user.id).maybeSingle();
        if(data) details.planDiff=data;
      }else if(type==="assessment"){
        const {data}=await supabase.from("skill_assessment_outcomes").select("assessment_id,normalized_score,coverage,assessment_confidence,strengths,weaknesses,concept_summary,created_at").eq("assessment_id",entityId).eq("user_id",user.id).maybeSingle();
        if(data) details.assessmentOutcome=data;
      }else if(type==="learning_plan"){
        const {data}=await supabase.from("learning_plans").select("id,version,status,start_date,end_date,planned_minutes,adaptation_buffer_minutes,created_at").eq("id",entityId).eq("user_id",user.id).maybeSingle();
        if(data) details.learningPlan=data;
      }else if(type==="learning_task"){
        const {data}=await supabase.from("learning_tasks").select("id,title,type,status,duration_minutes,due_at,actual_minutes,reschedule_count").eq("id",entityId).maybeSingle();
        if(data) details.learningTask=data;
      }
    }
    return ok(requestId,{event,details,explanationBoundary:"Observable committed trigger/change metadata only; hidden model reasoning is never exposed."});
  }catch(error){
    if(error instanceof UnauthenticatedError) return fail(requestId,401,"UNAUTHENTICATED","Sign in to view Agent Activity.");
    return fail(requestId,500,"AGENT_EVENT_DETAIL_FAILED","Could not load Agent Activity detail.");
  }
}
