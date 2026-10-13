import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ShieldCheck, Fingerprint } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ChallengeSession } from "@/components/practice/challenge-session";
import { OrbitPreviewNav } from "@/components/orbit/orbit-preview-nav";
import "../../../orbit-lab/orbit-lab.css";
import "../../orbit-prove.css";

export const metadata = {
  title:"Verified Challenge — SkillTwin Orbit",
  description:"Complete an existing validated assessment and inspect the evidence-driven result."
};

export default async function OrbitProofSessionPage({params}:{
  params:Promise<{id:string}>
}){
  const supabase=await createClient();
  const {data:auth}=await supabase.auth.getUser();
  if(!auth.user)redirect("/login?next=%2Forbit-prove");
  const {id}=await params;
  // ChallengeSession calls existing authenticated GET/POST assessment endpoints;
  // it owns grading, evidence writes, idempotency and replanning feedback.
  return <main className="orbit-lab orbit-prove">
    <OrbitPreviewNav/>
    <div className="op-session-shell">
      <div className="op-session-head">
        <Link href="/orbit-prove"><ArrowLeft size={16}/> Return to Prove center</Link>
        <span><ShieldCheck size={15}/> Verified assessment service</span>
      </div>
      <header className="op-session-intro">
        <p className="orbit-kicker"><Fingerprint size={15}/> PROOF SESSION</p>
        <h1>Show what you really know.</h1>
        <p>Questions, scoring and evidence updates are handled by SkillTwin's existing assessment engine. After completion, return to Prove to inspect the persisted evidence and roadmap decision.</p>
      </header>
      <div className="op-session-content"><ChallengeSession assessmentId={id} proofReturnBase="/orbit-prove"/></div>
      <div className="op-trust"><ShieldCheck size={17}/><p>Do not refresh while an answer is submitting. The assessment service persists submitted progress and allows a saved active session to resume. No demonstration values are used on this screen.</p></div>
    </div>
  </main>;
}
