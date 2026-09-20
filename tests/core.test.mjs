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


import { SUPPORTED_PLAN_OPERATIONS, validatePlanOperations } from "../dist/lib/domain/replanner.js";

test("replanner exposes the complete patch vocabulary", () => {
  assert.deepEqual(
    [...SUPPORTED_PLAN_OPERATIONS].sort(),
    ["ADD_TASK","MOVE_TASK","REMOVE_TASK","CHANGE_DIFFICULTY","CHANGE_DURATION","CHANGE_RESOURCE"].sort()
  );
});

test("replanner rejects unsafe duration and resource patches", () => {
  assert.throws(() => validatePlanOperations([{
    type: "CHANGE_DURATION",
    taskId: "task-1",
    fromMinutes: 30,
    toMinutes: 0,
    reason: "invalid"
  }]));
  assert.throws(() => validatePlanOperations([{
    type: "CHANGE_RESOURCE",
    taskId: "task-1",
    fromResourceId: null,
    toResourceId: "",
    reason: "invalid"
  }]));
});


import { evaluateConstructedWithFallback } from "../dist/lib/domain/constructed-assessment.js";

test("constructed assessment falls back safely when AI fails", async () => {
  const result = await evaluateConstructedWithFallback(
    { expectedKeywords:["idempotency","retry"], conceptId:"http-idempotency" },
    "I would use idempotency so a retry is safe.",
    async () => { throw new Error("provider down"); }
  );
  assert.equal(result.score, 1);
  assert.equal(result.errorTag, null);
  assert.ok(result.evaluatorConfidence > 0);
});

test("constructed assessment ignores invalid AI scores", async () => {
  const result = await evaluateConstructedWithFallback(
    { expectedKeywords:["transaction","rollback"], conceptId:"db-atomicity" },
    "Use a transaction.",
    async () => ({
      score: 4,
      evaluatorConfidence: 1,
      feedback: "invalid",
      errorTag: null
    })
  );
  assert.equal(result.score, 0.5);
  assert.equal(result.errorTag, "db-atomicity");
});


import { adaptiveAssessmentState, selectAdaptiveCandidate } from "../dist/lib/domain/adaptive-assessment.js";

test("adaptive assessment prioritizes uncovered concepts", () => {
  const blueprint = {
    conceptTargets: [
      { conceptId:"headers", minObservations:1 },
      { conceptId:"idempotency", minObservations:1 }
    ],
    difficultyMin:1,
    difficultyMax:4,
    startDifficulty:2,
    minItems:2,
    maxItems:4,
    targetCoverage:1,
    stopConfidence:0.8
  };
  const attempts = [{
    bankQuestionId:"q1",
    conceptId:"headers",
    difficulty:2,
    score:1,
    type:"MCQ",
    evaluatorConfidence:1
  }];
  const next = selectAdaptiveCandidate(blueprint, attempts, [
    { id:"q2",conceptId:"headers",difficulty:3,type:"MCQ" },
    { id:"q3",conceptId:"idempotency",difficulty:3,type:"SHORT_TEXT" }
  ]);
  assert.equal(next?.id,"q3");
});

test("adaptive assessment changes difficulty from performance and obeys max stop", () => {
  const blueprint = {
    conceptTargets:[{ conceptId:"rest",minObservations:1 }],
    difficultyMin:1,
    difficultyMax:4,
    startDifficulty:2,
    minItems:2,
    maxItems:3,
    targetCoverage:1,
    stopConfidence:0.99
  };
  const one = adaptiveAssessmentState(blueprint,[{
    bankQuestionId:"q1",conceptId:"rest",difficulty:2,score:1,type:"MCQ",evaluatorConfidence:1
  }]);
  assert.equal(one.nextDifficulty,3);
  assert.equal(one.shouldStop,false);

  const full = adaptiveAssessmentState(blueprint,[
    { bankQuestionId:"q1",conceptId:"rest",difficulty:2,score:1,type:"MCQ",evaluatorConfidence:1 },
    { bankQuestionId:"q2",conceptId:"rest",difficulty:3,score:0,type:"MCQ",evaluatorConfidence:1 },
    { bankQuestionId:"q3",conceptId:"rest",difficulty:2,score:1,type:"SCENARIO",evaluatorConfidence:0.9 }
  ]);
  assert.equal(full.shouldStop,true);
});


test("adaptive assessment starts near calibrated difficulty", () => {
  const blueprint = {
    conceptTargets:[
      { conceptId:"advanced-concept",minObservations:1 },
      { conceptId:"basic-concept",minObservations:1 }
    ],
    difficultyMin:1,
    difficultyMax:4,
    startDifficulty:1,
    minItems:2,
    maxItems:4,
    targetCoverage:1,
    stopConfidence:0.8
  };
  const first = selectAdaptiveCandidate(blueprint, [], [
    { id:"advanced",conceptId:"advanced-concept",difficulty:4,type:"MCQ" },
    { id:"basic",conceptId:"basic-concept",difficulty:1,type:"MCQ" }
  ]);
  assert.equal(first?.id,"basic");
});


import { selectEvidencePlanOperation } from "../dist/lib/domain/replan-policy.js";

test("evidence replanner removes a redundant flexible future task once target is met", () => {
  const operation = selectEvidencePlanOperation([{
    taskId: "task-1",
    logicalTaskId: "logical-1",
    taskType: "LEARN",
    difficulty: "BASIC",
    flexible: true,
    durationMinutes: 45,
    weekIndex: 2,
    weekPlannedMinutes: 240,
    gapStatus: "STRONG",
    capabilityScore: 2.2,
    targetScore: 2
  }]);
  assert.equal(operation?.type, "REMOVE_TASK");
  assert.equal(operation?.logicalTaskId, "logical-1");
});

test("evidence replanner can raise future practice difficulty without changing workload", () => {
  const operation = selectEvidencePlanOperation([{
    taskId: "task-2",
    logicalTaskId: "logical-2",
    taskType: "PRACTICE",
    difficulty: "BASIC",
    flexible: false,
    durationMinutes: 30,
    weekIndex: 1,
    weekPlannedMinutes: 180,
    gapStatus: "DEVELOPING",
    capabilityScore: 1.8,
    targetScore: 2.5
  }]);
  assert.equal(operation?.type, "CHANGE_DIFFICULTY");
  assert.equal(operation?.from, "BASIC");
  assert.equal(operation?.to, "STANDARD");
});

test("evidence replanner is conservative when evidence does not justify a future patch", () => {
  const operation = selectEvidencePlanOperation([{
    taskId: "task-3",
    logicalTaskId: "logical-3",
    taskType: "LEARN",
    difficulty: "BASIC",
    flexible: false,
    durationMinutes: 30,
    weekIndex: 1,
    weekPlannedMinutes: 180,
    gapStatus: "GAP",
    capabilityScore: 0.8,
    targetScore: 2
  }]);
  assert.equal(operation, null);
});
