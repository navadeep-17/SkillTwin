import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {getReviewedQuestionMapping,listReviewedQuestionMappings,QUESTION_MAPPING_A3_VERSION} from "../dist/lib/domain/assessment-question-mapping-a3.js";
import {mapTrustedGradedAttemptToCompetency} from "../dist/lib/domain/trusted-assessment-a3.js";
import {assessSkillCompetencies} from "../dist/lib/domain/evidence-estimator-a3.js";
import {addCompetencyVerification} from "../dist/lib/domain/gap-verification-a3.js";
import {estimateSkill} from "../dist/lib/domain/skills.js";
import {analyzeRoleGaps} from "../dist/lib/domain/gap-engine.js";

const source=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const bankFiles=[
  source("supabase/seed.sql"),
  source("supabase/migrations/0015_core_mcq_coverage.sql"),
  source("supabase/migrations/0022_additional_role_assessment_banks.sql")
];
const skills={"rest-api":"0007",authentication:"0008",docker:"0009",sql:"0004",python:"0001"};

function attempt(mapping,overrides={}){
  return {
    attemptId:"attempt-1",assessmentId:"assessment-1",skillId:"skill-rest",
    skillSlug:mapping.skillSlug,bankQuestionId:mapping.questionId,
    bankConceptId:mapping.conceptId,questionConceptIds:[mapping.conceptId],
    bankVersion:mapping.bankVersion,questionType:mapping.questionType,
    bankQuestionType:mapping.questionType,questionDifficulty:2,bankDifficulty:2,
    bankActive:true,assessmentStatus:"COMPLETED",attemptStatus:"EVALUATED",
    evaluationVersion:"hybrid-rubric-evaluator-e2",score:1,
    evaluatorConfidence:1,...overrides
  };
}

test("reviewed IDs, skill assignments, concepts and bank versions exist in committed SQL fixtures",()=>{
  const manifest=listReviewedQuestionMappings();
  assert.ok(manifest.length>=10);
  assert.equal(new Set(manifest.map(m=>m.questionId)).size,manifest.length);
  for(const m of manifest){
    assert.equal(m.mappingVersion,QUESTION_MAPPING_A3_VERSION);
    assert.equal(m.evaluationKind,"KNOWLEDGE_CHECK");
    assert.equal(m.questionType,"MCQ");
    const bank=bankFiles.find(s=>s.includes("'"+m.questionId+"'"));
    assert.ok(bank,"Missing bank fixture for "+m.questionId);
    const excerpt=bank.slice(bank.indexOf("'"+m.questionId+"'"),bank.indexOf("'"+m.questionId+"'")+310);
    assert.ok(excerpt.includes("10000000-0000-0000-0000-00000000"+skills[m.skillSlug]),
      "Incorrect skill mapping for "+m.questionId);
    assert.ok(excerpt.includes("'"+m.conceptId+"'"),"Concept changed for "+m.questionId);
    assert.match(excerpt,new RegExp("'"+m.conceptId+"'\\s*,\\s*'MCQ'\\s*,\\s*[1-4]"));
    assert.ok(bank.includes("'"+m.bankVersion+"'"),"Bank version missing");
    assert.equal(getReviewedQuestionMapping(m.questionId)?.criterionId,m.criterionId);
  }
  assert.equal(getReviewedQuestionMapping("unknown"),null);
});

test("a passed real MCQ is checked knowledge, never hands-on competency",()=>{
  const m=getReviewedQuestionMapping("40000000-0000-0000-0000-000000000001");
  const obs=mapTrustedGradedAttemptToCompetency(attempt(m));
  assert.ok(obs);
  assert.equal(obs.evaluationKind,"KNOWLEDGE_CHECK");
  const result=assessSkillCompetencies({skillSlug:"rest-api",targetScore:1,observations:[obs]});
  assert.equal(result.criteria.find(c=>c.id===m.criterionId).status,"KNOWLEDGE_CHECKED");
  assert.equal(result.validationState,"KNOWLEDGE_ONLY");
  assert.equal(result.demonstratedCoverage,0);
  assert.equal(result.demonstratedLevel,null);
});

