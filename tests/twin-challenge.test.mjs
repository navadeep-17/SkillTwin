import test from "node:test";
import assert from "node:assert/strict";
import {
  challengeAvailability,normalizedConfidence,
  evidenceReliabilityLabel,buildTwinProofTrail,containsExactReference
} from "../dist/lib/domain/twin-challenge.js";

const exampleOutcome={
  assessment_id:"assess-one",skill_id:"skill-one",
  normalized_score:0.84,coverage:0.8,created_at:"2026-10-13T12:00:00.000Z"
};
const matchingHistory={
  skill_id:"skill-one",trigger_ref:"assess-one",
  before_state:{level:"BEGINNER",capabilityScore:1.2,confidence:0.31},
  after_state:{level:"INTERMEDIATE",capabilityScore:2.2,confidence:0.67},
  explanation:"New assessed evidence led to a higher estimate."
};
test("proof launch availability requires validated coverage and resumes existing work",()=>{
  assert.equal(challengeAvailability(0),"NO_VALIDATED_BANK");
  assert.equal(challengeAvailability(3),"NO_VALIDATED_BANK");
  assert.equal(challengeAvailability(4),"READY");
  assert.equal(challengeAvailability(9),"READY");
  assert.equal(challengeAvailability(0,"existing-assessment"),"RESUME");
});
test("unknown confidence is never presented as zero",()=>{
  assert.equal(normalizedConfidence(null),null);
  assert.equal(normalizedConfidence(undefined),null);
  assert.equal(normalizedConfidence(Number.NaN),null);
  assert.equal(normalizedConfidence(0),0);
  assert.equal(normalizedConfidence(.675),68);
  assert.equal(evidenceReliabilityLabel("RESUME_SKILL_MENTION"),"Resume mention");
});
test("no completed outcome means no proof trail",()=>{
  assert.equal(buildTwinProofTrail(null,[],[],[]),null);
});
test("actual proof result shows assessment-linked before/after and a justified no-op",()=>{
  const proof=buildTwinProofTrail(exampleOutcome,[
    {...matchingHistory,trigger_ref:"other"},
    matchingHistory
  ],[
    {trigger_ref:"other",decision:"NO_OP",reason_code:"OTHER",reason:"Wrong event"},
    {trigger_ref:"assess-one",decision:"NO_OP",reason_code:"NO_SAFE_FUTURE_PATCH",reason:"No safe future work needs changing."}
  ],[]);
  assert.equal(proof.scorePercent,84);
  assert.equal(proof.coveragePercent,80);
  assert.deepEqual(proof.before,{level:"BEGINNER",confidencePercent:31,capability:1.2});
  assert.deepEqual(proof.after,{level:"INTERMEDIATE",confidencePercent:67,capability:2.2});
  assert.equal(proof.planStatus,"UNCHANGED");
  assert.match(proof.planReason,/No safe future work/);
});
test("a PlanDiff must be applied and linked by exact assessment reference",()=>{
  const wrong={id:"wrong",trigger_refs:["assess-one-other"],status:"APPLIED",summary:"Unrelated"};
  const uncommitted={id:"draft",trigger_refs:["assess-one"],status:"PENDING",summary:"Not applied"};
  const applied={id:"diff-one",trigger_refs:[{type:"ASSESSMENT",ref:"assess-one"}],status:"APPLIED",summary:"Moved a future task"};
  assert.equal(containsExactReference(wrong.trigger_refs,"assess-one"),false);
  assert.equal(containsExactReference(applied.trigger_refs,"assess-one"),true);
  const proof=buildTwinProofTrail(exampleOutcome,[matchingHistory],[],[wrong,uncommitted,applied]);
  assert.equal(proof.planStatus,"CHANGED");
  assert.equal(proof.planDiffId,"diff-one");
  assert.match(proof.planReason,/Moved a future task/);
});
test("a recorded assessment outcome does not imply a skill change or plan change",()=>{
  const proof=buildTwinProofTrail({...exampleOutcome,normalized_score:0},[],[],[]);
  assert.equal(proof.scorePercent,0);
  assert.equal(proof.before,null);
  assert.equal(proof.after,null);
  assert.equal(proof.planStatus,"NOT_RECORDED");
  assert.match(proof.planReason,/No matching roadmap decision/);
});

test("historical JSONB string snapshots display true before/after values",()=>{
  const history={...matchingHistory,
    before_state:JSON.stringify(matchingHistory.before_state),
    after_state:JSON.stringify(JSON.stringify(matchingHistory.after_state))
  };
  const proof=buildTwinProofTrail(exampleOutcome,[history],[],[]);
  assert.deepEqual(proof.before,{level:"BEGINNER",confidencePercent:31,capability:1.2});
  assert.deepEqual(proof.after,{level:"INTERMEDIATE",confidencePercent:67,capability:2.2});
  assert.equal(proof.planStatus,"NOT_RECORDED");
});
test("invalid or missing history JSON never fabricates a skill value",()=>{
  const history={...matchingHistory,before_state:"not-json",after_state:"null"};
  const proof=buildTwinProofTrail(exampleOutcome,[history],[],[]);
  assert.deepEqual(proof.before,{level:null,confidencePercent:null,capability:null});
  assert.deepEqual(proof.after,{level:null,confidencePercent:null,capability:null});
});
test("legacy snake_case snapshots are safely supported",()=>{
  const history={...matchingHistory,
    after_state:JSON.stringify({level_value:"ADVANCED",capability_score:3.1,confidence:0.83})
  };
  const proof=buildTwinProofTrail(exampleOutcome,[history],[],[]);
  assert.deepEqual(proof.after,{level:"ADVANCED",confidencePercent:83,capability:3.1});
});
