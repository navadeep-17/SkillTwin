/**
 * A3 local authenticated staging acceptance. Does not create/modify any data.
 * Requires TWO dedicated disposable users so tenant isolation is measurable.
 * Refuses any remote app URL and the SkillTwin production Supabase project.
 */
import { createServerClient } from "@supabase/ssr";
import assert from "node:assert/strict";

const STAGING="wkbxwcspgzvvhbjhtxan";
const PRODUCTION="eozvilqmrhtujqtdmrri";
const base=process.env.BASE_URL||"http://127.0.0.1:3000";
const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.SUPABASE_ANON_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const expected=process.env.A3_EXPECTED_STATE||"enabled";

function guard(){
  const parsed=new URL(base);
  assert.ok(parsed.protocol==="http:"&&["localhost","127.0.0.1","[::1]"].includes(parsed.hostname),
    "REFUSED: BASE_URL must be local (never Railway/Vercel/production)");
  assert.equal(url,"https://"+STAGING+".supabase.co",
    "REFUSED: Supabase must be the isolated SkillTwin-Staging project");
  for(const k of ["SUPABASE_DB_URL","SUPABASE_URL","NEXT_PUBLIC_SUPABASE_URL","DATABASE_URL"]){
    assert.ok(!(process.env[k]||"").includes(PRODUCTION),
      "REFUSED: production Supabase reference detected in "+k);
  }
  assert.equal(process.env.SMOKE_ACCOUNTS_DISPOSABLE,"true",
    "REFUSED: require SMOKE_ACCOUNTS_DISPOSABLE=true for two staging accounts");
  assert.ok(key&&process.env.SMOKE_EMAIL&&process.env.SMOKE_PASSWORD
    &&process.env.SMOKE_EMAIL_2&&process.env.SMOKE_PASSWORD_2,
    "REFUSED: two unique dedicated staging account logins and staging anon key required");
  assert.notEqual(process.env.SMOKE_EMAIL,process.env.SMOKE_EMAIL_2,
    "REFUSED: use two different disposable staging accounts");
  assert.ok(expected==="enabled"||expected==="disabled",
    "REFUSED: A3_EXPECTED_STATE must be enabled or disabled");
}

async function read(path,cookie){
  const result=await fetch(base+path,{method:"GET",redirect:"manual",
    headers:cookie?{Cookie:cookie}:{}});
  const raw=await result.text();
  let parsed=null;
  try{parsed=JSON.parse(raw)}catch{}
  return {status:result.status,payload:parsed};
}

async function authCookie(email,password){
  const jar=new Map();
  const client=createServerClient(url,key,{
    cookies:{
      getAll:()=>[...jar.entries()].map(([name,value])=>({name,value})),
      setAll:items=>items.forEach(({name,value})=>jar.set(name,value))
    }
  });
  const res=await client.auth.signInWithPassword({email,password});
  assert.ok(!res.error&&res.data?.user&&res.data.session,
    "Staging login failed for a disposable user");
  assert.ok(jar.size,"Staging login returned no auth cookies");
  return [...jar.entries()].map(([k,v])=>k+"="+v).join("; ");
}
function references(preview){
  return new Set((preview?.projection?.results??[])
    .flatMap(r=>r.evidenceIds??[]).map(String));
}
function assertReadOnly(before,after,label){
  assert.deepEqual(after.payload?.data?.analysis??null,
    before.payload?.data?.analysis??null,label+" changed A1 gap snapshot during GET");
}
async function check(){
  guard();
  const anonymous=await read("/api/gaps/verification");
  if(expected==="disabled"){
    assert.equal(anonymous.status,404,"Flag OFF must hide the A3 preview endpoint");
    console.log("A3_AUTH_STAGING_FLAG_OFF=PASS");
    return;
  }
  assert.equal(anonymous.status,401,"Flag ON must reject anonymous requests");
  const [cookie1,cookie2]=await Promise.all([
    authCookie(process.env.SMOKE_EMAIL,process.env.SMOKE_PASSWORD),
    authCookie(process.env.SMOKE_EMAIL_2,process.env.SMOKE_PASSWORD_2)
  ]);
  const [baseline1,baseline2]=await Promise.all([
    read("/api/gaps",cookie1),read("/api/gaps",cookie2)
  ]);
  assert.equal(baseline1.status,200);
  assert.equal(baseline2.status,200);
  const [one,two]=await Promise.all([
    read("/api/gaps/verification",cookie1),read("/api/gaps/verification",cookie2)
  ]);
  assert.equal(one.status,200,"Staging A3 preview failed; check migration 0029 and server flag");
  assert.equal(two.status,200,"Second staging account could not read its A3 preview");
  assert.equal(one.payload?.ok,true);
  assert.equal(two.payload?.ok,true);
  const p1=one.payload.data?.preview;
  assert.ok(p1,"Primary staging account needs an existing A1 role-gap snapshot");
  assert.equal(p1.projection.originalReadiness,baseline1.payload.data?.analysis?.readiness,
    "A3 must preserve original readiness");
  assert.ok(p1.projection.results?.length>0,
    "A3 preview must contain role requirements to evaluate");
  assert.ok(p1.knowledgeObservationCount>0,
    "Read-only pilot needs at least one mapped knowledge check from an actual completed staging assessment");
  assert.match(p1.questionMappingVersion,/question-criterion-mapping-a3/);
  const p2=two.payload.data?.preview??null;
  const own=references(p1);
  const other=references(p2);
  for(const id of own)assert.ok(!other.has(id),
    "SECURITY FAILURE: cross-user evidence ID appeared in another learner preview");
  const [after1,after2]=await Promise.all([
    read("/api/gaps",cookie1),read("/api/gaps",cookie2)
  ]);
  assertReadOnly(baseline1,after1,"Learner 1");
  assertReadOnly(baseline2,after2,"Learner 2");
  console.log("A3_AUTH_STAGING=PASS");
  console.log("A3_MAPPED_KNOWLEDGE="+p1.knowledgeObservationCount);
  console.log("A3_OTHER_ATTEMPTS="+p1.unmappedOrUntrustedAttemptCount);
  console.log("A3_ISOLATION=PASS");
  console.log("A3_NO_A1_MUTATION=PASS");
}
await check();
