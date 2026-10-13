import test from "node:test";
import assert from "node:assert/strict";
import {calculateAssessmentSignals,ASSESSMENT_SCORING_VERSION} from "../dist/lib/domain/assessment-scoring-guardrails.js";
import {estimateSkill} from "../dist/lib/domain/skills.js";

function quiz(difficulty,count=4,score=1,evaluatorConfidence=1){
  return Array.from({length:count},(_,i)=>({
    score,difficulty,evaluatorConfidence,conceptId:"topic-"+i
  }));
}

test("perfect easy quiz cannot claim advanced proficiency",()=>{
  const easy=calculateAssessmentSignals({attempts:quiz(1),coverage:1});
  const medium=calculateAssessmentSignals({attempts:quiz(2),coverage:1});
  const challenging=calculateAssessmentSignals({attempts:quiz(3),coverage:1});
  const advanced=calculateAssessmentSignals({attempts:quiz(4),coverage:1});
  for(const v of [easy,medium,challenging,advanced]){
    assert.equal(v.normalizedScore,1);
    assert.equal(v.scoringVersion,ASSESSMENT_SCORING_VERSION);
    assert.ok(v.assessmentConfidence<0.75,
      "Four observations do not warrant HIGH assessment-confidence.");
  }
  assert.equal(easy.levelSignal,1.0);
  assert.equal(medium.levelSignal,1.65);
  assert.equal(challenging.levelSignal,2.30);
  assert.equal(advanced.levelSignal,2.95);
  assert.ok(advanced.levelSignal<3.5,
    "A short self-contained challenge cannot establish EXPERT.");
});

test("adding a wrong hard question never raises the level signal",()=>{
  const first=calculateAssessmentSignals({attempts:quiz(1,1),coverage:1});
  const mixed=calculateAssessmentSignals({attempts:[
    ...quiz(1,1),...quiz(4,1,0)
  ],coverage:1});
  assert.ok(mixed.levelSignal<first.levelSignal);
  assert.ok(mixed.normalizedScore<first.normalizedScore);
});

test("failing all questions yields zero performance regardless of difficulty",()=>{
  const easy=calculateAssessmentSignals({attempts:quiz(1,4,0),coverage:1});
  const hard=calculateAssessmentSignals({attempts:quiz(4,4,0),coverage:1});
  assert.equal(easy.normalizedScore,0);
  assert.equal(hard.normalizedScore,0);
  assert.equal(easy.levelSignal,hard.levelSignal);
  assert.equal(hard.levelSignal,0.35);
});

test("lower evaluator trust and sparse breadth reduce assessment confidence",()=>{
  const high=calculateAssessmentSignals({attempts:quiz(3),coverage:1});
  const lowTrust=calculateAssessmentSignals({attempts:quiz(3,4,1,0.25),coverage:1});
  const singleConcept=calculateAssessmentSignals({
    attempts:quiz(3).map(row=>({...row,conceptId:"only-one"})),coverage:1
  });
  const lowCoverage=calculateAssessmentSignals({attempts:quiz(3),coverage:0.25});
  assert.ok(high.assessmentConfidence>lowTrust.assessmentConfidence);
  assert.ok(high.assessmentConfidence>singleConcept.assessmentConfidence);
  assert.ok(high.assessmentConfidence>lowCoverage.assessmentConfidence);
});

test("normalized quiz scores retain the existing per-difficulty weighting",()=>{
  const signal=calculateAssessmentSignals({
    attempts:[
      {score:1,difficulty:1,evaluatorConfidence:1,conceptId:"a"},
      {score:0,difficulty:4,evaluatorConfidence:1,conceptId:"b"}
    ],coverage:1
  });
  assert.equal(signal.normalizedScore,Number((0.9/(0.9+1.2)).toFixed(4)));
  assert.ok(signal.levelSignal<1);
});

test("new scoring prevents an isolated perfect easy quiz from becoming ADVANCED",()=>{
  const easy=calculateAssessmentSignals({attempts:quiz(1),coverage:1});
  const state=estimateSkill("test-skill",[{
    id:"evidence",skillId:"test-skill",sourceType:"ASSESSMENT_SUMMARY",
    sourceGroupId:"assessment:a",levelSignal:easy.levelSignal,
    directness:1,quality:easy.assessmentConfidence,coverage:1,
    claim:"Four correctly answered difficulty-one questions"
  }]);
  assert.equal(state.level,"BEGINNER");
  assert.equal(state.capabilityScore,easy.levelSignal);
  assert.equal(state.sourceFamilyCount,1);
});

test("unbounded and invalid assessment inputs are rejected, never treated as certainty",()=>{
  assert.throws(()=>calculateAssessmentSignals({attempts:[],coverage:1}),/NO_ATTEMPTS/);
  assert.throws(()=>calculateAssessmentSignals({attempts:quiz(2),coverage:2}),/INVALID_ASSESSMENT_COVERAGE/);
  assert.throws(()=>calculateAssessmentSignals({attempts:quiz(5),coverage:1}),/INVALID_ASSESSMENT_SIGNAL/);
  assert.throws(()=>calculateAssessmentSignals({attempts:quiz(2,4,1,1.1),coverage:1}),/INVALID_ASSESSMENT_SIGNAL/);
  assert.throws(()=>calculateAssessmentSignals({attempts:quiz(2,4,Number.NaN),coverage:1}),/INVALID_ASSESSMENT_SIGNAL/);
});
