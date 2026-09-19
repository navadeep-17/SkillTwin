import test from "node:test";
import assert from "node:assert/strict";
import { runVerticalSlice } from "../dist/lib/domain/demo.js";

test("assessment improves REST capability and confidence", () => {
  const result = runVerticalSlice();
  const before = result.before.skills.find(s => s.skillId === "rest-api");
  const after = result.after.skills.find(s => s.skillId === "rest-api");
  assert.ok(before && after);
  assert.ok((after.capabilityScore ?? 0) > (before.capabilityScore ?? 0));
  assert.ok(after.confidence > before.confidence);
});

test("planner preserves adaptation buffer", () => {
  const result = runVerticalSlice();
  const plan = result.before.plan;
  const planned = plan.tasks.reduce((sum, t) => sum + t.minutes, 0);
  assert.ok(planned <= plan.weeklyCapacity - plan.adaptationBuffer);
});

test("replanner creates a versioned minimal patch", () => {
  const result = runVerticalSlice();
  assert.equal(result.planDiff.fromVersion, 1);
  assert.equal(result.planDiff.toVersion, 2);
  assert.equal(result.planDiff.operations.length, 1);
  assert.equal(result.planDiff.operations[0].type, "ADD_TASK");
});


import { generateInitialLearningPlan } from "../dist/lib/domain/learning-planner.js";

test("learning planner reserves adaptation buffer and limits weekly focus", () => {
  const gaps = [
    { requirementId:"r-http",skillId:"s-http",skillName:"HTTP",skillSlug:"http",currentScore:1.1,currentConfidence:0.5,targetScore:2,priorityScore:0.9,priorityBand:"CRITICAL",status:"GAP",recommendedAction:"LEARN",learningStage:1 },
    { requirementId:"r-rest",skillId:"s-rest",skillName:"REST APIs",skillSlug:"rest-api",currentScore:1.2,currentConfidence:0.52,targetScore:2,priorityScore:0.88,priorityBand:"CRITICAL",status:"GAP",recommendedAction:"LEARN",learningStage:2 },
    { requirementId:"r-docker",skillId:"s-docker",skillName:"Docker",skillSlug:"docker",currentScore:null,currentConfidence:0.1,targetScore:1.5,priorityScore:0.8,priorityBand:"HIGH",status:"GAP",recommendedAction:"VALIDATE_FIRST",learningStage:3 }
  ];
  const plan = generateInitialLearningPlan(gaps, {
    hoursPerWeek: 10,
    learningDays: ["Mon","Tue","Wed","Thu","Fri","Sat"],
    preferredSessionMinutes: 60,
    minSessionMinutes: 20
  });
  assert.equal(plan.weeklyCapacityMinutes, 600);
  assert.equal(plan.adaptationBufferMinutes, 60);
  assert.ok(plan.weeks.every(week => week.focusSkillIds.length <= 2));
  assert.ok(plan.weeks.every(week => week.plannedMinutes <= 540));
});

test("low-confidence important gap starts with validation", () => {
  const plan = generateInitialLearningPlan([{
    requirementId:"r-docker",skillId:"s-docker",skillName:"Docker",skillSlug:"docker",
    currentScore:null,currentConfidence:0.1,targetScore:1.5,priorityScore:0.8,
    priorityBand:"HIGH",status:"GAP",recommendedAction:"VALIDATE_FIRST",learningStage:3
  }], {
    hoursPerWeek: 5,
    learningDays:["Mon","Wed","Sat"],
    preferredSessionMinutes:45,
    minSessionMinutes:20
  });
  assert.equal(plan.weeks[0].objectives[0].tasks[0].type, "VALIDATE");
});


import { estimateSkill, effectiveWeight } from "../dist/lib/domain/skills.js";
import { analyzeRoleGaps } from "../dist/lib/domain/gap-engine.js";

const state = (skillId, capabilityScore, confidence, level="INTERMEDIATE") => ({
  skillId,
  capabilityScore,
  level: capabilityScore == null ? "UNKNOWN" : level,
  confidence,
  confidenceBand: confidence < 0.45 ? "LOW" : confidence < 0.75 ? "MEDIUM" : "HIGH",
  conflictState:"NONE",
  evidenceCount:1,
  sourceFamilyCount:1,
  lastValidatedAt:null,
  estimatorVersion:"test"
});

test("manual self-report remains low-confidence evidence", () => {
  const evidence=[{
    id:"m1",skillId:"sql",sourceType:"MANUAL_SELF_REPORT",sourceGroupId:"manual:1",
    levelSignal:2,directness:1,quality:1,coverage:1,claim:"I know SQL",status:"ACCEPTED"
  }];
  assert.equal(effectiveWeight(evidence[0]),0.2);
  const estimated=estimateSkill("sql",evidence);
  assert.equal(estimated.capabilityScore,2);
  assert.equal(estimated.level,"INTERMEDIATE");
  assert.ok(estimated.confidence < 0.5);
});

