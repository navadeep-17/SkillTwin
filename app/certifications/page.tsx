import type {Metadata} from "next";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {getCertificationRecommendations} from "@/lib/services/certifications/certification-service";
import {CertificationExplorer} from "@/components/certifications/certification-explorer";

export const metadata:Metadata={
  title:"Certifications",
  description:"Explore official credentials tailored to your career goal, learning gaps and documented skills."
};
export const dynamic="force-dynamic";

export default async function CertificationsPage(){
  const supabase=await createClient();
  const {data:auth}=await supabase.auth.getUser();
  if(!auth.user)redirect("/login");
  const data=await getCertificationRecommendations(supabase,auth.user.id);
  return <CertificationExplorer goalName={data.goalName} hasGapSnapshot={data.hasGapSnapshot}
    matches={data.matches}/>;
}
