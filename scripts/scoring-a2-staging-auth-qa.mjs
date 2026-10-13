/**
 * Isolated, authenticated Scoring A2 acceptance test.
 *
 * Run this script ONLY against a locally started app connected to the separate
 * SkillTwin-Staging Supabase project. Requires a disposable staging user.
 *
 * No production URLs, credentials, data copying or test-user creation.
 * This deliberately does not reset other learners or expose answer keys.
 */
import { createServerClient } from "@supabase/ssr";

const STAGING_REF = "wkbxwcspgzvvhbjhtxan";
const PROD_REF = "eozvilqmrhtujqtdmrri";
const TARGET_SKILL_ID = "10000000-0000-0000-0000-000000000007"; // REST APIs
const EXPECTED_VERSION = "assessment-aggregator-e2";
const baseUrl = process.env.BASE_URL || "http://127.0.0.1:3000";
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const email = process.env.SMOKE_EMAIL;
const password = process.env.SMOKE_PASSWORD;

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function guardEnvironment() {
  const local = new URL(baseUrl);
  assert(local.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(local.hostname),
    "REFUSED: BASE_URL must point to an application running on localhost");
  assert(supabaseUrl === `https://${STAGING_REF}.supabase.co`,
    "REFUSED: Supabase must be the isolated SkillTwin-Staging project");
  for (const key of ["SUPABASE_DB_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"]) {
    assert(!(process.env[key] || "").includes(PROD_REF),
      "REFUSED: detected production project in " + key);
  }
  assert(process.env.SMOKE_ACCOUNT_DISPOSABLE === "true",
    "REFUSED: requires SMOKE_ACCOUNT_DISPOSABLE=true for a dedicated staging account");
  assert(Boolean(anonKey && email && password),
    "Set SUPABASE_ANON_KEY, SMOKE_EMAIL and SMOKE_PASSWORD for a disposable staging account");
}

async function request(path, init={}) {
  const response = await fetch(baseUrl + path,{redirect:"manual",...init});
  const body = await response.text();
  let payload;
  try { payload=JSON.parse(body); } catch { payload=null; }
  return {response,payload};
}

async function main() {
  guardEnvironment();
  const anonymous = await request("/api/skills");
  assert(anonymous.response.status === 401,
    "Unauthenticated skill API did not reject an anonymous request");
  const jar = new Map();
  const auth = createServerClient(supabaseUrl,anonKey,{
    cookies:{
      getAll(){return [...jar].map(([name,value])=>({name,value}));},
      setAll(cookies){for (const {name,value} of cookies) jar.set(name,value);}
    }
  });
  const signedIn=await auth.auth.signInWithPassword({email,password});
  assert(!signedIn.error && signedIn.data?.session,
    "Staging account sign-in failed; create a dedicated test user in the staging Supabase project");
  const cookie=[...jar].map(([k,v])=>k+"="+v).join("; ");
  assert(cookie.length>0,"Authentication session cookie missing");

  async function authed(path,init={}) {
    const headers=new Headers(init.headers??{});
    headers.set("Cookie",cookie);
    if (init.body && !headers.has("Content-Type")) headers.set("Content-Type","application/json");
    return request(path,{...init,headers});
  }

  const created=await authed("/api/assessments",{
    method:"POST",
    body:JSON.stringify({targetSkillId:TARGET_SKILL_ID,mode:"CALIBRATION"})
  });
  assert(created.response.status===201 && created.payload?.ok===true,
    "Staging challenge creation failed (HTTP " + created.response.status + ")");
  const assessmentId=String(created.payload.data?.assessment?.id||"");
  assert(/^[0-9a-f-]{36}$/i.test(assessmentId),"Assessment ID was not returned");
  let question=created.payload.data.question;
  let completed=null;

  for(let i=0;i<10&&question;i++){
    const constructed=question.type==="SHORT_TEXT"||question.type==="SCENARIO";
    const answer=constructed
      ? {questionId:question.id,answerText:"Use validation, authorization, clear HTTP status codes, and idempotent request handling."}
      : {questionId:question.id,optionId:question.options?.[0]?.id||"a"};
    const sent=await authed("/api/assessments/"+assessmentId+"/answers",{
      method:"POST",
      body:JSON.stringify({...answer,idempotencyKey:"scoring-a2-"+assessmentId+"-"+question.id})
    });
    assert(sent.response.status===200&&sent.payload?.ok===true,
      "Staging assessment answer failed (HTTP " + sent.response.status + ")");
    const data=sent.payload.data??{};
    if(data.completed===true){completed=data;break;}
    question=data.question;
    if(!question){
      const recovered=await authed("/api/assessments/"+assessmentId);
      assert(recovered.response.status===200&&recovered.payload?.ok===true,
        "Could not recover next assessment question");
      if(recovered.payload.data?.assessment?.status==="COMPLETED"){
        completed={outcome:recovered.payload.data?.outcome};
        break;
      }
      question=recovered.payload.data?.question;
    }
  }

  assert(Boolean(completed),"Assessment did not reach COMPLETED within 10 questions");
  const final=await authed("/api/assessments/"+assessmentId);
  assert(final.response.status===200&&final.payload?.ok===true,
    "Final assessment GET failed");
  const outcome=final.payload.data?.outcome ?? completed.outcome;
  assert(Boolean(outcome),"Persisted assessment outcome missing");
  assert(outcome.aggregator_version===EXPECTED_VERSION,
    "Scoring A2 is NOT active in local staging app. Expected " + EXPECTED_VERSION
      + " but persisted " + String(outcome.aggregator_version));
  assert(Number(outcome.level_signal)>=0 && Number(outcome.level_signal)<=3.2,
    "A2 level signal exceeds its documented limits");
  assert(Number(outcome.assessment_confidence)>=0.1
    && Number(outcome.assessment_confidence)<=0.85,
    "A2 confidence exceeds its documented limits");
  const batch=outcome.evidence_batch_result??completed.evidence;
  assert(Array.isArray(batch?.acceptedEvidenceIds) && batch.acceptedEvidenceIds.length>0,
    "Scored assessment did not persist evidence");
  const skills=await authed("/api/skills");
  assert(skills.response.status===200&&skills.payload?.ok===true,
    "Could not load updated learner skills");
  const skill=skills.payload.data?.skills?.find(x=>x.skill_id===TARGET_SKILL_ID);
  assert(Boolean(skill),"Learner skill snapshot was not updated");
  const gaps=await authed("/api/gaps");
  assert(gaps.response.status===200&&gaps.payload?.ok===true,
    "Could not query role gaps after assessment");
  assert(Boolean(gaps.payload.data?.analysis),
    "Role gaps were not recomputed after assessment");

  console.log("SCORING_A2_AUTH_STAGING=PASS");
  console.log("SCORING_VERSION="+outcome.aggregator_version);
  console.log("ASSESSMENT_QUESTIONS="+String(outcome.answered??"completed"));
  console.log("SKILL_SIGNAL="+Number(outcome.level_signal).toFixed(3));
  console.log("ASSESSMENT_CONFIDENCE="+Number(outcome.assessment_confidence).toFixed(3));
  console.log("EVIDENCE_INSERTS="+batch.acceptedEvidenceIds.length);
  console.log("ROLE_GAP_REFRESH=PASS");
  console.log("REPLAN=CHECK_APPLICATION_EVENTS (can legitimately be NO_OP)");
}

await main();
