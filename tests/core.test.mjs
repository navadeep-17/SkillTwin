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
