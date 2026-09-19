import "server-only";
import { z } from "zod";
import { getSql } from "@/lib/db/postgres";
import { getGeminiStructuredClient } from "@/lib/ai/gemini-interactions";

export const PROJECT_RECOMMENDER_VERSION="project-recommender-d1";

type Row=Record<string,unknown>;
const rows=(value:unknown)=>value as Row[];

const aiSchema=z.object({
  title:z.string().min(4).max(140),
  summary:z.string().min(20).max(700),
  technologies:z.array(z.string().min(1).max(80)).max(12),
  requirements:z.array(z.string().min(5).max(280)).min(3).max(10),
  milestones:z.array(z.string().min(5).max(220)).min(3).max(8),
  successCriteria:z.array(z.string().min(5).max(260)).min(3).max(10)
});
const aiJsonSchema:Record<string,unknown>={
  type:"object",
  properties:{
    title:{type:"string"},summary:{type:"string"},
    technologies:{type:"array",items:{type:"string"}},
    requirements:{type:"array",items:{type:"string"}},
    milestones:{type:"array",items:{type:"string"}},
    successCriteria:{type:"array",items:{type:"string"}}
  },
  required:["title","summary","technologies","requirements","milestones","successCriteria"]
};

function template(roleName:string,skills:Array<{name:string;slug:string}>){
  const names=skills.map(x=>x.name);
  const joined=names.join(", ");
  if(roleName.includes("Backend")){
    return {
      title:"Production-ready URL Shortener",
      summary:"Build a small backend service that forces deliberate practice across "+joined+".",
      technologies:["Node.js","SQL","Docker","HTTP/REST"].filter(value=>names.some(name=>value.toLowerCase().includes(name.toLowerCase().split(" ")[0])) || ["Node.js","SQL","Docker"].includes(value)),
      requirements:[
        "Design resource-oriented create/redirect/management endpoints with explicit HTTP semantics.",
        "Persist links and metadata in a relational data model with validation and error handling.",
        "Add authentication/authorization where the active gaps require protected operations.",
        "Containerize the service and document local execution when Docker is targeted."
      ],
      milestones:["Define API contract and data model","Implement core endpoints and persistence","Add validation/tests and targeted missing-skill work","Package, document, and run final validation"],
      successCriteria:["README explains architectural choices and trade-offs","Core happy/error paths are testable","The project visibly exercises each targeted SkillTwin gap"]
    };
  }
  if(roleName.includes("Frontend")){
    return {
      title:"Accessible Performance Dashboard",
      summary:"Build a responsive frontend dashboard that targets "+joined+".",
      technologies:["HTML","CSS","TypeScript","React"],
      requirements:["Create semantic responsive layouts","Build typed reusable components and state flows","Meet keyboard/accessibility basics","Measure and improve one meaningful performance issue"],
      milestones:["Design information architecture","Implement responsive component system","Add accessibility/testing pass","Measure performance and document decisions"],
      successCriteria:["Keyboard flow works","Major views are responsive","README maps implementation evidence to the targeted gaps"]
    };
  }
  if(roleName.includes("Data Analyst")){
    return {
      title:"Business KPI Analysis",
      summary:"Create a reproducible analysis that targets "+joined+".",
      technologies:["SQL","Spreadsheets","Power BI","Pandas"],
      requirements:["Define a clear business question and metric set","Query/clean a small dataset","Create explanatory visualizations","Write a concise decision-oriented insight summary"],
      milestones:["Define metrics","Prepare/query data","Build analysis and visuals","Present findings and limitations"],
      successCriteria:["Queries/transformations are reproducible","Visual choices match the analytical question","Conclusions include caveats rather than overstating evidence"]
    };
  }
  if(roleName.includes("ML")){
    return {
      title:"Model Evaluation Pipeline",
      summary:"Build an end-to-end classical ML workflow targeting "+joined+".",
      technologies:["Python","pandas","scikit-learn","Docker"],
      requirements:["Prepare and split data without leakage","Train a baseline and at least one comparison model","Use suitable metrics and validation","Package a reproducible inference/evaluation path"],
      milestones:["Data/feature baseline","Model baseline","Evaluation/error analysis","Reproducible packaging and report"],
      successCriteria:["Validation methodology is explicit","Metrics match the problem","Error analysis informs one concrete iteration"]
    };
  }
  if(roleName.includes("Product")){
    return {
      title:"Product Discovery and Prioritization Case",
      summary:"Produce an evidence-backed product case targeting "+joined+".",
      technologies:["User Research","Product Analytics","Prioritization","Roadmapping"],
      requirements:["Frame a user/problem hypothesis","Collect or simulate structured discovery evidence","Define metrics and prioritize opportunities","Create an outcome-oriented roadmap with explicit trade-offs"],
      milestones:["Problem framing","Research/analytics synthesis","Prioritization decision","Roadmap and stakeholder narrative"],
      successCriteria:["Decisions reference evidence","Prioritization criteria are explicit","Roadmap connects work to outcomes rather than feature volume"]
    };
  }
  return {
    title:roleName+" Portfolio Project",
    summary:"Build a bounded portfolio project that intentionally targets "+joined+".",
    technologies:names.slice(0,6),
    requirements:names.slice(0,5).map(name=>"Include one demonstrable deliverable that exercises "+name+"."),
    milestones:["Define scope and success criteria","Build the smallest useful vertical slice","Validate targeted skills","Document evidence and trade-offs"],
    successCriteria:["Each targeted skill maps to observable project evidence","Scope fits the learner's weekly capacity","README explains what was learned and what remains uncertain"]
  };
}

