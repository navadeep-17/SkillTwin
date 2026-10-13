import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("judge demo links replanning to its own completed assessment",()=>{
  const page=readFileSync(new URL("../app/demo/page.tsx",import.meta.url),"utf8");
  assert.match(page,/buildTwinProofTrail\(/);
  assert.match(page,/\.from\("skill_history"\)/);
  assert.match(page,/skillHistory\.data \?\? \[\]/);
  assert.match(page,/proof\.before && proof\.after/);
  assert.match(page,/proof\.planReason/);
  assert.match(page,/String\(latestAssessment\.assessment_id\)/);
  assert.match(page,/assessmentReplanned/);
  assert.match(page,/\.planStatus === "CHANGED"/);
  assert.match(page,/\.planStatus === "UNCHANGED"/);
  assert.doesNotMatch(page,/Boolean\(latestDiff \|\| latestDecision\)/);
  assert.match(page,/href: "\/challenge-my-twin"/);
});
