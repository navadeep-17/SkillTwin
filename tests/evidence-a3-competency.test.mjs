import test from "node:test";
import assert from "node:assert/strict";
import { listCompetencyRubrics, getCompetencyRubric, COMPETENCY_RUBRIC_VERSION } from "../dist/lib/domain/competency-rubrics-a3.js";
import { assessSkillCompetencies, EVIDENCE_ESTIMATOR_A3_VERSION } from "../dist/lib/domain/evidence-estimator-a3.js";
import { addCompetencyVerification } from "../dist/lib/domain/gap-verification-a3.js";
import { estimateSkill } from "../dist/lib/domain/skills.js";
import { analyzeRoleGaps } from "../dist/lib/domain/gap-engine.js";

const skillId="rest-api-test";
const rubric=getCompetencyRubric("rest-api");
assert.ok(rubric);
const id=suffix => "rest-api."+suffix;
const claim=(criterionId,opts={})=>({
  evidenceId:opts.evidenceId??"claim-"+criterionId,
  sourceGroupId:opts.sourceGroupId??"project-1",
  criterionId,
  sourceType:opts.sourceType??"PROJECT_DESCRIPTION",
  outcome:opts.outcome??"SUPPORTS",
  ...(opts.evaluationKind?{evaluationKind:opts.evaluationKind}:{})
});
const question=(criterionId,opts={})=>claim(criterionId,{
  sourceType:"ASSESSMENT_QUESTION",
  sourceGroupId:opts.sourceGroupId??"graded-quiz-"+criterionId,
  evidenceId:opts.evidenceId??"question-"+criterionId,
  evaluationKind:"SERVER_EVALUATED",
  outcome:opts.outcome??"SUPPORTS"
});
const tierTwo=rubric.criteria.filter(c=>c.tier<=2);
const allPass=tierTwo.map(c=>question(c.id));
const numericalRole={
  roleId:"fixture",roleName:"Backend Engineer",roleVersionId:"fixture-v1",version:1,
  groups:[{id:"one",name:"REST APIs",type:"SINGLE",groupImportance:1}],
  requirements:[{id:"r-rest",groupId:"one",skillId,targetScore:2,importance:1,learningStage:1,isDefaultAlternative:false,rationale:"REST API delivery"}],
  dependencies:[]
};
function baseAnalysis(){
  // This is the current A1 behavior: a prose assertion alone can imply 2.05.
  const snapshot=estimateSkill(skillId,[{
    id:"old-project",skillId,sourceType:"PROJECT_DESCRIPTION",
    sourceGroupId:"project:old",levelSignal:2.05,quality:0.72,
    coverage:0.58,directness:1,claim:"Designed a REST API"
  }]);
  const gaps=analyzeRoleGaps({role:numericalRole,userSkills:[snapshot]});
  assert.equal(snapshot.level,"INTERMEDIATE");
  assert.equal(gaps.gaps[0].status,"STRONG");
  return gaps;
}
function overlay(observations,skillSlug="rest-api"){
  return addCompetencyVerification({
    gapAnalysis:baseAnalysis(),
    skillSlugsById:{[skillId]:skillSlug},
    observationsBySkillId:{[skillId]:observations}
  }).results[0];
}

test("A3 rubrics are unique, versioned, span all four tiers and cover six core skills",()=>{
  const catalog=listCompetencyRubrics();
  assert.deepEqual(catalog.map(r=>r.skillSlug).sort(),[
    "authentication","docker","git","python","rest-api","sql"
  ]);
  for(const r of catalog) {
    assert.equal(r.version,COMPETENCY_RUBRIC_VERSION);
    assert.equal(new Set(r.criteria.map(c=>c.id)).size,r.criteria.length);
    assert.deepEqual([...new Set(r.criteria.map(c=>c.tier))].sort(),[1,2,3,4]);
    assert.ok(r.criteria.every(c=>c.id.startsWith(r.skillSlug+".")&&c.description.length>12));
  }
});

