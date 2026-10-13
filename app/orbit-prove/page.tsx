import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSql } from "@/lib/db/postgres";
import { OrbitPreviewNav } from "@/components/orbit/orbit-preview-nav";
import { OrbitProof, type OrbitProofSkill } from "./orbit-proof";
import {
  buildTwinProofTrail, challengeAvailability,
  type TwinEvidence, type TwinHistory, type TwinPlanDiff, type TwinProofOutcome,
  type TwinReplanDecision
} from "@/lib/domain/twin-challenge";
import "../orbit-lab/orbit-lab.css";
import "./orbit-prove.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = {
  title:"Prove Your Skills — SkillTwin Orbit",
  description:"Inspect your stored skill estimate, challenge it with verified assessments, and see evidence-backed outcomes."
};
export default async function OrbitProvePage({searchParams}:{
  searchParams:Promise<{skillId?:string}>
}) {
  const supabase=await createClient();
  const {data:auth}=await supabase.auth.getUser();
  if(!auth.user)redirect("/login?next=%2Forbit-prove");
  const userId=auth.user.id;
  const [catalog,estimates,evidence,history,outcomes,decisions,diffs,active,questionCounts]=await Promise.all([
    supabase.from("skills").select("id,slug,canonical_name,category,description")
      .eq("is_active",true).order("canonical_name").limit(200),
    supabase.from("user_skills")
      .select("skill_id,level_value,capability_score,confidence,conflict_state,evidence_count,last_validated_at")
      .eq("user_id",userId).limit(200),
    supabase.from("skill_evidence")
      .select("id,skill_id,source_type,claim,status,created_at")
      .eq("user_id",userId).in("status",["ACCEPTED","NON_AGGREGATING"])
      .order("created_at",{ascending:false}).limit(350),
    supabase.from("skill_history")
      .select("skill_id,trigger_ref,before_state,after_state,explanation")
      .eq("user_id",userId).eq("trigger_type","ASSESSMENT_COMPLETED")
      .order("created_at",{ascending:false}).limit(100),
    supabase.from("skill_assessment_outcomes")
      .select("assessment_id,skill_id,normalized_score,coverage,created_at")
      .eq("user_id",userId).order("created_at",{ascending:false}).limit(100),
    supabase.from("replan_decisions")
      .select("trigger_ref,decision,reason_code,reason")
      .eq("user_id",userId).order("created_at",{ascending:false}).limit(100),
    supabase.from("plan_diffs")
      .select("id,trigger_refs,status,summary")
      .eq("user_id",userId).order("created_at",{ascending:false}).limit(100),
    supabase.from("skill_assessments")
      .select("id,skill_id,created_at").eq("user_id",userId)
      .eq("status","ACTIVE").order("created_at",{ascending:false}).limit(100),
    // The application already uses a server-only aggregate for availability.
    // Never expose question prompts, answer keys or rubrics in client props.
    getSql().unsafe(
      "select skill_id::text as skill_id, count(*)::integer as question_count from public.assessment_question_bank where is_active=true and type in ('MCQ','SHORT_TEXT','SCENARIO') group by skill_id"
    )
  ]);
  for(const result of [catalog,estimates,evidence,history,outcomes,decisions,diffs,active]){
    if(result.error)throw result.error;
  }
  const countBySkill=new Map(questionCounts.map(row=>[String(row.skill_id),Number(row.question_count)]));
  const estimatesBySkill=new Map((estimates.data??[]).map(row=>[String(row.skill_id),row]));
  const activeBySkill=new Map<string,string>();
  for(const session of active.data??[]){
    const key=String(session.skill_id);
    if(!activeBySkill.has(key))activeBySkill.set(key,String(session.id));
  }
  const outcomeBySkill=new Map<string,TwinProofOutcome>();
  for(const row of outcomes.data??[]){
    const key=String(row.skill_id);
    if(!outcomeBySkill.has(key))outcomeBySkill.set(key,{
      assessment_id:String(row.assessment_id),skill_id:key,
      normalized_score:row.normalized_score==null?null:Number(row.normalized_score),
      coverage:row.coverage==null?null:Number(row.coverage),
      created_at:String(row.created_at)
    });
  }
  const data:OrbitProofSkill[]=(catalog.data??[]).map(row=>{
    const id=String(row.id),estimate=estimatesBySkill.get(id);
    const questionCount=countBySkill.get(id)??0;
    const running=activeBySkill.get(id)??null;
    const proof=buildTwinProofTrail(
      outcomeBySkill.get(id)??null,
      (history.data??[]) as TwinHistory[],
      (decisions.data??[]) as TwinReplanDecision[],
      (diffs.data??[]) as TwinPlanDiff[]
    );
    return {
      id,name:String(row.canonical_name),category:String(row.category??"Skills"),
      description:String(row.description??""),level:estimate?.level_value?String(estimate.level_value):"UNKNOWN",
      capability:estimate?.capability_score==null?null:Number(estimate.capability_score),
      confidence:estimate?.confidence==null?null:Number(estimate.confidence),
      evidenceCount:Number(estimate?.evidence_count??0),
      conflict:String(estimate?.conflict_state??"NONE"),
      questionCount,activeAssessmentId:running,
      availability:challengeAvailability(questionCount,running),
      evidence:(evidence.data??[]).filter(item=>String(item.skill_id)===id).slice(0,5).map(item=>({
        source_type:String(item.source_type),claim:String(item.claim??"Evidence observation"),
        status:String(item.status),created_at:String(item.created_at)
      } as TwinEvidence)),
      proof
    };
  });
  const query=await searchParams;
  const selectedSkillId=typeof query.skillId==="string"&&data.some(x=>x.id===query.skillId)?query.skillId:undefined;

  return <main className="orbit-lab orbit-prove">
    <OrbitPreviewNav/>
    <OrbitProof skills={data} initialSkillId={selectedSkillId}/>
    <footer className="op-foot"><Link href="/challenge-my-twin">Open original Challenge My Twin</Link><span>Real evidence · verified assessments · auditable decisions</span></footer>
  </main>;
}
