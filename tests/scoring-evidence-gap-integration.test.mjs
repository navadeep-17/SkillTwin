import test from "node:test";
import assert from "node:assert/strict";
import {selectAssessmentSignals} from "../dist/lib/domain/assessment-scoring-guardrails.js";
import {estimateSkill,buildSkillDelta} from "../dist/lib/domain/skills.js";
import {analyzeRoleGaps} from "../dist/lib/domain/gap-engine.js";
import {selectEvidencePlanOperation} from "../dist/lib/domain/replan-policy.js";

/**
 * Hermetic domain-level integration. Does NOT claim an authenticated database
 * test or psychometric validation. All records here are synthetic fixtures.
 */
const skillId="synthetic-rest";
const role={
  roleId:"role",roleName:"Synthetic Backend Role",
  roleVersionId:"role-v1",version:1,
  groups:[{id:"grp",name:"REST APIs",type:"SINGLE",groupImportance:1}],
  requirements:[{
    id:"req-rest",groupId:"grp",skillId,targetScore:2,
    importance:1,learningStage:1,isDefaultAlternative:false,
    rationale:"Fixture role requires REST APIs"
  }],
  dependencies:[]
};
const observed=(difficulty,score)=>({
  score,difficulty,evaluatorConfidence:1,conceptId:"rest-concept"
});
const initial=[{
  id:"manual",skillId,sourceType:"MANUAL_SELF_REPORT",
  sourceGroupId:"manual:a",levelSignal:1.4,directness:1,quality:1,
  coverage:1,claim:"Learner reported basic REST API experience"
}];
const assessmentEvidence=signal=>({
  id:"test-assessment",skillId,sourceType:"ASSESSMENT_SUMMARY",
  sourceGroupId:"assessment:fictional",levelSignal:signal.levelSignal,
  directness:1,quality:signal.assessmentConfidence,coverage:1,
  claim:"A synthetic isolated scoring fixture, not a real assessment"
});

test("easy perfect answers do not falsely finish a missing advanced skill gap",()=>{
  const easy=selectAssessmentSignals({
    coverage:1,attempts:Array.from({length:4},()=>observed(1,1))
  },true);
  const before=estimateSkill(skillId,initial);
  const after=estimateSkill(skillId,[...initial,assessmentEvidence(easy)],before);
  const gap=analyzeRoleGaps({role,userSkills:[after]});
  assert.ok(after.capabilityScore<2,"Easy quiz cannot meet role target 2");
  assert.notEqual(gap.gaps[0].status,"STRONG");
  assert.ok(gap.gaps[0].gapSeverity>0);
  const action=selectEvidencePlanOperation([{
    taskId:"future-practice",logicalTaskId:"rest-skill",
    taskType:"PRACTICE",difficulty:"BASIC",flexible:true,
    durationMinutes:30,weekIndex:2,weekPlannedMinutes:180,
    gapStatus:gap.gaps[0].status,
    capabilityScore:after.capabilityScore,targetScore:2
  }]);
  assert.notEqual(action?.type,"REMOVE_TASK");
});

test("success on harder questions can update evidence, readiness, and a conservative future task choice",()=>{
  const before=estimateSkill(skillId,initial);
  const result=selectAssessmentSignals({
    coverage:1,attempts:Array.from({length:6},(_,i)=>observed(i%2?4:3,1))
  },true);
  const after=estimateSkill(skillId,[...initial,assessmentEvidence(result)],before);
  const beforeGap=analyzeRoleGaps({role,userSkills:[before]});
  const afterGap=analyzeRoleGaps({role,userSkills:[after]});
  const delta=buildSkillDelta(before,after,["test-assessment"]);
  assert.ok(after.capabilityScore>before.capabilityScore);
  assert.ok(afterGap.readiness>beforeGap.readiness);
  assert.ok(afterGap.gaps[0].gapSeverity<beforeGap.gaps[0].gapSeverity);
  assert.ok(delta?.changed.includes("SCORE"));
  assert.ok(delta?.evidenceIds.includes("test-assessment"));
  assert.ok(afterGap.readiness<=100);
});

test("flag-disabled legacy assessment remains unchanged in the same evidence-to-gap path",()=>{
  const input={coverage:1,attempts:Array.from({length:4},()=>observed(1,1))};
  const legacy=selectAssessmentSignals(input,false);
  const a2=selectAssessmentSignals(input,true);
  const oldState=estimateSkill(skillId,[...initial,assessmentEvidence(legacy)]);
  const newState=estimateSkill(skillId,[...initial,assessmentEvidence(a2)]);
  assert.equal(legacy.scoringVersion,"assessment-aggregator-e1");
  assert.equal(a2.scoringVersion,"assessment-aggregator-e2");
  assert.ok(oldState.capabilityScore>newState.capabilityScore);
  const oldGap=analyzeRoleGaps({role,userSkills:[oldState]});
  const newGap=analyzeRoleGaps({role,userSkills:[newState]});
  assert.ok(oldGap.readiness>newGap.readiness);
});