test("an unverified project description cannot prove intermediate capability",()=>{
  const claimed=[
    claim(id("http-semantics")),
    claim(id("resource-routing")),
    claim(id("validation-errors")),
    claim(id("authentication"))
  ];
  const current=assessSkillCompetencies({skillSlug:"rest-api",targetScore:2,observations:claimed});
  assert.equal(current.version,EVIDENCE_ESTIMATOR_A3_VERSION);
  assert.equal(current.validationState,"CLAIMED_ONLY");
  assert.equal(current.demonstratedLevel,null);
  assert.equal(current.demonstratedCoverage,0);
  assert.equal(current.evidenceCoverage,1);
  const result=overlay(claimed);
  assert.equal(result.originalStatus,"STRONG");
  assert.equal(result.displayStatus,"NEEDS_VALIDATION");
  assert.equal(result.recommendedAction,"VALIDATE_FIRST");
  assert.ok(result.reasonCodes.includes("NUMERICALLY_STRONG_BUT_UNVERIFIED"));
  assert.equal(result.claimCoverage,1);
  assert.equal(result.demonstratedCoverage,0);
});

test("server-graded evidence must demonstrate EVERY criterion through target tier",()=>{
  const complete=assessSkillCompetencies({skillSlug:"rest-api",targetScore:2,observations:allPass});
  assert.equal(complete.targetTier,2);
  assert.equal(complete.demonstratedLevel,2);
  assert.equal(complete.validationState,"SUPPORTED");
  assert.equal(complete.demonstratedCoverage,1);
  assert.equal(overlay(allPass).displayStatus,"STRONG");
  const partial=assessSkillCompetencies({
    skillSlug:"rest-api",targetScore:2,observations:allPass.slice(1)
  });
  assert.equal(partial.demonstratedLevel,null,"Missing a beginner criterion blocks higher validation");
  assert.equal(partial.validationState,"PARTIALLY_DEMONSTRATED");
  assert.ok(partial.demonstratedCoverage<1);
  assert.equal(overlay(allPass.slice(1)).displayStatus,"NEEDS_VALIDATION");
});

test("advanced success does not bypass missing prerequisite tiers",()=>{
  const onlyAdvanced=rubric.criteria.filter(c=>c.tier===3).map(c=>question(c.id));
  const summary=assessSkillCompetencies({skillSlug:"rest-api",targetScore:3,observations:onlyAdvanced});
  assert.equal(summary.demonstratedLevel,null);
  assert.ok(summary.demonstratedCoverage<1);
  assert.equal(summary.validationState,"PARTIALLY_DEMONSTRATED");
});

test("a failed independent check overrides a self-reported pass",()=>{
  const observed=[
    ...tierTwo.map(c=>claim(c.id)),
    question(id("authentication"),{outcome:"CONTRADICTS",sourceGroupId:"failed-auth"})
  ];
  const status=assessSkillCompetencies({skillSlug:"rest-api",targetScore:2,observations:observed});
  assert.equal(status.validationState,"CONTRADICTED");
  assert.equal(status.failedCriterionCount,1);
  assert.equal(status.criteria.find(c=>c.id===id("authentication")).status,"NOT_DEMONSTRATED");
  const gap=overlay(observed);
  assert.equal(gap.displayStatus,"NEEDS_VALIDATION");
  assert.equal(gap.recommendedAction,"LEARN");
  assert.equal(gap.failedCriteria.length,1);
});

test("independent contradictory results become CONFLICTED, not a fabricated average",()=>{
  const competing=[
    question(id("authentication"),{sourceGroupId:"controlled-quiz-1",outcome:"SUPPORTS"}),
    question(id("authentication"),{sourceGroupId:"controlled-quiz-2",outcome:"CONTRADICTS"})
  ];
  const result=assessSkillCompetencies({skillSlug:"rest-api",targetScore:2,observations:competing});
  assert.equal(result.conflictedCriterionCount,1);
  assert.equal(result.validationState,"CONTRADICTED");
  assert.equal(result.criteria.find(c=>c.id===id("authentication")).status,"CONFLICTED");
});

