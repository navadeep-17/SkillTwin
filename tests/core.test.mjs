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
