import test from "node:test";
import assert from "node:assert/strict";
import { classifyJourneyIntent, findMentionedSkill } from "../dist/lib/domain/journey-intent.js";
import { buildTwinProofTrail } from "../dist/lib/domain/twin-challenge.js";

test("agent recognizes a real assessment correction and assessment-linked NO_OP", () => {
  assert.equal(classifyJourneyIntent("Why did my JavaScript skill level drop?"), "EXPLAIN_ASSESSMENT");
  assert.equal(classifyJourneyIntent("Why didn't my roadmap change after my assessment?"), "EXPLAIN_ASSESSMENT");
  assert.equal(classifyJourneyIntent("Explain my last challenge result"), "EXPLAIN_ASSESSMENT");
  assert.equal(classifyJourneyIntent("What changed after my quiz?"), "EXPLAIN_ASSESSMENT");
  assert.equal(classifyJourneyIntent("Why is my confidence lower?"), "EXPLAIN_ASSESSMENT");
});

test("agent does not mistake a general question or confirmation-gated action for proof explanation", () => {
  assert.equal(classifyJourneyIntent("Why did my roadmap change?"), "WHY_ROADMAP_CHANGED");
  assert.equal(classifyJourneyIntent("What is my confidence?"), "SKILL_STATUS");
  assert.equal(classifyJourneyIntent("Explain my biggest skill gap"), "SKILL_STATUS");
  assert.equal(classifyJourneyIntent("How ready am I for a role?"), "READINESS");
  assert.equal(classifyJourneyIntent("Challenge me"), "START_ASSESSMENT");
  assert.equal(classifyJourneyIntent("Undo the roadmap change"), "UNDO_ROADMAP_CHANGE");
  assert.equal(classifyJourneyIntent("Generate my roadmap"), "GENERATE_PLAN");
});

test("agent matches precise skill names rather than substring aliases", () => {
  const skills = [
    { skill_id:"one", canonical_name:"Java", slug:"java" },
    { skill_id:"two", canonical_name:"JavaScript", slug:"javascript" },
    { skill_id:"three", canonical_name:"React", slug:"react" },
    { skill_id:"four", canonical_name:"React Native", slug:"react-native" }
  ];
  assert.equal(findMentionedSkill("Why did my JavaScript level drop?", skills)?.skill_id, "two");
  assert.equal(findMentionedSkill("What is my Java skill score?", skills)?.skill_id, "one");
  assert.equal(findMentionedSkill("Explain React Native confidence", skills)?.skill_id, "four");
  assert.equal(findMentionedSkill("I studied javascript", skills)?.skill_id, "two");
  assert.equal(findMentionedSkill("Did my TypeScript ability change?", skills), null);
});

test("agent proof remains assessment-ID-linked and never credits an unrelated plan change", () => {
  const outcome = {assessment_id:"a-1",skill_id:"js",normalized_score:0.2368,coverage:1,created_at:"2026-10-13T13:47:29Z"};
  const proof = buildTwinProofTrail(outcome,[{
    skill_id:"js",trigger_ref:"a-1",
    before_state:JSON.stringify({level:"INTERMEDIATE",capabilityScore:1.55,confidence:0.49}),
    after_state:JSON.stringify({level:"BEGINNER",capabilityScore:1.189,confidence:0.809}),
    explanation:"The estimate was recalibrated."
  }],[{trigger_ref:"a-1",decision:"NO_OP",reason_code:"SKILL_OUTSIDE_ACTIVE_HORIZON",reason:"No mutable future objective."}],[
    {id:"unrelated",trigger_refs:["a-2"],status:"APPLIED",summary:"Moved task"}
  ]);
  assert.equal(proof?.planStatus,"UNCHANGED");
  assert.equal(proof?.before?.level,"INTERMEDIATE");
  assert.equal(proof?.after?.level,"BEGINNER");
  assert.equal(proof?.after?.confidencePercent,81);
  assert.equal(proof?.planDiffId,null);
});
