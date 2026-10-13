import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {certificationById} from "../dist/lib/domain/certification-catalog.js";
import {
  planJourneyUpdate,progressPercent,CertificationJourneyError,JOURNEY_STATUSES
} from "../dist/lib/domain/certification-journey.js";

const today="2026-10-13";
const saved={
  id:"00000000-0000-0000-0000-000000000006",
  certification_id:"github-foundations",status:"SAVED",
  completed_topics:[],target_exam_date:null,
  earned_date:null,credential_url:null,version:1,updated_at:"2026-10-13T00:00:00Z"
};
const started={...saved,status:"PREPARING"};
const planned={...started,status:"EXAM_PLANNED",target_exam_date:"2026-12-01"};
const earned={...started,status:"EARNED_SELF_REPORTED",earned_date:"2026-09-30"};
const throwsCode=(fn,code)=>assert.throws(fn,e=>e instanceof CertificationJourneyError && e.code===code);

test("status labels are explicitly non-verified and owner state is independent of the recommender",()=>{
  assert.deepEqual(JOURNEY_STATUSES,[
    "SAVED","PREPARING","EXAM_PLANNED","EARNED_SELF_REPORTED"
  ]);
  assert.equal(JOURNEY_STATUSES.includes("ISSUER_VERIFIED"),false);
  const prep=planJourneyUpdate(saved,{action:"START_PREPARATION"},today);
  assert.equal(prep.status,"PREPARING");
  assert.equal(prep.credential_url,null);
  assert.equal(prep.earned_date,null);
});

test("tracked study topics are allowlisted by the selected official syllabus",()=>{
  const certification=certificationById("github-foundations");
  const topic=certification.topics[0];
  const first=planJourneyUpdate(started,{action:"TOGGLE_TOPIC",topic},today);
  assert.deepEqual(first.completed_topics,[topic]);
  assert.equal(progressPercent({...started,completed_topics:first.completed_topics}),
    Math.round(1/certification.topics.length*100));
  const removed=planJourneyUpdate({...started,completed_topics:first.completed_topics},
    {action:"TOGGLE_TOPIC",topic},today);
  assert.deepEqual(removed.completed_topics,[]);
  throwsCode(()=>planJourneyUpdate(started,{action:"TOGGLE_TOPIC",topic:"Invented training completion"},today),"INVALID_TOPIC");
  throwsCode(()=>planJourneyUpdate(saved,{action:"TOGGLE_TOPIC",topic},today),"INVALID_TRANSITION");
  throwsCode(()=>planJourneyUpdate(earned,{action:"TOGGLE_TOPIC",topic},today),"INVALID_TRANSITION");
  assert.equal(progressPercent({...started,completed_topics:["not-a-topic"]}),0);
});

test("exam target is a planning date, never a booked exam",()=>{
  const target=planJourneyUpdate(started,{action:"SET_EXAM_TARGET",targetExamDate:"2026-12-01"},today);
  assert.equal(target.status,"EXAM_PLANNED");
  assert.equal(target.target_exam_date,"2026-12-01");
  const back=planJourneyUpdate(planned,{action:"START_PREPARATION"},today);
  assert.equal(back.status,"PREPARING");
  assert.equal(back.target_exam_date,null);
  for(const invalid of ["2026-10-12","2026-02-30","tomorrow","2026-10-13T00:00Z"]){
    throwsCode(()=>planJourneyUpdate(started,{action:"SET_EXAM_TARGET",targetExamDate:invalid},today),"INVALID_DATE");
  }
  throwsCode(()=>planJourneyUpdate(earned,{action:"SET_EXAM_TARGET",targetExamDate:"2026-12-01"},today),"INVALID_TRANSITION");
});

test("credential claims stay SELF_REPORTED and URLs are never fetched or marked verified",()=>{
  const claimed=planJourneyUpdate(started,{
    action:"REPORT_EARNED",earnedDate:"2026-10-10",
    credentialUrl:"https://www.credly.com/badges/example"
  },today);
  assert.equal(claimed.status,"EARNED_SELF_REPORTED");
  assert.equal(claimed.earned_date,"2026-10-10");
  assert.equal(claimed.credential_url,"https://www.credly.com/badges/example");
  assert.equal(claimed.target_exam_date,null);
  const noUrl=planJourneyUpdate(saved,{action:"REPORT_EARNED",earnedDate:"2026-10-01"},today);
  assert.equal(noUrl.credential_url,null);
  for(const invalid of ["http://example.com","javascript:alert(1)",
    "https://localhost/test","https://127.0.0.1/a","https://user:password@example.com/"]){
    throwsCode(()=>planJourneyUpdate(started,{action:"REPORT_EARNED",
      earnedDate:"2026-10-10",credentialUrl:invalid},today),"INVALID_CREDENTIAL");
  }
  throwsCode(()=>planJourneyUpdate(started,{action:"REPORT_EARNED",earnedDate:"2026-10-14"},today),"INVALID_DATE");
});

test("new SQL table is user-only RLS with versioned optimistic writes",()=>{
  const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
  const ddl=read("supabase/migrations/0026_user_certification_journey.sql");
  const api=read("app/api/certifications/journey/[id]/route.ts");
  const save=read("app/api/certifications/journey/route.ts");
  const page=read("app/certifications/journey/page.tsx");
  const tracker=read("components/certifications/certification-journey-tracker.tsx");
  const button=read("components/certifications/save-certification-button.tsx");
  for(const term of [
    "enable row level security","force row level security",
    "certification_goal_owner_select","certification_goal_owner_insert",
    "certification_goal_owner_update","certification_goal_owner_delete",
    "unique(user_id, certification_id)","CERTIFICATION_GOAL_VERSION_MUST_INCREMENT",
    "certification_goal_credential_url_https"
  ])assert.ok(ddl.includes(term),term);
  assert.match(ddl,/user_id = \(select auth\.uid\(\)\)/);
  assert.doesNotMatch(ddl,/\bTRUNCATE\b|\bDROP TABLE\b/i);
  assert.match(api,/\.eq\("version",payload\.data\.expectedVersion\)/);
  assert.match(api,/\.eq\("user_id",user\.id\)/);
  assert.match(api,/planJourneyUpdate\(/);
  assert.match(save,/certificationById\(payload\.data\.certificationId\)/);
  assert.match(page,/redirect\("\/login"\)/);
  assert.match(tracker,/Self-reported · Not issuer-verified/);
  assert.match(tracker,/not an issuer booking/);
  assert.match(button,/Save to My Journey/);
  assert.doesNotMatch(api,/getAssessmentService|getInitialPlanService|getAdaptiveReplannerService/);
});
