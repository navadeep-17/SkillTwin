import "server-only";
import { getSql } from "@/lib/db/postgres";
import { getEvidenceEngine } from "@/lib/services/skills/evidence-service";
import { getGapAnalysisService } from "@/lib/services/gaps/gap-analysis-service";
import { getInitialPlanService } from "@/lib/services/planner/initial-plan-service";
import type { EvidenceCandidate } from "@/lib/domain/skills";

export const DEMO_FIXTURE_VERSION="demo-backend-v1";
const BACKEND_ROLE_VERSION_ID="21000000-0000-0000-0000-000000000001";

const SKILLS={
  node:"10000000-0000-0000-0000-000000000003",
  sql:"10000000-0000-0000-0000-000000000004",
  git:"10000000-0000-0000-0000-000000000005",
  http:"10000000-0000-0000-0000-000000000006",
  rest:"10000000-0000-0000-0000-000000000007",
  auth:"10000000-0000-0000-0000-000000000008",
  linux:"10000000-0000-0000-0000-000000000010",
  testing:"10000000-0000-0000-0000-000000000011"
} as const;

type Row=Record<string,unknown>;
const rows=(value:unknown)=>value as Row[];

function datePlusDays(days:number){
  const date=new Date();
  date.setUTCDate(date.getUTCDate()+days);
  return date.toISOString().slice(0,10);
}

function evidence(
  skillId:string,
  sourceType:EvidenceCandidate["sourceType"],
  levelSignal:number|null,
  claim:string,
  suffix:string,
  directness:number,
  quality:number,
  coverage:number
):EvidenceCandidate{
  return {
    skillId,
    sourceType,
    sourceRef:"demo-fixture:"+DEMO_FIXTURE_VERSION,
    sourceGroupId:"demo:"+DEMO_FIXTURE_VERSION+":"+suffix,
    claim,
    levelSignal,
    directness,
    quality,
    coverage,
    metadata:{fixtureVersion:DEMO_FIXTURE_VERSION,fixture:true},
    idempotencyKey:"demo:"+DEMO_FIXTURE_VERSION+":"+suffix+":"+skillId
  };
}