test("duplicate items in the same source group do not cancel failed validation",()=>{
  const competing=[
    question(id("http-semantics"),{sourceGroupId:"same-test",evidenceId:"a",outcome:"SUPPORTS"}),
    question(id("http-semantics"),{sourceGroupId:"same-test",evidenceId:"b",outcome:"CONTRADICTS"}),
    question(id("http-semantics"),{sourceGroupId:"same-test",evidenceId:"c",outcome:"SUPPORTS"})
  ];
  const result=assessSkillCompetencies({skillSlug:"rest-api",targetScore:1,observations:competing});
  assert.equal(result.failedCriterionCount,1);
  assert.equal(result.criteria.find(c=>c.id===id("http-semantics")).status,"NOT_DEMONSTRATED");
  assert.equal(result.criteria.find(c=>c.id===id("http-semantics")).contradictingEvidenceIds.length,1);
});

test("artifact URL or named verified source is not proof without independent review",()=>{
  const artifact=claim(id("http-semantics"),{
    sourceType:"PROJECT_ARTIFACT_VERIFIED",evidenceId:"github-url-only"
  });
  const inferred=assessSkillCompetencies({skillSlug:"rest-api",targetScore:1,observations:[artifact]});
  assert.equal(inferred.demonstratedCoverage,0);
  assert.equal(inferred.validationState,"CLAIMED_ONLY");
  const reviewed={...artifact,evaluationKind:"INDEPENDENT_ARTIFACT_REVIEW"};
  const actual=assessSkillCompetencies({skillSlug:"rest-api",targetScore:1,observations:[reviewed]});
  assert.equal(actual.criteria.find(c=>c.id===id("http-semantics")).status,"REVIEWED");
});

test("fake assessment summary cannot assert that an independent criterion was passed",()=>{
  assert.throws(()=>assessSkillCompetencies({
    skillSlug:"rest-api",targetScore:2,
    observations:[{...claim(id("authentication"),{sourceType:"ASSESSMENT_SUMMARY"}),
      evaluationKind:"SERVER_EVALUATED"}]
  }),/INVALID_VERIFICATION_PROVENANCE/);
  assert.throws(()=>assessSkillCompetencies({
    skillSlug:"rest-api",targetScore:2,
    observations:[{...claim(id("authentication"),{sourceType:"MANUAL_SELF_REPORT"}),
      evaluationKind:"INDEPENDENT_ARTIFACT_REVIEW"}]
  }),/INVALID_VERIFICATION_PROVENANCE/);
});

test("unsupported rubric leaves legacy status intact and explicitly discloses noncoverage",()=>{
  const result=overlay([], "nonexistent-skill");
  assert.equal(result.originalStatus,"STRONG");
  assert.equal(result.displayStatus,"STRONG");
  assert.equal(result.verificationStatus,"RUBRIC_NOT_AVAILABLE");
  assert.ok(result.reasonCodes.includes("RUBRIC_NOT_DEFINED"));
});

test("unknown criterion ids and non-finite targets are rejected",()=>{
  assert.throws(()=>assessSkillCompetencies({
    skillSlug:"rest-api",targetScore:2,observations:[claim("rest-api.not-a-criterion")]
  }),/UNKNOWN_COMPETENCY_CRITERION/);
  assert.throws(()=>assessSkillCompetencies({
    skillSlug:"rest-api",targetScore:Number.NaN,observations:[]
  }),/INVALID_COMPETENCY_TARGET/);
  assert.throws(()=>assessSkillCompetencies({
    skillSlug:"not-in-rubric",targetScore:2,observations:[]
  }),/COMPETENCY_RUBRIC_NOT_FOUND/);
});

test("projection never edits the numerical readiness or A1 gap values",()=>{
  const base=baseAnalysis();
  const before=structuredClone(base);
  const result=addCompetencyVerification({
    gapAnalysis:base,skillSlugsById:{[skillId]:"rest-api"},
    observationsBySkillId:{[skillId]:[claim(id("http-semantics"))]}
  });
  assert.equal(result.originalReadiness,base.readiness);
  assert.deepEqual(base,before);
});
