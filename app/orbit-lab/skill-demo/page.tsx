import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { OrbitSkillExperience, type OrbitSkill, type OrbitDependency } from "@/app/orbit-skills/orbit-skill-experience";
import "../../orbit-lab/orbit-lab.css";
import "../../orbit-skills/orbit-skills.css";

export const metadata = {
  title: "SkillTwin Orbit — Sample Skill Constellation",
  description: "Interactive skill constellation concept using fictional sample data."
};

const sample: OrbitSkill[] = [
  { requirementId:"python", skillId:"skill-python", name:"Python", category:"Programming",description:"Write and test readable Python code.",stage:1,target:3.5,capability:2.6,confidence:.72,evidenceCount:2,sourceFamilyCount:2,conflictState:null,lastValidated:null,status:"DEVELOPING",priorityBand:"MEDIUM",priorityScore:.57,gapSeverity:.27,action:"LEARN",evidence:[
    {id:"one",sourceType:"PROJECT",claim:"Sample: built a Python data-cleaning project.",levelSignal:"DEMONSTRATED",status:"ACCEPTED",createdAt:"2026-09-15T10:00:00Z"},
    {id:"two",sourceType:"RESUME",claim:"Sample: listed Python for scripting.",levelSignal:"CLAIMED",status:"NON_AGGREGATING",createdAt:"2026-09-10T10:00:00Z"}
  ]},
  { requirementId:"sql",skillId:"skill-sql",name:"SQL",category:"Databases",description:"Query relational datasets and explain joins.",stage:1,target:3,capability:3.1,confidence:.84,evidenceCount:2,sourceFamilyCount:2,conflictState:null,lastValidated:"2026-09-16T10:00:00Z",status:"STRONG",priorityBand:"COMPLETE",priorityScore:.12,gapSeverity:0,action:"MAINTAIN",evidence:[
    {id:"three",sourceType:"ASSESSMENT",claim:"Sample: answered SQL join questions.",levelSignal:"DEMONSTRATED",status:"ACCEPTED",createdAt:"2026-09-16T10:00:00Z"}
  ]},
  { requirementId:"stats",skillId:"skill-stats",name:"Statistics",category:"Mathematics",description:"Understand distributions, inference and model error.",stage:2,target:3,capability:1.4,confidence:.38,evidenceCount:1,sourceFamilyCount:1,conflictState:null,lastValidated:null,status:"GAP",priorityBand:"HIGH",priorityScore:.89,gapSeverity:.51,action:"VALIDATE_FIRST",evidence:[
    {id:"four",sourceType:"RESUME",claim:"Sample: introduction to statistical methods.",levelSignal:"CLAIMED",status:"NON_AGGREGATING",createdAt:"2026-09-07T10:00:00Z"}
  ]},
  { requirementId:"evaluation",skillId:"skill-evaluation",name:"Model Evaluation",category:"Machine Learning",description:"Evaluate model generalization, leakage and metrics.",stage:3,target:3.5,capability:1.8,confidence:.55,evidenceCount:1,sourceFamilyCount:1,conflictState:null,lastValidated:null,status:"GAP",priorityBand:"CRITICAL",priorityScore:.95,gapSeverity:.48,action:"LEARN",evidence:[
    {id:"five",sourceType:"PROJECT",claim:"Sample: used a train/test split.",levelSignal:"DEMONSTRATED",status:"ACCEPTED",createdAt:"2026-09-18T10:00:00Z"}
  ]},
  { requirementId:"deployment",skillId:"skill-deployment",name:"Model Deployment",category:"MLOps",description:"Deploy and monitor a reproducible ML inference service.",stage:4,target:3,capability:null,confidence:null,evidenceCount:0,sourceFamilyCount:0,conflictState:null,lastValidated:null,status:"UNKNOWN",priorityBand:null,priorityScore:null,gapSeverity:null,action:null,evidence:[]}
];
const links: OrbitDependency[] = [
  {from:"python",to:"evaluation",type:"HARD"},
  {from:"stats",to:"evaluation",type:"HARD"},
  {from:"sql",to:"evaluation",type:"SOFT"},
  {from:"evaluation",to:"deployment",type:"HARD"}
];

export default function SkillConstellationSample() {
  return (
    <main className="orbit-lab orbit-skills-page">
      <div className="orbit-sample-header">
        <Link href="/orbit-lab"><ArrowLeft size={15}/> Back to Orbit Lab</Link>
        <div><ShieldCheck size={15}/><strong>Sample concept · no real learner records</strong></div>
      </div>
      <OrbitSkillExperience roleName="Machine Learning Engineer · Demo" skills={sample} dependencies={links}/>
    </main>
  );
}