test("an incorrect MCQ is a knowledge gap rather than verified practical failure",()=>{
  const m=getReviewedQuestionMapping("40000000-0000-0000-0000-000000000003");
  const obs=mapTrustedGradedAttemptToCompetency(attempt(m,{score:0}));
  assert.equal(obs.outcome,"CONTRADICTS");
  const result=assessSkillCompetencies({skillSlug:"rest-api",targetScore:1,observations:[obs]});
  assert.equal(result.validationState,"KNOWLEDGE_GAP");
  assert.equal(result.failedCriterionCount,0);
  assert.equal(result.criteria.find(c=>c.id===m.criterionId).status,"KNOWLEDGE_GAP");
});

test("A1 STRONG remains unverified despite a passed concept MCQ",()=>{
  const evidence=estimateSkill("skill-rest",[{
    id:"prose",skillId:"skill-rest",sourceType:"PROJECT_DESCRIPTION",
    sourceGroupId:"project:one",levelSignal:2.05,directness:1,quality:.72,
    coverage:.58,claim:"Designed a REST API"
  }]);
  const role={
    roleId:"r",roleName:"Backend",roleVersionId:"v1",version:1,
    groups:[{id:"g",name:"REST API",type:"SINGLE",groupImportance:1}],
    requirements:[{id:"req",groupId:"g",skillId:"skill-rest",targetScore:2,
      importance:1,learningStage:1,isDefaultAlternative:false,rationale:"REST API"}],
    dependencies:[]
  };
  const a1=analyzeRoleGaps({role,userSkills:[evidence]});
  assert.equal(a1.gaps[0].status,"STRONG");
  const m=getReviewedQuestionMapping("40000000-0000-0000-0000-000000000001");
  const obs=mapTrustedGradedAttemptToCompetency(attempt(m));
  const a3=addCompetencyVerification({
    gapAnalysis:a1,skillSlugsById:{"skill-rest":"rest-api"},
    observationsBySkillId:{"skill-rest":[obs]}
  });
  assert.equal(a3.originalReadiness,a1.readiness);
  assert.equal(a3.results[0].displayStatus,"NEEDS_VALIDATION");
  assert.equal(a3.results[0].verificationStatus,"KNOWLEDGE_ONLY");
  assert.equal(a3.results[0].demonstratedCoverage,0);
  assert.equal(a3.results[0].knowledgeCheckedCriteria.length,1);
});

test("unmapped, changed, untrusted or incomplete grading records are never promoted",()=>{
  const m=getReviewedQuestionMapping("40000000-0000-0000-0000-000000000001");
  for(const changes of [
    {bankQuestionId:"unknown"},{bankVersion:"changed"},{bankConceptId:"wrong"},
    {questionConceptIds:["wrong"]},{skillSlug:"sql"},{questionType:"SCENARIO"},
    {bankQuestionType:"SHORT_TEXT"},{questionDifficulty:3},{bankActive:false},
    {assessmentStatus:"ACTIVE"},{attemptStatus:"INVALID"},
    {evaluationVersion:"learner-v1"},{evaluatorConfidence:.5},
    {score:.6},{score:NaN}
  ]){
    assert.equal(mapTrustedGradedAttemptToCompetency(attempt(m,changes)),null);
  }
  assert.equal(mapTrustedGradedAttemptToCompetency(attempt(m,{score:0})).outcome,"CONTRADICTS");
});

test("verification API requires auth and server flag, and its service only reads user-scoped rows",()=>{
  const api=source("app/api/gaps/verification/route.ts");
  const service=source("lib/services/gaps/evidence-verification-a3-service.ts");
  const page=source("app/skills/verification/page.tsx");
  assert.match(api,/SKILLTWIN_EVIDENCE_A3_ENABLED/);
  assert.match(api,/requireUser\(\)/);
  assert.match(api,/getEvidenceA3Preview\(user\.id\)/);
  assert.match(service,/where a\.user_id=\$1::uuid/);
  assert.match(service,/sa\.user_id=a\.user_id/);
  assert.doesNotMatch(service,/update public\.|delete from public\.|insert into public\./i);
  assert.match(page,/SKILLTWIN_EVIDENCE_A3_ENABLED/);
});