export class DemoFixtureService{
  async seed(userId:string){
    const sql=getSql();

    const goalRows=rows(await sql.unsafe(
      "insert into public.career_goals(user_id,role_version_id,status,target_date,hours_per_week,preferred_session_minutes,min_session_minutes,learning_days,preferred_formats,adaptation_mode,preferred_alternatives,career_objective,goal_description,experience_level) values ($1::uuid,$2::uuid,'ACTIVE',$3::date,10,60,20,$4::jsonb,$5::jsonb,'AUTOMATIC','{}'::jsonb,$6,$7,'SOME_EXPERIENCE') returning *",
      [
        userId,
        BACKEND_ROLE_VERSION_ID,
        datePlusDays(56),
        JSON.stringify(["Mon","Tue","Wed","Thu","Fri","Sat"]),
        JSON.stringify(["projects","practice","documentation"]),
        "Become placement-ready for a Backend Engineer role",
        "Deterministic judge-demo fixture. Existing project experience is evidence-backed, while REST/HTTP semantics remain uncertain enough to validate."
      ]
    ));
    const goal=goalRows[0];

    const candidates:EvidenceCandidate[]=[
      evidence(SKILLS.node,"RESUME_PROJECT_DETAIL",2.25,"Built backend endpoints with Node.js in a project.","resume-node",0.95,0.84,0.72),
      evidence(SKILLS.sql,"RESUME_PROJECT_DETAIL",1.75,"Used SQL for relational queries and application persistence.","resume-sql",0.95,0.80,0.66),
      evidence(SKILLS.git,"RESUME_PROJECT_DETAIL",1.85,"Used Git for project version control and collaboration.","resume-git",0.92,0.78,0.62),
      evidence(SKILLS.http,"RESUME_PROJECT_DETAIL",1.45,"Implemented HTTP request/response handling in backend routes.","resume-http",0.92,0.76,0.58),
      evidence(SKILLS.rest,"RESUME_PROJECT_DETAIL",1.70,"Implemented REST API endpoints for application features.","resume-rest",0.95,0.80,0.62),
      evidence(SKILLS.auth,"RESUME_PROJECT_DETAIL",1.30,"Integrated JWT Authentication for protected routes.","resume-auth",0.90,0.74,0.54),
      evidence(SKILLS.linux,"RESUME_SKILL_MENTION",1.15,"Worked with Linux command-line tools during development.","resume-linux",0.72,0.62,0.46),
      evidence(SKILLS.testing,"RESUME_SKILL_MENTION",1.10,"Wrote basic automated tests for application routes.","resume-testing",0.72,0.62,0.44),

      evidence(SKILLS.node,"PROJECT_DESCRIPTION",2.15,"Built and maintained Node.js API routes for a working application.","project-node",1.0,0.82,0.68),
      evidence(SKILLS.sql,"PROJECT_DESCRIPTION",1.85,"Implemented SQL-backed persistence and query flows.","project-sql",1.0,0.80,0.62),
      evidence(SKILLS.rest,"PROJECT_DESCRIPTION",1.75,"Designed resource-oriented REST endpoints, but HTTP update/idempotency semantics were not explicitly validated.","project-rest",1.0,0.78,0.62),
      evidence(SKILLS.auth,"PROJECT_DESCRIPTION",1.45,"Integrated authentication and protected application operations.","project-auth",0.96,0.76,0.56)
    ];

    const evidenceResult=await getEvidenceEngine().ingestBatch({
      userId,
      trigger:{type:"DEMO_FIXTURE_SEED",ref:DEMO_FIXTURE_VERSION},
      candidates,
      producerVersion:"demo-fixture-j1"
    });

    const gap=await getGapAnalysisService().recompute(userId,{
      type:"DEMO_FIXTURE_SEED",
      ref:DEMO_FIXTURE_VERSION
    });
    const plan=await getInitialPlanService().generate(userId);

    await sql.unsafe(
      "update public.users set onboarding_step=4,onboarding_completed_at=now() where id=$1::uuid",
      [userId]
    );

    await sql.unsafe(
      "insert into public.agent_events(user_id,event_type,trigger_type,trigger_ref,summary,entity_refs,evidence_refs,metadata) values ($1::uuid,'demo.fixture.ready','DEMO_RESET',$2,$3,$4::jsonb,$5::jsonb,$6::jsonb)",
      [
        userId,
        DEMO_FIXTURE_VERSION,
        "Deterministic Backend Engineer demo baseline is ready.",
        JSON.stringify([{type:"career_goal",id:String(goal.id)},{type:"learning_plan",id:String(plan.planId)},{type:"gap_snapshot",id:String(gap.snapshotId)}]),
        JSON.stringify(evidenceResult.acceptedEvidenceIds),
        JSON.stringify({fixtureVersion:DEMO_FIXTURE_VERSION,readiness:gap.readiness,planVersion:plan.version})
      ]
    );

    const verification=await this.verify(userId);
    if(!verification.ready) throw new Error("DEMO_FIXTURE_INVARIANT_FAILED:"+verification.failures.join(","));

    return {
      fixtureVersion:DEMO_FIXTURE_VERSION,
      goalId:String(goal.id),
      gapSnapshotId:String(gap.snapshotId),
      planId:String(plan.planId),
      planVersion:plan.version,
      readiness:gap.readiness,
      evidenceAccepted:evidenceResult.acceptedEvidenceIds.length,
      verification
    };
  }

