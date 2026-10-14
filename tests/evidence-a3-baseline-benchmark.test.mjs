/**
 * Predeclared, synthetic A1-versus-A3 safety benchmark.
 * Gold labels represent product risk scenarios authored by developers,
 * NOT blind expert judgements or measured prediction accuracy.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {estimateSkill} from "../dist/lib/domain/skills.js";
import {analyzeRoleGaps} from "../dist/lib/domain/gap-engine.js";
import {addCompetencyVerification} from "../dist/lib/domain/gap-verification-a3.js";
import {getCompetencyRubric} from "../dist/lib/domain/competency-rubrics-a3.js";
const skillId="rest-skill";
const rubric=getCompetencyRubric("rest-api");
assert.ok(rubric);
const criteria=rubric.criteria.filter(c=>c.tier<=2);
const observed=(criterion,outcome="SUPPORTS",kind="CLAIM",group="project-1")=>({
 evidenceId:[kind,criterion.id,outcome,group].join(":"),
 sourceGroupId:group,criterionId:criterion.id,
 sourceType:kind==="REVIEW"?"PROJECT_ARTIFACT_VERIFIED":
     kind==="QUIZ"?"ASSESSMENT_QUESTION":"PROJECT_DESCRIPTION",
 outcome,
 ...(kind==="REVIEW"?{evaluationKind:"INDEPENDENT_ARTIFACT_REVIEW"}:
     kind==="QUIZ"?{evaluationKind:"KNOWLEDGE_CHECK"}:{})
});
const a1=()=>{
  const skill=estimateSkill(skillId,[{
    id:"claim",skillId,sourceType:"PROJECT_DESCRIPTION",
    sourceGroupId:"project:synthetic",levelSignal:2.05,directness:1,
    quality:.72,coverage:.58,claim:"Designed REST APIs"
  }]);
  const role={
    roleId:"backend",roleName:"Backend",roleVersionId:"backend-v1",version:1,
    groups:[{id:"g",name:"REST APIs",type:"SINGLE",groupImportance:1}],
    requirements:[{id:"r",groupId:"g",skillId,targetScore:2,
      importance:1,learningStage:1,isDefaultAlternative:false,rationale:"Backend REST APIs"}],
    dependencies:[]
  };
  return analyzeRoleGaps({role,userSkills:[skill]});
};
const testCases=[
 {id:"inflated-project-claim",risk:"unsupported",observations:[observed(criteria[0])],expected:"CLAIMED_ONLY"},
 {id:"all-criteria-claimed",risk:"unsupported",observations:criteria.map(c=>observed(c)),expected:"CLAIMED_ONLY"},
 {id:"no-correlated-records",risk:"unsupported",observations:[],expected:"NO_EVIDENCE"},
 {id:"passed-mcq-only",risk:"unsupported",observations:[observed(criteria[0],"SUPPORTS","QUIZ","quiz-1")],expected:"KNOWLEDGE_ONLY"},
 {id:"failed-mcq-only",risk:"unsupported",observations:[observed(criteria[0],"CONTRADICTS","QUIZ","quiz-1")],expected:"KNOWLEDGE_GAP"},
 {id:"mixed-claims-and-quiz",risk:"unsupported",observations:[
   ...criteria.map(c=>observed(c)),observed(criteria[0],"SUPPORTS","QUIZ","quiz-2")],expected:"KNOWLEDGE_ONLY"},
 {id:"one-independent-task",risk:"unsupported",observations:[
   observed(criteria[0],"SUPPORTS","REVIEW","task-1")],expected:"PARTIALLY_DEMONSTRATED"},
 {id:"all-but-one-practical",risk:"unsupported",observations:
   criteria.slice(0,-1).map((c,i)=>observed(c,"SUPPORTS","REVIEW","task-"+i)),expected:"PARTIALLY_DEMONSTRATED"},
 {id:"failed-practical",risk:"unsupported",observations:[
   observed(criteria[0],"CONTRADICTS","REVIEW","task-fail")],expected:"CONTRADICTED"},
 {id:"independent-practical-conflict",risk:"unsupported",observations:[
   observed(criteria[0],"SUPPORTS","REVIEW","task-a"),
   observed(criteria[0],"CONTRADICTS","REVIEW","task-b")],expected:"CONTRADICTED"},
 {id:"all-independent-practical",risk:"supported",observations:
   criteria.map((c,i)=>observed(c,"SUPPORTS","REVIEW","task-"+i)),expected:"SUPPORTED"}
];

test("A3 synthetic acceptance set identifies all deliberately unverified STRONG fixtures",()=>{
  const base=a1();
  assert.equal(base.gaps[0].status,"STRONG");
  let legacyStrongUnsupported=0;
  let a3UnverifiedUnsupported=0;
  let a3SupportedCorrect=0;
  for(const item of testCases){
    const projected=addCompetencyVerification({
      gapAnalysis:base,skillSlugsById:{[skillId]:"rest-api"},
      observationsBySkillId:{[skillId]:item.observations}
    });
    const gap=projected.results[0];
    assert.equal(gap.originalStatus,"STRONG",item.id);
    assert.equal(gap.verificationStatus,item.expected,item.id);
    assert.equal(projected.originalReadiness,base.readiness,item.id);
    if(item.risk==="unsupported"){
      legacyStrongUnsupported++;
      assert.equal(gap.displayStatus,"NEEDS_VALIDATION",item.id);
      a3UnverifiedUnsupported++;
    }else{
      assert.equal(gap.displayStatus,"STRONG",item.id);
      a3SupportedCorrect++;
    }
  }
  assert.equal(testCases.length,11);
  assert.equal(legacyStrongUnsupported,10);
  assert.equal(a3UnverifiedUnsupported,10);
  assert.equal(a3SupportedCorrect,1);
  console.log(JSON.stringify({
    dataset:"A3_DEVELOPER_AUTHORED_SYNTHETIC_REGRESSION",
    cases:testCases.length,
    a1NumericallyStrongWithoutFullDemonstration:legacyStrongUnsupported,
    a3FlaggedNeedsValidation:a3UnverifiedUnsupported,
    a3RetainedSupportedDemonstration:a3SupportedCorrect,
    disclaimer:"NOT externally expert-labelled, not field accuracy, not sensitivity/specificity."
  }));
});
