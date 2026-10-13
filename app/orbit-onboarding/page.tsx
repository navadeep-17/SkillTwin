import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, Compass, Fingerprint, LockKeyhole, Sparkles, WandSparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { OrbitPreviewNav } from "@/components/orbit/orbit-preview-nav";
import "../orbit-lab/orbit-lab.css";
import "./orbit-onboarding.css";

export const metadata = {
  title: "Build Your Twin — Orbit Experience",
  description: "An evidence-first, step-by-step SkillTwin onboarding experience."
};

export default async function OrbitOnboardingPage({
  searchParams
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const query = await searchParams;
  const initialRoleVersionId = typeof query.role === "string" && /^[a-fA-F0-9-]{36}$/.test(query.role)
    ? query.role : undefined;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login?next=%2Forbit-onboarding");

  return (
    <main className="orbit-lab orbit-onboarding">
      <OrbitPreviewNav />
      <div className="orbit-onboarding-back"><Link href="/orbit-beta"><ArrowLeft size={15}/> Back to Orbit Today</Link><span><LockKeyhole size={14}/> Private learner workspace</span></div>
      <div className="orbit-onboarding-inner">
        <section className="orbit-onboarding-hero" aria-labelledby="orbit-build-heading">
          <div className="orbit-onboarding-hero-content">
            <p className="orbit-kicker"><WandSparkles size={15}/> MAKE YOUR TWIN YOURS</p>
            <h1 id="orbit-build-heading">Your future starts<br/>with <em>what's real.</em></h1>
            <p>Choose where you're going, bring your evidence, and let SkillTwin build an adaptable learning plan around what you can actually demonstrate.</p>
            <div className="orbit-onboarding-steps-intro" aria-label="Setup flow">
              <span><Compass size={15}/> Set your direction</span>
              <ArrowRight size={14} aria-hidden="true"/>
              <span><Fingerprint size={15}/> Add your evidence</span>
              <ArrowRight size={14} aria-hidden="true"/>
              <span><Sparkles size={15}/> Begin your journey</span>
            </div>
          </div>
          <div className="orbit-onboarding-hero-decoration" aria-hidden="true">
            <div className="orbit-onboarding-orbit-outer"/><div className="orbit-onboarding-orbit-mid"/>
            <div className="orbit-onboarding-orbit-core"><span/></div>
            <i className="orbit-onboarding-star orbit-onboarding-star-a"/><i className="orbit-onboarding-star orbit-onboarding-star-b"/><i className="orbit-onboarding-star orbit-onboarding-star-c"/>
          </div>
        </section>
        <div className="orbit-onboarding-usage"><LockKeyhole size={17}/><p><strong>Real account actions.</strong> This design preview uses SkillTwin's existing goal, evidence, and roadmap services. Saving or analyzing here updates your actual signed-in profile. Use a dedicated test account during evaluation.</p></div>
        <section className="orbit-onboarding-frame" aria-label="Career and evidence onboarding">
          <OnboardingFlow initialRoleVersionId={initialRoleVersionId}/>
        </section>
        <div className="orbit-onboarding-footer"><Link href="/orbit-beta">View your evolving Twin <ArrowRight size={15}/></Link><span>SkillTwin Orbit · Guided experience</span></div>
      </div>
    </main>
  );
}