  async verify(userId:string){
    const sql=getSql();
    const [
      goalRows,planRows,snapshotRows,restSkillRows,taskCountRows,badResourceRows,assessmentRows,diffRows
    ]=await Promise.all([
      sql.unsafe(
        "select g.id,g.role_version_id,tr.slug from public.career_goals g join public.role_versions rv on rv.id=g.role_version_id join public.target_roles tr on tr.id=rv.role_id where g.user_id=$1::uuid and g.status='ACTIVE'",
        [userId]
      ),
      sql.unsafe("select id,version,status from public.learning_plans where user_id=$1::uuid and status='ACTIVE'",[userId]),
      sql.unsafe("select id,readiness,evidence_coverage from public.gap_snapshots where user_id=$1::uuid order by created_at desc limit 1",[userId]),
      sql.unsafe("select skill_id,capability_score,confidence from public.user_skills where user_id=$1::uuid and skill_id=$2::uuid limit 1",[userId,SKILLS.rest]),
      sql.unsafe("select count(*)::int count from public.learning_tasks t join public.learning_plans p on p.id=t.plan_id where p.user_id=$1::uuid and p.status='ACTIVE'",[userId]),
      sql.unsafe(
        "select count(*)::int count from public.task_resource_assignments a join public.learning_tasks t on t.id=a.task_id join public.learning_plans p on p.id=t.plan_id join public.learning_resources r on r.id=a.resource_id where p.user_id=$1::uuid and p.status='ACTIVE' and (r.is_verified=false or r.status<>'ACTIVE')",
        [userId]
      ),
      sql.unsafe("select count(*)::int count from public.skill_assessments where user_id=$1::uuid and status='ACTIVE'",[userId]),
      sql.unsafe("select count(*)::int count from public.plan_diffs where user_id=$1::uuid",[userId])
    ]);

    const goals=rows(goalRows),plans=rows(planRows),snapshots=rows(snapshotRows),rest=rows(restSkillRows);
    const failures:string[]=[];
    if(goals.length!==1) failures.push("ACTIVE_GOAL_COUNT");
    if(String(goals[0]?.slug ?? "")!=="backend-engineer") failures.push("BACKEND_ROLE");
    if(plans.length!==1) failures.push("ACTIVE_PLAN_COUNT");
    if(Number(plans[0]?.version ?? 0)!==1) failures.push("PLAN_VERSION");
    if(!snapshots[0]) failures.push("GAP_SNAPSHOT");
    if(!rest[0] || rest[0].capability_score==null) failures.push("REST_SKILL_STATE");
    if(Number(rows(taskCountRows)[0]?.count ?? 0)<=0) failures.push("LEARNING_TASKS");
    if(Number(rows(badResourceRows)[0]?.count ?? 0)!==0) failures.push("UNVERIFIED_RESOURCE_ASSIGNMENT");
    if(Number(rows(assessmentRows)[0]?.count ?? 0)!==0) failures.push("ACTIVE_ASSESSMENT_PRESENT");
    if(Number(rows(diffRows)[0]?.count ?? 0)!==0) failures.push("PLAN_DIFF_PRESENT");

    return {
      ready:failures.length===0,
      failures,
      checks:{
        activeGoals:goals.length,
        activePlans:plans.length,
        planVersion:Number(plans[0]?.version ?? 0),
        latestReadiness:snapshots[0]?.readiness==null?null:Number(snapshots[0].readiness),
        latestEvidenceCoverage:snapshots[0]?.evidence_coverage==null?null:Number(snapshots[0].evidence_coverage),
        restCapability:rest[0]?.capability_score==null?null:Number(rest[0].capability_score),
        restConfidence:rest[0]?.confidence==null?null:Number(rest[0].confidence),
        activeTaskCount:Number(rows(taskCountRows)[0]?.count ?? 0),
        invalidResourceAssignments:Number(rows(badResourceRows)[0]?.count ?? 0),
        activeAssessments:Number(rows(assessmentRows)[0]?.count ?? 0),
        planDiffs:Number(rows(diffRows)[0]?.count ?? 0)
      }
    };
  }
}

let service:DemoFixtureService|null=null;
export function getDemoFixtureService(){if(!service) service=new DemoFixtureService();return service;}