test("assessment summary prevents double counting child questions from same assessment", () => {
  const evidence=[
    {
      id:"q1",skillId:"rest",sourceType:"ASSESSMENT_QUESTION",sourceGroupId:"assessment:1",
      levelSignal:0.8,directness:1,quality:1,coverage:1,claim:"weak question",status:"ACCEPTED"
    },
    {
      id:"sum1",skillId:"rest",sourceType:"ASSESSMENT_SUMMARY",sourceGroupId:"assessment:1",
      levelSignal:2.4,directness:1,quality:0.9,coverage:0.85,claim:"summary",status:"ACCEPTED"
    }
  ];
  const estimated=estimateSkill("rest",evidence);
  assert.equal(estimated.capabilityScore,2.4);
});

test("hysteresis prevents noisy one-step level promotion without direct validation", () => {
  const previous=state("docker",1.45,0.55,"BEGINNER");
  const evidence=[{
    id:"p1",skillId:"docker",sourceType:"PROJECT_DESCRIPTION",sourceGroupId:"project:1",
    levelSignal:1.55,directness:1,quality:0.75,coverage:0.6,claim:"used Docker",status:"ACCEPTED"
  }];
  const estimated=estimateSkill("docker",evidence,previous);
  assert.equal(estimated.capabilityScore,1.55);
  assert.equal(estimated.level,"BEGINNER");
});

test("conflicting strong independent evidence caps confidence and marks unresolved conflict", () => {
  const evidence=[
    {
      id:"a1",skillId:"auth",sourceType:"ASSESSMENT_SUMMARY",sourceGroupId:"assessment:1",
      levelSignal:3.1,directness:1,quality:1,coverage:0.8,claim:"strong validation",status:"ACCEPTED"
    },
    {
      id:"p1",skillId:"auth",sourceType:"PROJECT_ARTIFACT_VERIFIED",sourceGroupId:"project:1",
      levelSignal:1.0,directness:1,quality:1,coverage:0.8,claim:"weak artifact",status:"ACCEPTED"
    }
  ];
  const estimated=estimateSkill("auth",evidence);
  assert.equal(estimated.conflictState,"UNRESOLVED");
  assert.ok(estimated.confidence <= 0.65);
});

test("ANY_OF role group chooses the strongest evidenced alternative without penalizing every option", () => {
  const role={
    roleId:"role",roleName:"Frontend Engineer",roleVersionId:"rv1",version:1,
    groups:[
      {id:"g-lang",name:"Typed application language",type:"ANY_OF",groupImportance:1},
      {id:"g-framework",name:"Framework",type:"SINGLE",groupImportance:1}
    ],
    requirements:[
      {id:"r-js",groupId:"g-lang",skillId:"javascript",targetScore:2,importance:1,learningStage:1,isDefaultAlternative:true,rationale:""},
      {id:"r-ts",groupId:"g-lang",skillId:"typescript",targetScore:2,importance:1,learningStage:1,isDefaultAlternative:false,rationale:""},
      {id:"r-react",groupId:"g-framework",skillId:"react",targetScore:2,importance:1,learningStage:2,isDefaultAlternative:true,rationale:""}
    ],
    dependencies:[]
  };
  const analysis=analyzeRoleGaps({
    role,
    userSkills:[state("javascript",0.8,0.6,"BEGINNER"),state("typescript",1.9,0.8,"INTERMEDIATE"),state("react",1.5,0.7,"INTERMEDIATE")]
  });
  assert.equal(analysis.selectedAlternatives["g-lang"],"typescript");
  assert.equal(analysis.gaps.filter(gap=>gap.groupId==="g-lang").length,1);
  assert.equal(analysis.gaps.find(gap=>gap.groupId==="g-lang")?.skillId,"typescript");
});

test("low-confidence important role requirement recommends validation before learning", () => {
  const role={
    roleId:"role",roleName:"Backend Engineer",roleVersionId:"rv1",version:1,
    groups:[{id:"g",name:"Containers",type:"SINGLE",groupImportance:1}],
    requirements:[{id:"r",groupId:"g",skillId:"docker",targetScore:2,importance:1,learningStage:2,isDefaultAlternative:true,rationale:""}],
    dependencies:[]
  };
  const analysis=analyzeRoleGaps({role,userSkills:[state("docker",1.8,0.25,"INTERMEDIATE")]});
  assert.equal(analysis.gaps[0].recommendedAction,"VALIDATE_FIRST");
});

test("planner rejects impossible learning constraints", () => {
  assert.throws(
    () => generateInitialLearningPlan([],{
      hoursPerWeek:5,learningDays:[],preferredSessionMinutes:45,minSessionMinutes:20
    }),
    /NO_LEARNING_DAYS/
  );
  assert.throws(
    () => generateInitialLearningPlan([],{
      hoursPerWeek:0,learningDays:["Mon"],preferredSessionMinutes:45,minSessionMinutes:20
    }),
    /INVALID_WEEKLY_CAPACITY/
  );
});
