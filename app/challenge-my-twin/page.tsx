import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TwinChallengeWorkbench, type TwinChallengeSkill } from "@/components/twin/twin-challenge-workbench";
import {
  buildTwinProofTrail, challengeAvailability,
  type TwinHistory,type TwinPlanDiff,type TwinProofOutcome,type TwinReplanDecision
} from "@/lib/domain/twin-challenge";

export const dynamic = "force-dynamic";

/**
 * This is a read-only view of the current learner's evidence, with an explicit
 * action to launch the EXISTING verified assessment flow for a selected skill.
 * Neither a dispute nor the selected confidence direction changes their score.
 */
export default async function ChallengeMyTwinPage({
  searchParams
}: { searchParams: Promise<{ skillId?: string }> }) {
  const supabase=await createClient();
  const {data:auth}=await supabase.auth.getUser();
  if(!auth.user) redirect("/login");
  const userId=auth.user.id;

  const [skills, states, bank, evidence, history, outcomes, decisions, diffs, active] = await Promise.all([
    supabase.from("skills")
      .select("id,slug,canonical_name,category,description")
      .eq("is_active",true).order("canonical_name").limit(200),
    supabase.from("user_skills")
      .select("skill_id,level_value,capability_score,confidence,conflict_state,evidence_count,last_validated_at")
      .eq("user_id",userId).limit(200),
    supabase.from("assessment_question_bank")
      .select("skill_id")
      .eq("is_active",true).in("type",["MCQ","SHORT_TEXT","SCENARIO"]).limit(500),
    supabase.from("skill_evidence")
      .select("id,skill_id,source_type,claim,status,created_at")
      .eq("user_id",userId)
      .in("status",["ACCEPTED","NON_AGGREGATING"])
      .order("created_at",{ascending:false}).limit(350),
    supabase.from("skill_history")
      .select("id,skill_id,trigger_type,trigger_ref,before_state,after_state,explanation,created_at")
      .eq("user_id",userId).eq("trigger_type","ASSESSMENT_COMPLETED")
      .order("created_at",{ascending:false}).limit(100),
    supabase.from("skill_assessment_outcomes")
      .select("assessment_id,skill_id,normalized_score,coverage,created_at")
      .eq("user_id",userId).order("created_at",{ascending:false}).limit(100),
    supabase.from("replan_decisions")
      .select("trigger_ref,decision,reason_code,reason,created_at")
      .eq("user_id",userId).order("created_at",{ascending:false}).limit(100),
    supabase.from("plan_diffs")
      .select("id,trigger_refs,status,summary,created_at")
      .eq("user_id",userId).order("created_at",{ascending:false}).limit(100),
    supabase.from("skill_assessments")
      .select("id,skill_id,created_at")
      .eq("user_id",userId).eq("status","ACTIVE")
      .order("created_at",{ascending:false}).limit(100)
  ]);
  for(const request of [skills,states,bank,evidence,history,outcomes,decisions,diffs,active]) {
    if(request.error) throw request.error;
  }

  const questionCounts=new Map<string,number>();
  for(const question of bank.data ?? []) {
    const id=String(question.skill_id);
    questionCounts.set(id,(questionCounts.get(id)??0)+1);
  }
  const stateBySkill=new Map((states.data??[]).map(x=>[String(x.skill_id),x]));
  const activeBySkill=new Map<string,string>();
  for(const assessment of active.data??[]) {
    if(!activeBySkill.has(String(assessment.skill_id)))
      activeBySkill.set(String(assessment.skill_id),String(assessment.id));
  }
  const historyRows=(history.data??[]) as TwinHistory[];
  const decisionRows=(decisions.data??[]) as TwinReplanDecision[];
  const diffRows=(diffs.data??[]) as TwinPlanDiff[];
  const outcomeBySkill=new Map<string,TwinProofOutcome>();
  for(const outcome of outcomes.data??[]) {
    const id=String(outcome.skill_id);
    if(!outcomeBySkill.has(id))outcomeBySkill.set(id,{
      assessment_id:String(outcome.assessment_id),
      skill_id:id,
      normalized_score:outcome.normalized_score == null ? null : Number(outcome.normalized_score),
      coverage:outcome.coverage == null ? null : Number(outcome.coverage),
      created_at:String(outcome.created_at)
    });
  }

  const data: TwinChallengeSkill[]=(skills.data??[]).map(skill=>{
    const id=String(skill.id);
    const state=stateBySkill.get(id);
    return {
      id,
      name:String(skill.canonical_name),
      category:String(skill.category??"Skills"),
      description:String(skill.description??""),
      level:state?.level_value ? String(state.level_value) : "UNKNOWN",
      capability:state?.capability_score == null ? null : Number(state.capability_score),
      confidence:state?.confidence == null ? null : Number(state.confidence),
      conflict:String(state?.conflict_state??"NONE"),
      evidenceCount:Number(state?.evidence_count??0),
      lastValidatedAt:state?.last_validated_at ? String(state.last_validated_at) : null,
      questionCount:questionCounts.get(id)??0,
      activeAssessmentId:activeBySkill.get(id)??null,
      availability:challengeAvailability(questionCounts.get(id)??0,activeBySkill.get(id)),
      evidence:(evidence.data??[]).filter(item=>String(item.skill_id)===id).slice(0,4)
        .map(item=>({source_type:String(item.source_type),claim:String(item.claim),status:String(item.status),created_at:String(item.created_at)})),
      proof:buildTwinProofTrail(outcomeBySkill.get(id)??null,historyRows,decisionRows,diffRows)
    };
  });
  const {skillId}=await searchParams;
  const selectedSkillId=typeof skillId==="string" && data.some(x=>x.id===skillId)
    ? skillId : undefined;

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
      <Link href="/skills" className="quiet-link">← Back to skills</Link>
      <TwinChallengeWorkbench skills={data} initialSkillId={selectedSkillId} />
    </main>
  );
}
