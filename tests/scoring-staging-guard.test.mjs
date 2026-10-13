import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../scripts/scoring-a2-staging-auth-qa.mjs",import.meta.url));
const base={
  ...process.env,
  BASE_URL:"http://127.0.0.1:3000",
  SUPABASE_URL:"https://wkbxwcspgzvvhbjhtxan.supabase.co",
  SUPABASE_DB_URL:"",
  NEXT_PUBLIC_SUPABASE_URL:"",
  SUPABASE_ANON_KEY:"public-fixture-no-access",
  SMOKE_EMAIL:"disposable@example.invalid",
  SMOKE_PASSWORD:"not-a-real-password",
  SMOKE_ACCOUNT_DISPOSABLE:"false"
};

function preflight(overrides={}){
  const r=spawnSync(process.execPath,[script],{
    env:{...base,...overrides},
    encoding:"utf8",
    timeout:10000
  });
  assert.notEqual(r.status,0,"Guard unexpectedly allowed a potentially live network request");
  return r.stderr;
}

test("requires explicit disposable-account acknowledgement before any API requests",()=>{
  assert.match(preflight(),/SMOKE_ACCOUNT_DISPOSABLE=true/);
});

test("refuses an application hosted on production Railway",()=>{
  assert.match(preflight({
    BASE_URL:"https://skilltwin-production.up.railway.app",
    SMOKE_ACCOUNT_DISPOSABLE:"true"
  }),/BASE_URL must point to an application running on localhost/);
});

test("refuses production Supabase even if local app URL is supplied",()=>{
  assert.match(preflight({
    SUPABASE_URL:"https://eozvilqmrhtujqtdmrri.supabase.co",
    SMOKE_ACCOUNT_DISPOSABLE:"true"
  }),/Supabase must be the isolated SkillTwin-Staging project/);
});

test("refuses a production postgres URL inherited from another local environment",()=>{
  assert.match(preflight({
    SUPABASE_DB_URL:"postgresql://redacted@eozvilqmrhtujqtdmrri.pooler.supabase.com:6543/postgres",
    SMOKE_ACCOUNT_DISPOSABLE:"true"
  }),/detected production project in SUPABASE_DB_URL/);
});
