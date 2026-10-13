import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  getOfficialStudyResources,buildCertificationPreparationPlan,
  certificationResourceCoverage
} from "../dist/lib/domain/certification-preparation.js";
import {CERTIFICATION_CATALOG} from "../dist/lib/domain/certification-catalog.js";
import {classifyJourneyIntent} from "../dist/lib/domain/journey-intent.js";
import {fallbackReadTools,validateReadPlan,isMutatingJourneyIntent} from "../dist/lib/domain/agent-read-plan.js";

const ref={certification_id:"github-foundations",status:"PREPARING",completed_topics:[]};
test("all reviewed issuer exams have an HTTPS preparation destination",()=>{
  assert.equal(certificationResourceCoverage(),true);
  for(const cert of CERTIFICATION_CATALOG){
    const resources=getOfficialStudyResources(cert.id);
    assert.ok(resources.length>0,cert.id);
    for(const resource of resources) {
      assert.equal(new URL(resource.url).protocol,"https:");
      assert.equal(resource.issuer,cert.issuer);
      assert.match(resource.reviewedOn,/^20\d\d-\d\d-\d\d$/);
    }
  }
  assert.deepEqual(getOfficialStudyResources("no-such-certification"),[]);
});
test("next step is based on actual topic completions, not claimed exam readiness",()=>{
  const before=buildCertificationPreparationPlan(ref);
  assert.ok(before);
  assert.equal(before.readinessLabel,"NOT_ASSESSED");
  assert.equal(before.studyCoveragePercent,0);
  assert.equal(before.nextStep?.title,"Git and GitHub workflows");
  assert.equal(before.nextStep?.phase,"LEARN");
  const after=buildCertificationPreparationPlan({...ref,completed_topics:["Git and GitHub workflows"]});
  assert.equal(after.studyCoveragePercent,33);
  assert.equal(after.nextStep?.title,"Repository collaboration");
  const complete=buildCertificationPreparationPlan({...ref,
    completed_topics:["Git and GitHub workflows","Repository collaboration","Contributions and pull requests"]});
  assert.equal(complete.studyCoveragePercent,100);
  assert.equal(complete.nextStep?.phase,"PRACTICE");
  assert.ok(complete.guidance.some(x=>/not/.test(x)));
});
test("missing documented prerequisite evidence is shown as foundation-first",()=>{
  const plan=buildCertificationPreparationPlan({
    certification_id:"aws-solutions-architect-associate",
    status:"PREPARING",completed_topics:[]
  },{missingPrerequisiteSlugs:["cloud"]});
  assert.equal(plan.nextStep.phase,"PREREQUISITES");
  assert.ok(plan.guidance.some(x=>x.includes("cloud")));
  assert.equal(plan.readinessLabel,"NOT_ASSESSED");
});
test("self-reported credential evidence does not become issuer verified",()=>{
  const plan=buildCertificationPreparationPlan({...ref,status:"EARNED_SELF_REPORTED"});
  assert.ok(plan.guidance.some(x=>x.includes("self-reported")));
  assert.ok(plan.guidance.some(x=>x.includes("issuer verification")));
  assert.equal(plan.readinessLabel,"NOT_ASSESSED");
  assert.equal(buildCertificationPreparationPlan({certification_id:"fake-id",completed_topics:[],status:"SAVED"}),null);
});
test("certification prompts never trigger generic generate-roadmap actions",()=>{
  for(const text of [
    "How do I prepare for my AWS certification exam?",
    "Generate my certification study plan",
    "Create a certification roadmap",
    "What is next for my CCNA exam preparation?",
    "What learning resources help GitHub Foundations certification?"
  ]){
    assert.equal(classifyJourneyIntent(text),"CERTIFICATION_PREP",text);
    assert.equal(isMutatingJourneyIntent(classifyJourneyIntent(text)),false);
    assert.deepEqual(fallbackReadTools("CERTIFICATION_PREP"),["get_certification_preparation"]);
    assert.deepEqual(validateReadPlan({tools:["get_certification_preparation"]}),
      ["get_certification_preparation"]);
  }
  assert.equal(classifyJourneyIntent("Generate my learning roadmap"),"GENERATE_PLAN");
  assert.equal(isMutatingJourneyIntent("GENERATE_PLAN"),true);
});
test("agent tool is owner-scoped, bound, read-only and never copies user IDs from model",()=>{
  const src=readFileSync(new URL("../lib/services/chat/agent-read-orchestrator.ts",import.meta.url),"utf8");
  const page=readFileSync(new URL("../app/certifications/journey/page.tsx",import.meta.url),"utf8");
  const ui=readFileSync(new URL("../components/certifications/certification-journey-tracker.tsx",import.meta.url),"utf8");
  assert.match(src,/from public\.user_certification_goals where user_id=\$1::uuid/);
  assert.match(src,/\[input\.userId\]/);
  assert.match(src,/get_certification_preparation/);
  assert.match(src,/buildCertificationPreparationPlan\(/);
  assert.doesNotMatch(src,/getAssessmentService|getInitialPlanService|getAdaptiveReplannerService/);
  assert.match(page,/getCertificationRecommendations\(supabase,auth\.user\.id\)/);
  assert.match(ui,/buildCertificationPreparationPlan\(goal,match\)/);
  assert.match(ui,/CertificationPreparationCard/);
});
