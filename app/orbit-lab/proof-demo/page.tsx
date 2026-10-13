import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { OrbitProof, type OrbitProofSkill } from "@/app/orbit-prove/orbit-proof";
import "../../orbit-lab/orbit-lab.css";
import "../../orbit-prove/orbit-prove.css";

export const metadata={
  title:"SkillTwin Orbit — Proof Demo",
  description:"Interactive evidence challenge concept using entirely fictional learner data."
};

const demoSkills:OrbitProofSkill[]=[
  {
    id:"sample-python",name:"Python",category:"Programming",
    description:"Work with Python collections, comprehensions and reusable functions.",
    level:"INTERMEDIATE",capability:2.4,confidence:.68,evidenceCount:3,
    conflict:"NONE",questionCount:6,activeAssessmentId:null,availability:"READY",
    evidence:[
      {source_type:"ASSESSMENT_SUMMARY",claim:"Sample: completed a Python capability challenge.",status:"ACCEPTED",created_at:"2026-10-11T10:00:00Z"},
      {source_type:"PROJECT_DESCRIPTION",claim:"Sample: built data-cleaning scripts for CSV files.",status:"ACCEPTED",created_at:"2026-10-02T10:00:00Z"}
    ],
    proof:{
      assessmentId:"sample-completed",scorePercent:75,coveragePercent:80,
      before:{level:"BEGINNER",capability:1.7,confidencePercent:41},
      after:{level:"INTERMEDIATE",capability:2.4,confidencePercent:68},
      skillExplanation:"Fictional example: accepted assessment evidence improved the Python estimate.",
      planStatus:"UNCHANGED",planReason:"Fictional example: the existing roadmap remained appropriate after the updated estimate.",
      planDiffId:null
    }
  },
  {
    id:"sample-statistics",name:"Statistics",category:"Mathematics",
    description:"Understand distributions, inference and model evaluation methods.",
    level:"BEGINNER",capability:1.2,confidence:.33,evidenceCount:1,
    conflict:"NONE",questionCount:4,activeAssessmentId:null,availability:"READY",
    evidence:[{source_type:"RESUME_SKILL_MENTION",claim:"Sample: listed statistics as a learning interest.",status:"NON_AGGREGATING",created_at:"2026-10-03T10:00:00Z"}],
    proof:null
  },
  {
    id:"sample-deployment",name:"Model Deployment",category:"MLOps",
    description:"Prepare and monitor model inference in production.",
    level:"UNKNOWN",capability:null,confidence:null,evidenceCount:0,
    conflict:"NONE",questionCount:0,activeAssessmentId:null,availability:"NO_VALIDATED_BANK",
    evidence:[],proof:null
  }
];

export default function ProofDemo(){
  return <main className="orbit-lab orbit-prove">
    <div className="orbit-sample-header">
      <Link href="/orbit-lab"><ArrowLeft size={15}/> Back to Orbit Lab</Link>
      <div><ShieldCheck size={15}/><strong>Fictional demo · no account records or writes</strong></div>
    </div>
    <OrbitProof skills={demoSkills} initialSkillId="sample-python" demoOnly/>
  </main>;
}
