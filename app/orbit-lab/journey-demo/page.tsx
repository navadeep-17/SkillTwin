import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { OrbitJourney, type JourneyModel } from "@/app/orbit-journey/orbit-journey";
import "../../orbit-lab/orbit-lab.css";
import "../../orbit-journey/orbit-journey.css";

export const metadata={title:"SkillTwin Orbit — Journey Demo",description:"Interactive adaptive roadmap concept with fictional milestone and PlanDiff data."};
const model:JourneyModel={
  roleName:"Machine Learning Engineer · Demo",versions:2,
  plan:{id:"sample-plan",version:2,startDate:"2026-10-12",endDate:"2026-11-08",plannedMinutes:680,adaptationBufferMinutes:60,createdAt:"2026-10-12T12:00:00Z"},
  weeks:[
    {id:"w1",index:1,startDate:"2026-10-12",endDate:"2026-10-18",capacityMinutes:300,plannedMinutes:210,rationale:"Strengthen Python and SQL foundations before advanced evaluation work.",objectives:[
      {id:"o1",name:"Python",type:"REINFORCE",successCriteria:"Demonstrate reliable handling of Python collections.",targetScore:3.5}],
      tasks:[
        {id:"t1",objectiveId:"o1",type:"LEARN",title:"Review Python collections and comprehensions",status:"COMPLETED",minutes:70,dueAt:"2026-10-13T00:00:00Z",difficulty:"BASIC"},
        {id:"t2",objectiveId:"o1",type:"PRACTICE",title:"Solve data-cleaning exercises",status:"IN_PROGRESS",minutes:70,dueAt:"2026-10-16T00:00:00Z",difficulty:"STANDARD"},
        {id:"t3",objectiveId:"o1",type:"VALIDATE",title:"Demonstrate Python capability",status:"PLANNED",minutes:70,dueAt:"2026-10-18T00:00:00Z",difficulty:"STANDARD"}
      ]},
    {id:"w2",index:2,startDate:"2026-10-19",endDate:"2026-10-25",capacityMinutes:300,plannedMinutes:230,rationale:"Measure baseline statistical knowledge before specializing in model evaluation.",objectives:[
      {id:"o2",name:"Statistics",type:"VALIDATE_FIRST",successCriteria:"Explain distributions and sampling.",targetScore:3}],
      tasks:[
        {id:"t4",objectiveId:"o2",type:"LEARN",title:"Study probability distributions",status:"PLANNED",minutes:90,dueAt:"2026-10-21T00:00:00Z",difficulty:"STANDARD"},
        {id:"t5",objectiveId:"o2",type:"PRACTICE",title:"Apply confidence intervals",status:"PLANNED",minutes:80,dueAt:"2026-10-25T00:00:00Z",difficulty:"STANDARD"},
        {id:"t6",objectiveId:"o2",type:"VALIDATE",title:"Challenge statistics estimate",status:"PLANNED",minutes:60,dueAt:"2026-10-25T00:00:00Z",difficulty:"STANDARD"}]},
    {id:"w3",index:3,startDate:"2026-10-26",endDate:"2026-11-01",capacityMinutes:300,plannedMinutes:240,rationale:"Connect evaluation metrics with project evidence.",objectives:[
      {id:"o3",name:"Model Evaluation",type:"ACQUIRE",successCriteria:"Explain leakage and compare useful evaluation metrics.",targetScore:3.5}],
      tasks:[
        {id:"t7",objectiveId:"o3",type:"LEARN",title:"Compare precision, recall and F1",status:"PLANNED",minutes:90,dueAt:"2026-10-28T00:00:00Z",difficulty:"STANDARD"},
        {id:"t8",objectiveId:"o3",type:"BUILD",title:"Evaluate a sample classifier",status:"PLANNED",minutes:150,dueAt:"2026-11-01T00:00:00Z",difficulty:"ADVANCED"}]}
  ],
  diffs:[
    {id:"demo-diff",status:"APPLIED",fromVersion:1,toVersion:2,summary:"Moved Python validation earlier",reason:"New evidence suggested focused validation before adding an advanced model evaluation task.",operationsCount:2,timelineImpact:"NONE",minuteDelta:-20,touchCount:2,complexity:"MINOR",createdAt:"2026-10-12T12:00:00Z",appliedAt:"2026-10-12T12:03:00Z"}
  ],
  decisions:[
    {id:"demo-noop",decision:"NO_OP",reasonCode:"NOT_MATERIAL",reason:"A recent evidence observation did not materially change the competency gap, so the existing roadmap was preserved.",material:false,fromVersion:2,triggerType:"EVIDENCE",createdAt:"2026-10-13T10:00:00Z"}
  ]
};

export default function JourneyDemoPage(){
  return <main className="orbit-lab orbit-journey">
    <div className="orbit-sample-header">
      <Link href="/orbit-lab"><ArrowLeft size={15}/> Back to Orbit Lab</Link>
      <div><ShieldCheck size={15}/><strong>Sample concept · no learner records or changes</strong></div>
    </div>
    <OrbitJourney model={model}/>
  </main>;
}
