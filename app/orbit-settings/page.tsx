import {redirect} from "next/navigation";
import Link from "next/link";
import {ArrowRight, Bell, Gauge, ShieldCheck, Sparkles} from "lucide-react";
import {createClient} from "@/lib/supabase/server";
import {LearningSettingsForm} from "@/components/settings/learning-settings-form";
import {ThemeSwitcher} from "@/components/theme/theme-switcher";
import {OrbitPreviewNav} from "@/components/orbit/orbit-preview-nav";
import "../orbit-lab/orbit-lab.css";
import "./orbit-settings.css";

export const dynamic="force-dynamic";
export const metadata={title:"Settings — SkillTwin Orbit",description:"Manage saved learning presentation and reporting preferences."};

export default async function OrbitSettingsPage(){
  const supabase=await createClient();
  const {data:auth,error:authError}=await supabase.auth.getUser();
  if(authError||!auth.user)redirect("/login?next=%2Forbit-settings");
  const {data,error}=await supabase.from("user_learning_settings")
    .select("notifications_enabled,weekly_report_enabled,reduced_motion,compact_density")
    .eq("user_id",auth.user.id).maybeSingle();
  if(error)throw error;
  const preferences=data??{
    notifications_enabled:true,
    weekly_report_enabled:true,
    reduced_motion:false,
    compact_density:false
  };
  return <main className="orbit-lab orbit-settings">
    <OrbitPreviewNav/>
    <div className="os-page">
      <div className="os-breadcrumb"><Link href="/orbit-beta">Today</Link><span>/</span><span>Settings</span></div>
      <header className="os-hero">
        <div><p className="orbit-kicker"><Gauge size={16}/> BUILT AROUND YOU</p><h1>Make your Twin<br/><em>feel like yours.</em></h1>
          <p>Choose how SkillTwin presents progress, notifications and movement. Your evidence and readiness calculations are unaffected by these preferences.</p>
        </div>
        <div className="os-hero-art" aria-hidden="true"><div/><Sparkles size={42}/></div>
      </header>
      <div className="os-columns">
        <div className="os-settings-form-wrapper">
          <ThemeSwitcher/>
          <LearningSettingsForm initial={preferences} orbit/>
          <div className="os-warning"><ShieldCheck size={18}/><p>These are actual account preferences. Selecting <strong>Save settings</strong> writes to your saved profile; opening this page alone does not.</p></div>
        </div>
        <aside className="os-side">
          <div className="os-side-card"><Bell size={22}/><h2>Every detail, yours to control.</h2><p>Choose what gets your attention. You can revise these preferences whenever you need.</p><div className="os-side-rule"/><span><ShieldCheck size={16}/> No change to skill evidence or scores</span></div>
          <div className="os-side-card muted"><h2>Keep learning</h2><Link href="/orbit-journey">Your current Journey <ArrowRight size={16}/></Link><Link href="/orbit-activity">Agent Activity <ArrowRight size={16}/></Link><Link href="/orbit-beta">Back to Today <ArrowRight size={16}/></Link></div>
        </aside>
      </div>
    </div>
  </main>;
}
