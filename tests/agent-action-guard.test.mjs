import test from "node:test";
import assert from "node:assert/strict";
import { decodeAgentAction, authorizeAgentAction } from "../dist/lib/domain/agent-action-guard.js";
import { readFileSync } from "node:fs";

const uid="10000000-0000-0000-0000-000000000016";
const snap="20000000-0000-0000-0000-000000000011";
const plan="30000000-0000-0000-0000-000000000022";
const diff="40000000-0000-0000-0000-000000000033";
const current={
  gapSnapshotId:snap,activePlanId:null,activePlanVersion:null,eligibleSkill:true,diff:null
};

test("assessment action requires a validated UUID and the exact baseline gap snapshot",()=>{
  const proposal=decodeAgentAction("START_ASSESSMENT",{targetSkillId:uid},{gapSnapshotId:snap});
  assert.equal(proposal.ok,true);
  if(!proposal.ok)return;
  assert.deepEqual(authorizeAgentAction(proposal.action,current),proposal);
  assert.equal(authorizeAgentAction(proposal.action,{...current,gapSnapshotId:null}).ok,false);
  assert.deepEqual(authorizeAgentAction(proposal.action,{...current,eligibleSkill:false}),
    {ok:false,code:"INELIGIBLE_SKILL"});
  assert.deepEqual(decodeAgentAction("START_ASSESSMENT",{targetSkillId:"javascript"},{gapSnapshotId:snap}),
    {ok:false,code:"INVALID_PROPOSAL"});
  assert.equal(decodeAgentAction("START_ASSESSMENT",
    {targetSkillId:uid,sql:"drop table users"},{gapSnapshotId:snap}).ok,false);
  assert.equal(decodeAgentAction("START_ASSESSMENT",{targetSkillId:uid},{gapSnapshotId:null}).ok,false);
});

test("roadmap generation rejects changed snapshots and an existing active plan",()=>{
  const proposal=decodeAgentAction("GENERATE_PLAN",{}, {gapSnapshotId:snap});
  assert.equal(proposal.ok,true);
  if(!proposal.ok)return;
  assert.equal(authorizeAgentAction(proposal.action,current).ok,true);
  assert.deepEqual(authorizeAgentAction(proposal.action,{...current,activePlanId:plan,activePlanVersion:1}),
    {ok:false,code:"STALE_PROPOSAL"});
  assert.equal(authorizeAgentAction(proposal.action,{...current,gapSnapshotId:uid}).ok,false);
});

test("undo requires the matching applied diff, active target plan and version",()=>{
  const proposal=decodeAgentAction("UNDO_PLAN_DIFF",
    {diffId:diff},{diffId:diff,toPlanId:plan,toVersion:2});
  assert.equal(proposal.ok,true);
  if(!proposal.ok)return;
  const state={...current,activePlanId:plan,activePlanVersion:2,
    diff:{id:diff,status:"APPLIED",canUndo:true,toPlanId:plan,toVersion:2}};
  assert.equal(authorizeAgentAction(proposal.action,state).ok,true);
  for(const modified of [
    {...state,activePlanVersion:3},
    {...state,activePlanId:uid},
    {...state,diff:{...state.diff,status:"UNDONE"}},
    {...state,diff:{...state.diff,canUndo:false}},
    {...state,diff:{...state.diff,toPlanId:uid}},
    {...state,diff:null}
  ]) assert.deepEqual(authorizeAgentAction(proposal.action,modified),
    {ok:false,code:"STALE_PROPOSAL"});
  assert.equal(decodeAgentAction("UNDO_PLAN_DIFF",{diffId:uid},
    {diffId:diff,toPlanId:plan,toVersion:2}).ok,false);
  assert.equal(decodeAgentAction("UNDO_PLAN_DIFF",{diffId:diff},
    {diffId:diff,toPlanId:plan,toVersion:2.5}).ok,false);
});

test("only allowlisted mutating tool names and typed payloads pass",()=>{
  for(const action of ["RUN_SQL","DELETE_USERS","AUTO_REPLAN","",null]) {
    assert.equal(decodeAgentAction(action,{},{}).ok,false);
  }
  assert.equal(decodeAgentAction("GENERATE_PLAN",{extra:true},{gapSnapshotId:snap}).ok,false);
  assert.equal(decodeAgentAction("UNDO_PLAN_DIFF",{diffId:diff},
    {diffId:diff,toPlanId:plan,toVersion:"2"}).ok,false);
});

test("route enforces ownership, expiry and a single atomic claim before dispatch",()=>{
  const source=readFileSync(new URL("../app/api/chat/actions/[id]/confirm/route.ts",import.meta.url),"utf8");
  assert.match(source,/decodeAgentAction\(/);
  assert.match(source,/authorizeAgentAction\(/);
  assert.match(source,/user_id=\$2::uuid/);
  assert.match(source,/status='PROPOSED' and expires_at>now\(\) returning id/);
  assert.match(source,/status='REJECTED'/);
  assert.match(source,/status='CONFIRMED'/);
  assert.doesNotMatch(source,/getAssessmentService\(\)\.create\(\{[\s\S]*targetSkillId: payload/);
});
