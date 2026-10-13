import Link from "next/link";
import {ArrowLeft, ShieldCheck} from "lucide-react";
import {OrbitPreviewNav} from "@/components/orbit/orbit-preview-nav";
import {LearningSettingsForm} from "@/components/settings/learning-settings-form";
import "../../orbit-lab/orbit-lab.css";
import "../../orbit-settings/orbit-settings.css";

export const metadata={title:"Orbit Settings — Fictional Demo"};
export default function SettingsDemo(){
  return <div>
    <div className="orbit-sample-header" style={{background:"#0b1020",paddingBottom:13}}>
      <Link href="/orbit-lab"><ArrowLeft size={15}/> Back to prototype</Link>
      <div><ShieldCheck size={15}/><strong>Fictional settings · saving is disabled</strong></div>
    </div>
    <main className="orbit-lab orbit-settings">
      <OrbitPreviewNav/>
      <div className="os-page">
        <div className="os-hero"><div><p className="orbit-kicker">YOUR PREFERENCES</p><h1>Settings that fit <em>your rhythm.</em></h1><p>Demonstration only. These controls don't change your real account.</p></div></div>
        <div className="os-columns"><div className="os-settings-form-wrapper">
          <LearningSettingsForm orbit demoOnly initial={{
            notifications_enabled:true,weekly_report_enabled:true,
            reduced_motion:false,compact_density:false
          }}/>
        </div><aside className="os-side"><div className="os-side-card"><h2>Fictional preview</h2><p>The real settings page retains the existing saved user preferences and secure update API. This page intentionally cannot submit them.</p></div></aside></div>
      </div>
    </main>
  </div>;
}
