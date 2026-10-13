import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import type { DiscoverableRole } from "@/components/discovery/career-discovery";
import { OrbitExplore } from "@/app/orbit-explore/orbit-explore";
import "../../orbit-lab/orbit-lab.css";
import "../../orbit-explore/orbit-explore.css";

export const metadata={title:"SkillTwin Orbit — Sample Explore",description:"Interactive career comparison with fictional catalog data."};
const req=(skillId:string,name:string,documented:boolean,stage:number,targetScore:number,groupType:"SINGLE"|"ALL_OF"|"ANY_OF"="SINGLE")=>({
  groupName:groupType==="ANY_OF"?"Alternative data tools":"Core competencies",
  groupType,skillId,documented,name,category:"Technical",
  importance:"HIGH",stage,targetScore,rationale:"Illustrative requirement for a fictional career model."
});
const roles:DiscoverableRole[]=[
  {id:"demo-ml",roleId:"demo-ml-role",name:"Machine Learning Engineer",family:"AI & Data",version:1,source:"SEEDED",personal:false,requirementCount:4,documentedCount:2,
    requirements:[req("py","Python",true,1,3.5),req("stats","Statistics",false,2,3.0),req("eval","Model Evaluation",false,3,3.5),req("sql","SQL",true,1,2.5,"ANY_OF")]},
  {id:"demo-analyst",roleId:"demo-analyst-role",name:"Data Analyst",family:"AI & Data",version:1,source:"SEEDED",personal:false,requirementCount:3,documentedCount:2,
    requirements:[req("sql","SQL",true,1,3.5),req("py","Python",true,2,2.5),req("visual","Data Visualization",false,2,3.0)]},
  {id:"demo-fullstack",roleId:"demo-stack-role",name:"Full Stack Developer",family:"Software Engineering",version:1,source:"AI_GENERATED",personal:true,requirementCount:3,documentedCount:1,
    requirements:[req("js","JavaScript",false,1,3.5),req("sql","SQL",true,2,2.5),req("api","REST APIs",false,3,3.2)]}
];
export default function ExploreDemo(){
  return <main className="orbit-lab orbit-explore">
    <div className="orbit-sample-header"><Link href="/orbit-lab"><ArrowLeft size={15}/> Back to Orbit Lab</Link>
      <div><ShieldCheck size={15}/><strong>Fictional careers · no real learner records</strong></div></div>
    <OrbitExplore roles={roles} sampleOnly/>
  </main>;
}
