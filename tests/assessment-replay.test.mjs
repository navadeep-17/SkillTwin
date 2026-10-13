import test from "node:test";
import assert from "node:assert/strict";
import { assessmentAnswerReplay } from "../dist/lib/domain/assessment-replay.js";

test("first answer is treated as a new submission", () => {
  assert.equal(assessmentAnswerReplay(null, "assessment-a", "question-1"), "NEW");
});
test("network retry of same committed answer is safe to replay", () => {
  assert.equal(assessmentAnswerReplay({
    assessment_id:"assessment-a",question_id:"question-1"
  },"assessment-a","question-1"),"REPLAY");
});
test("reusing an answer key for another question or assessment fails closed", () => {
  const prior={assessment_id:"assessment-a",question_id:"question-1"};
  assert.equal(assessmentAnswerReplay(prior,"assessment-a","question-2"),"CONFLICT");
  assert.equal(assessmentAnswerReplay(prior,"assessment-b","question-1"),"CONFLICT");
});
