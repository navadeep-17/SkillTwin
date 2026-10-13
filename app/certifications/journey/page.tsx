import type {Metadata} from "next";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {CertificationJourneyTracker} from "@/components/certifications/certification-journey-tracker";
import type {CertificationJourney} from "@/lib/domain/certification-journey";
import {buildCertificationPreparationPlan,type PreparationPlan} from "@/lib/domain/certification-preparation";
import {getCertificationRecommendations} from "@/lib/services/certifications/certification-service";

export const metadata:Metadata={
  title:"My Certification Journey",
  description:"Track reviewed certification preparation milestones and self-reported credentials."
};
export const dynamic="force-dynamic";

export default async function MyCertificationJourneyPage(){
  const supabase=await createClient();
  const {data:auth}=await supabase.auth.getUser();
  if(!auth.user)redirect("/login");
  const {data,error}=await supabase.from("user_certification_goals")
    .select("id,certification_id,status,completed_topics,target_exam_date,earned_date,credential_url,version,updated_at")
    .eq("user_id",auth.user.id).order("updated_at",{ascending:false}).limit(80);
  if(error)throw error;
  const goals=(data??[]) as CertificationJourney[];
  const recommendations=await getCertificationRecommendations(supabase,auth.user.id);
  const byId=new Map(recommendations.matches.map(match=>[match.certification.id,match]));
  const preparationPlans:Record<string,PreparationPlan>={};
  for(const goal of goals){
    const plan=buildCertificationPreparationPlan(goal,byId.get(goal.certification_id));
    if(plan)preparationPlans[goal.certification_id]=plan;
  }
  return <CertificationJourneyTracker initialGoals={goals} preparationPlans={preparationPlans}/>;
}
