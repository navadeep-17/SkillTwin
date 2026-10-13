import Link from "next/link";
import {ArrowLeft, ShieldCheck} from "lucide-react";
import {OrbitPreviewNav} from "@/components/orbit/orbit-preview-nav";
import {OrbitAgentActivity,type OrbitActivityEvent} from "@/app/orbit-activity/orbit-agent-activity";
import "../../orbit-lab/orbit-lab.css";
import "../../orbit-activity/orbit-activity.css";

export const metadata={title:"Orbit Agent Activity — Fictional Demo"};
const events:OrbitActivityEvent[]=[
  {id:"demo-01",eventType:"SKILL_EVIDENCE_ACCEPTED",triggerType:"ASSESSMENT_COMPLETED",summary:"Fictional example: a Python challenge supplied new evidence for a capability estimate.",createdAt:"2026-10-13T11:50:00Z",evidenceCount:2,entityCount:1},
  {id:"demo-02",eventType:"PLAN_REPLAN_NO_OP",triggerType:"SKILL_DELTA",summary:"Fictional example: the existing learning plan remained appropriate after evidence review.",createdAt:"2026-10-12T09:15:00Z",evidenceCount:1,entityCount:2},
  {id:"demo-03",eventType:"ASSESSMENT_COMPLETED",triggerType:"LEARNER_ACTION",summary:"Fictional example: a validated assessment was completed and stored.",createdAt:"2026-10-11T08:20:00Z",evidenceCount:1,entityCount:1},
  {id:"demo-04",eventType:"USER_ONBOARDING_COMPLETED",triggerType:"LEARNER_ACTION",summary:"Fictional example: initial learning constraints and career goal were saved.",createdAt:"2026-10-10T12:00:00Z",evidenceCount:0,entityCount:1}
];
export default function ActivityDemo(){
  return <div>
    <div className="orbit-sample-header" style={{background:"#0b1020",paddingBottom:13}}>
      <Link href="/orbit-lab"><ArrowLeft size={15}/> Back to prototype</Link>
      <div><ShieldCheck size={15}/><strong>Fictional activity · no real learner records</strong></div>
    </div>
    <main className="orbit-lab orbit-activity"><OrbitPreviewNav/><OrbitAgentActivity events={events}/></main>
  </div>;
}
