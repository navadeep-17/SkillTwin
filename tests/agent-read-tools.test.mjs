import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  AGENT_READ_TOOLS, validateReadPlan, fallbackReadTools, isMutatingJourneyIntent
} from "../dist/lib/domain/agent-read-plan.js";

test("read tools are explicit and never include mutation or arbitrary execution",()=>{
  assert.deepEqual(AGENT_READ_TOOLS,[
    "get_skill_state","get_assessment_proof","get_role_gap","get_active_plan",
    "get_next_tasks","get_replan_reason","get_activity","get_certification_preparation"
  ]);
  for(const dangerous of ["RUN_SQL","START_ASSESSMENT","GENERATE_PLAN","UNDO_PLAN_DIFF",
    "fetch","delete_evidence","curl","http://evil.example"]) {
    assert.equal(validateReadPlan({tools:[dangerous]}),null);
  }
});
test("planner can choose at most three distinct valid read tools",()=>{
  assert.deepEqual(validateReadPlan({tools:["get_skill_state","get_role_gap"]}),
    ["get_skill_state","get_role_gap"]);
  assert.deepEqual(validateReadPlan({tools:["get_activity"]}),["get_activity"]);
  for(const bad of [
    null,undefined,{},{tools:[]},{tools:null},{tools:"get_skill_state"},
    {tools:["get_skill_state","get_skill_state"]},
    {tools:["get_skill_state","get_role_gap","get_next_tasks","get_activity"]},
    {tools:["get_role_gap"],userId:"victim"},
    {tools:["get_role_gap"],query:"DROP TABLE users"},
    {tools:["get_active_plan",{}]},
    {tools:["get_role_gap",null]}
  ]) assert.equal(validateReadPlan(bad),null);
});
test("all read-only intents have deterministic fallback and mutation intents are separate",()=>{
  assert.deepEqual(fallbackReadTools("EXPLAIN_ASSESSMENT"),["get_assessment_proof"]);
  assert.deepEqual(fallbackReadTools("WHY_ROADMAP_CHANGED"),["get_replan_reason"]);
  assert.deepEqual(fallbackReadTools("WHAT_NEXT"),["get_next_tasks","get_active_plan"]);
  assert.deepEqual(fallbackReadTools("READINESS"),["get_role_gap"]);
  assert.deepEqual(fallbackReadTools("SKILL_STATUS"),["get_skill_state","get_role_gap"]);
  assert.deepEqual(fallbackReadTools("JOURNEY_SUMMARY"),["get_role_gap","get_next_tasks"]);
  assert.deepEqual(fallbackReadTools("CERTIFICATION_PREP"),["get_certification_preparation"]);
  for(const action of ["START_ASSESSMENT","UNDO_ROADMAP_CHANGE","GENERATE_PLAN"]) {
    assert.equal(isMutatingJourneyIntent(action),true);
  }
  for(const read of ["EXPLAIN_ASSESSMENT","WHY_ROADMAP_CHANGED","WHAT_NEXT",
    "READINESS","SKILL_STATUS","CERTIFICATION_PREP","JOURNEY_SUMMARY"]) {
    assert.equal(isMutatingJourneyIntent(read),false);
  }
});
test("agent route cannot dispatch model-selected writes or substitute model user IDs",()=>{
  const read=(p)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
  const orchestrator=read("lib/services/chat/agent-read-orchestrator.ts");
  const service=read("lib/services/chat/journey-chat-service.ts");
  assert.match(service,/if \(input.enhanced && !isMutatingJourneyIntent\(intent\)\)/);
  assert.match(service,/readAssessmentProof:async \(\)=>/);
  assert.match(service,/generator: readRun\?\.meta\.generator/);
  assert.match(orchestrator,/validateReadPlan\(result\)/);
  assert.match(orchestrator,/timeoutMs:3500/);
  assert.match(orchestrator,/maxOutputTokens:220/);
  assert.match(orchestrator,/Promise\.all\(plan\.tools\.map\(/);
  assert.match(orchestrator,/where user_id=\$1::uuid/);
  assert.doesNotMatch(orchestrator,/getAssessmentService|getInitialPlanService|getAdaptiveReplannerService/);
  assert.doesNotMatch(orchestrator,/\beval\(|new Function|exec\(/);
});
test("read execution keeps learner identity and factual synthesis on server",()=>{
  const source=readFileSync(new URL("../lib/services/chat/agent-read-orchestrator.ts",import.meta.url),"utf8");
  assert.match(source,/\[input\.userId\]/);
  assert.match(source,/No upcoming task is recorded/);
  assert.match(source,/not a hiring probability/);
  assert.match(source,/never model-generated/);
  assert.match(source,/assessment reader uses exact assessment-ID matching/i);
});
