import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const runner=fileURLToPath(new URL("../scripts/evidence-a3-auth-staging-qa.mjs",import.meta.url));
const env={
  ...process.env,BASE_URL:"http://127.0.0.1:3000",
  SUPABASE_URL:"https://wkbxwcspgzvvhbjhtxan.supabase.co",
  NEXT_PUBLIC_SUPABASE_URL:"",
  SUPABASE_DB_URL:"",
  DATABASE_URL:"",
  SUPABASE_ANON_KEY:"fake-public-value",
  SMOKE_ACCOUNTS_DISPOSABLE:"false",
  SMOKE_EMAIL:"test-one@example.invalid",SMOKE_PASSWORD:"test-one-password",
  SMOKE_EMAIL_2:"test-two@example.invalid",SMOKE_PASSWORD_2:"test-two-password",
  A3_EXPECTED_STATE:"enabled"
};
const fail=patch=>{
  const r=spawnSync(process.execPath,[runner],{
    encoding:"utf8",timeout:10000,env:{...env,...patch}
  });
  assert.notEqual(r.status,0,"Safety check accidentally allowed a request");
  return r.stderr;
};
test("requires explicit staging-only disposable account acknowledgement",()=>{
  assert.match(fail({}),/SMOKE_ACCOUNTS_DISPOSABLE=true/);
});
test("refuses a public or production deployment URL",()=>{
  assert.match(fail({BASE_URL:"https://skilltwin-production.up.railway.app"}),/BASE_URL must be local/);
});
test("refuses production Supabase by URL even with a local app",()=>{
  assert.match(fail({SUPABASE_URL:"https://eozvilqmrhtujqtdmrri.supabase.co"}),
    /Supabase must be the isolated/);
});
test("refuses a production DB credential or a reused second learner account",()=>{
  assert.match(fail({SUPABASE_DB_URL:"postgresql://user@eozvilqmrhtujqtdmrri.supabase.co/db"}),
    /production Supabase reference/);
  assert.match(fail({SMOKE_EMAIL_2:"test-one@example.invalid",
    SMOKE_ACCOUNTS_DISPOSABLE:"true"}),/two different disposable/);
});
test("refuses unsupported staging flag expectations",()=>{
  assert.match(fail({A3_EXPECTED_STATE:"maybe",SMOKE_ACCOUNTS_DISPOSABLE:"true"}),
    /A3_EXPECTED_STATE must/);
});