export class ProjectRecommendationService {
  async generate(userId:string){
    const sql=getSql();
    const goal=rows(await sql.unsafe(
      "select g.*,tr.name role_name from public.career_goals g join public.role_versions rv on rv.id=g.role_version_id join public.target_roles tr on tr.id=rv.role_id where g.user_id=$1::uuid and g.status='ACTIVE' limit 1",
      [userId]
    ))[0];
    if(!goal) throw new Error("ACTIVE_GOAL_NOT_FOUND");
    const snapshot=rows(await sql.unsafe(
      "select * from public.gap_snapshots where user_id=$1::uuid and goal_id=$2::uuid order by created_at desc limit 1",
      [userId,String(goal.id)]
    ))[0];
    if(!snapshot) throw new Error("GAP_SNAPSHOT_NOT_FOUND");

    const existing=rows(await sql.unsafe(
      "select * from public.project_recommendations where user_id=$1::uuid and gap_snapshot_id=$2::uuid and status in ('ACTIVE','STARTED') order by created_at desc limit 1",
      [userId,String(snapshot.id)]
    ))[0];
    if(existing) return {recommendation:existing,reused:true};

    const gapRows=rows(await sql.unsafe(
      "select sgr.skill_id,sgr.priority_score,sgr.priority_band,sgr.gap_severity,sgr.recommended_action,s.canonical_name,s.slug from public.skill_gap_results sgr join public.skills s on s.id=sgr.skill_id where sgr.snapshot_id=$1::uuid and sgr.status<>'STRONG' order by sgr.priority_score desc,s.canonical_name limit 4",
      [String(snapshot.id)]
    ));
    if(!gapRows.length) throw new Error("NO_PROJECT_GAPS");

    const targets=gapRows.slice(0,3).map(row=>({
      id:String(row.skill_id),name:String(row.canonical_name),slug:String(row.slug),priorityBand:String(row.priority_band),
      gapSeverity:Number(row.gap_severity),recommendedAction:String(row.recommended_action)
    }));
    const fallback=template(String(goal.role_name),targets);

    let brief=fallback;
    try{
      const ai=await getGeminiStructuredClient().generateJson({
        systemInstruction:
          "You create a bounded learning project brief from supplied target-role gaps. Do not claim the learner already has skills. Do not invent external URLs, certificates, employers, or skill IDs. Keep scope to hours, not a multi-week capstone.",
        prompt:[
          "Target role: "+String(goal.role_name),
          "Career objective: "+String(goal.career_objective ?? ""),
          "Weekly capacity: "+String(goal.hours_per_week)+" hours",
          "Target gaps: "+JSON.stringify(targets),
          "Deterministic fallback brief: "+JSON.stringify(fallback),
          "Return a practical project of roughly 3-8 hours that visibly exercises all supplied target gaps."
        ].join("\n"),
        jsonSchema:aiJsonSchema,
        validator:aiSchema
      });
      if(ai) brief=ai;
    }catch(error){
      console.error("project.recommendation.ai.failed",{error:error instanceof Error?error.message:String(error)});
    }

    const estimated=Math.max(180,Math.min(480,Math.round(Number(goal.hours_per_week)*60*0.6)));
    const maxGap=Math.max(...targets.map(x=>x.gapSeverity));
    const difficulty=maxGap>=0.75?"BASIC":maxGap>=0.45?"STANDARD":"ADVANCED";
    const rationale="Targets "+targets.map(x=>x.name+" ("+x.priorityBand+")").join(", ")+" from the latest role-gap snapshot.";

    const inserted=rows(await sql.unsafe(
      "insert into public.project_recommendations(user_id,goal_id,gap_snapshot_id,title,summary,target_skill_ids,technologies,requirements,milestones,success_criteria,estimated_minutes,difficulty,rationale,generator_version) values ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11,$12,$13,$14) returning *",
      [
        userId,String(goal.id),String(snapshot.id),brief.title,brief.summary,JSON.stringify(targets.map(x=>x.id)),
        JSON.stringify(brief.technologies),JSON.stringify(brief.requirements),JSON.stringify(brief.milestones),JSON.stringify(brief.successCriteria),
        estimated,difficulty,rationale,PROJECT_RECOMMENDER_VERSION
      ]
    ))[0];

    await sql.unsafe(
      "insert into public.agent_events(user_id,event_type,trigger_type,trigger_ref,summary,entity_refs,metadata) values ($1::uuid,'project.recommendation.created','GAP_SNAPSHOT',$2,$3,$4::jsonb,$5::jsonb)",
      [userId,String(snapshot.id),"Recommended a gap-targeted project: "+brief.title+".",JSON.stringify([{type:"project_recommendation",id:String(inserted.id)},{type:"gap_snapshot",id:String(snapshot.id)}]),JSON.stringify({targetSkillIds:targets.map(x=>x.id),generatorVersion:PROJECT_RECOMMENDER_VERSION})]
    );
    return {recommendation:inserted,reused:false};
  }

  async updateStatus(userId:string,id:string,status:"STARTED"|"COMPLETED"|"DISMISSED"){
    const result=rows(await getSql().unsafe(
      "update public.project_recommendations set status=$1 where id=$2::uuid and user_id=$3::uuid and status<>'COMPLETED' returning *",
      [status,id,userId]
    ))[0];
    if(!result) throw new Error("PROJECT_RECOMMENDATION_NOT_FOUND");
    return result;
  }
}

let service:ProjectRecommendationService|null=null;
export function getProjectRecommendationService(){if(!service) service=new ProjectRecommendationService();return service;}
