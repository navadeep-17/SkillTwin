import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {verifiedPracticalReviewObservation,PRACTICAL_REVIEW_A3_VERSION}
  from "../dist/lib/domain/trusted-practical-review-a3.js";
import {assessSkillCompetencies} from "../dist/lib/domain/evidence-estimator-a3.js";
import {addCompetencyVerification} from "../dist/lib/domain/gap-verification-a3.js";
import {analyzeRoleGaps} from "../dist/lib/domain/gap-engine.js";
import {estimateSkill} from "../dist/lib/domain/skills.js";
import {getCompetencyRubric,COMPETENCY_RUBRIC_VERSION}
  from "../dist/lib/domain/competency-rubrics-a3.js";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const sha="abcdef1234567890abcdef1234567890abcdef12";
const uuid1="11111111-1111-4111-8111-111111111111";
const uuid2="22222222-2222-4222-8222-222222222222";
const review=(overrides={})=>({
  id:"review-1",learnerUserId:uuid1,reviewerUserId:uuid2,
  projectId:"project-one",projectVersion:1,skillId:"rest-skill",skillSlug:"rest-api",
  criterionId:"rest-api.resource-routing",rubricVersion:COMPETENCY_RUBRIC_VERSION,
  repositoryUrl:"https://github.com/testowner/realproject",
  projectRepositoryUrl:"https://github.com/testowner/realproject",
  commitSha:sha,reviewedSourcePath:"src/api.ts",reviewedBlobSha:sha,
  reviewMethod:"OBSERVED_PRACTICAL_DEMO",verdict:"PASS",
  reviewerActive:true,
  practicalTask:"Observed learner implement a route on a pinned source commit and describe routing behavior in detail.",
  observedResult:"Reviewer observed the learner make an endpoint change, run a request and explain the response.",
  testProcedure:"Reviewer ran GET /orders/42 and checked the resulting response status.",
  ...overrides
});

test("only an active independent reviewer with a pinned project/version creates practical proof",()=>{
  const o=verifiedPracticalReviewObservation(review());
  assert.ok(o);
  assert.equal(o.sourceType,"PROJECT_ARTIFACT_VERIFIED");
  assert.equal(o.evaluationKind,"INDEPENDENT_ARTIFACT_REVIEW");
  assert.equal(o.outcome,"SUPPORTS");
  assert.match(o.sourceGroupId,/practical-review:project-one:v1/);
  assert.equal(PRACTICAL_REVIEW_A3_VERSION,"reviewer-practical-a3-1");
});

test("revoked reviewer, self-review, changed repository or claim-only context are rejected",()=>{
  for(const changes of [
    {reviewerActive:false},
    {reviewerUserId:uuid1},
    {projectRepositoryUrl:"https://github.com/elsewhere/repo"},
    {repositoryUrl:"https://evil.example/repo",projectRepositoryUrl:"https://evil.example/repo"},
    {commitSha:"not-a-commit"},{rubricVersion:"unreviewed-version"},
    {reviewedSourcePath:"../secrets"},{reviewedBlobSha:"bad-blob"},
    {criterionId:"rest-api.unknown"},{skillSlug:"sql"},
    {projectVersion:0},{reviewMethod:"AI_PROJECT_FEEDBACK"},
    {verdict:"UNSURE"},
    {practicalTask:"short"},
    {testProcedure:"not tested"},
    {observedResult:"small"}
  ]){
    assert.equal(verifiedPracticalReviewObservation(review(changes)),null,JSON.stringify(changes));
  }
});

test("failed practical review is a verified contradiction, not a missing observation",()=>{
  const o=verifiedPracticalReviewObservation(review({verdict:"FAIL"}));
  assert.equal(o.outcome,"CONTRADICTS");
  const assessment=assessSkillCompetencies({
    skillSlug:"rest-api",targetScore:1,observations:[o]
  });
  assert.equal(assessment.validationState,"CONTRADICTED");
  assert.equal(assessment.failedCriterionCount,1);
});

test("independent reviewed tasks can cover a tier while preserving A1 values",()=>{
  const criteria=getCompetencyRubric("rest-api").criteria.filter(c=>c.tier<=2);
  const observations=criteria.map((c,i)=>verifiedPracticalReviewObservation(review({
    id:"review-"+i,criterionId:c.id,
    projectId:"project-"+i,
    repositoryUrl:"https://github.com/testowner/realproject",
    projectRepositoryUrl:"https://github.com/testowner/realproject"
  })));
  assert.ok(observations.every(Boolean));
  const estimate=estimateSkill("rest-skill",[{
    id:"legacy-self",skillId:"rest-skill",sourceType:"PROJECT_DESCRIPTION",
    sourceGroupId:"project:one",levelSignal:2.05,directness:1,quality:.72,
    coverage:.58,claim:"Designed a REST API"
  }]);
  const role={
    roleId:"backend",roleName:"Backend",roleVersionId:"role-v1",version:1,
    groups:[{id:"g",name:"REST APIs",type:"SINGLE",groupImportance:1}],
    requirements:[{id:"r",groupId:"g",skillId:"rest-skill",targetScore:2,
      importance:1,learningStage:1,isDefaultAlternative:false,rationale:"REST"}],
    dependencies:[]
  };
  const a1=analyzeRoleGaps({role,userSkills:[estimate]});
  const overlay=addCompetencyVerification({
    gapAnalysis:a1,skillSlugsById:{"rest-skill":"rest-api"},
    observationsBySkillId:{"rest-skill":observations}
  });
  assert.equal(overlay.originalReadiness,a1.readiness);
  assert.equal(overlay.results[0].verificationStatus,"SUPPORTED");
  assert.equal(overlay.results[0].displayStatus,"STRONG");
  assert.equal(overlay.results[0].demonstratedCoverage,1);
  assert.equal(a1.gaps[0].status,"STRONG");
});

test("the reviewer API trusts the signed-in reviewer, not a submitted reviewer ID",()=>{
  const code=read("app/api/skills/verification/reviews/route.ts");
  const svc=read("lib/services/skills/practical-review-a3-service.ts");
  const migration=read("supabase/migrations/0029_a3_practical_review_attestations.sql");
  const a3=read("lib/services/gaps/evidence-verification-a3-service.ts");
  assert.match(code,/requireUser\(\)/);
  assert.match(code,/submitPracticalReview\(payload\.data,user\.id\)/);
  assert.match(code,/observedLearnerLive:z\.literal\(true\)/);
  assert.match(code,/\.strict\(\)/);
  assert.match(svc,/competency_reviewers where user_id=\$1::uuid and active=true for share/);
  assert.match(svc,/reviewerId===input\.learnerUserId/);
  assert.match(svc,/inspectPublicRepository\(url\)/);
  assert.match(svc,/COMPETENCY_RUBRIC_VERSION/);
  assert.match(svc,/on conflict do nothing/);
  assert.match(migration,/check \(reviewer_user_id <> learner_user_id\)/);
  assert.match(migration,/enable row level security/);
  assert.match(migration,/revoke all on public\.competency_practical_reviews from anon, authenticated/);
  assert.match(a3,/where r\.learner_user_id=\$1::uuid/);
  assert.match(a3,/cr\.active=true/);
  assert.match(a3,/verifiedPracticalReviewObservation/);
  assert.doesNotMatch(a3,/insert into public\.competency_practical_reviews/);
});
