import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const smoke = readFileSync(new URL("../scripts/release-smoke.mjs", import.meta.url), "utf8");

test("release smoke requires persisted assessment and its own durable replan proof", () => {
  assert.match(smoke, /\.from\("skill_assessment_outcomes"\)/);
  assert.match(smoke, /\.eq\("assessment_id", assessmentId\)/);
  assert.match(smoke, /\.from\("replan_decisions"\)/);
  assert.match(smoke, /\.eq\("trigger_ref", assessmentId\)/);
  assert.match(smoke, /\.from\("plan_diffs"\)/);
  assert.match(smoke, /diff\.status === "APPLIED" && exactRefs\(diff\.trigger_refs\)/);
  assert.match(smoke, /justifiedNoOp/);
  assert.match(smoke, /ASSESSMENT_REPLAN_PROOF=APPLIED_PLAN_DIFF/);
  assert.match(smoke, /SMOKE_REQUIRE_APPLIED_DIFF/);
});

test("agent smoke needs confirmed action, duplicate rejection and one audit event", () => {
  assert.match(smoke, /SMOKE_VERIFY_AGENT_ACTION === "true"/);
  assert.match(smoke, /proposal\?\.actionType === "START_ASSESSMENT"/);
  assert.match(smoke, /duplicate\.response\.status === 409/);
  assert.match(smoke, /\.eq\("trigger_ref", proposal\.id\)/);
  assert.match(smoke, /actionEvents\?\.length === 1/);
});

test("release smoke does not destroy production without explicit smoke setting", () => {
  assert.match(smoke, /SMOKE_DESTRUCTIVE === "true"/);
  assert.match(smoke, /if \(!destructive\)/);
  assert.match(smoke, /DEMO_RESET_SECRET is required/);
  assert.match(smoke, /SMOKE_ISOLATED === "true"/);
  assert.match(smoke, /SMOKE_TEST_DB_REF/);
  assert.match(smoke, /isolatedRef !== "eozvilqmrhtujqtdmrri"/);
  assert.match(smoke, /hostname === isolatedRef \+ "\.supabase\.co"/);
  assert.match(smoke, /skilltwin-production\.up\.railway\.app/);
});

test("multipart upload smoke must not forge an application/json boundary", () => {
  assert.match(smoke, /typeof init\.body === "string" && !headers\.has\("Content-Type"\)/);
  assert.match(smoke, /const invalidPdf = new FormData\(\)/);
  assert.match(smoke, /invalidUpload\.response\.status === 415/);
});

test("isolated smoke enforces two-learner row-level and API ownership", () => {
  assert.match(smoke, /SMOKE_VERIFY_TENANT_ISOLATION === "true"/);
  assert.match(smoke, /SMOKE_SECONDARY_EMAIL/);
  assert.match(smoke, /otherLearner\.from\(table\)\.select\("id"\)/);
  assert.match(smoke, /otherRequest\("\/api\/assessments\/" \+ assessmentId\)/);
  assert.match(smoke, /otherRequest\("\/api\/roadmap\/diffs\/" \+ applied\.id\)/);
  assert.match(smoke, /TENANT_ISOLATION_PROOF=PASS/);
});
