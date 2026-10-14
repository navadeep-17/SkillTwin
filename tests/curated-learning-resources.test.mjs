import assert from "node:assert/strict";
import test from "node:test";
import {
  CURATED_LEARNING_RESOURCES,
  recommendCuratedResources
} from "../lib/domain/curated-learning-resources.ts";

const recommendation = (skillSlug, taskType, difficulty = "BASIC", durationMinutes = 45) =>
  recommendCuratedResources({skillSlug, taskType, difficulty, durationMinutes});

test("every curated link is distinct, HTTPS and belongs to a checked provider", () => {
  assert.equal(CURATED_LEARNING_RESOURCES.length >= 15, true);
  assert.equal(new Set(CURATED_LEARNING_RESOURCES.map(r => r.id)).size, CURATED_LEARNING_RESOURCES.length);
  assert.equal(new Set(CURATED_LEARNING_RESOURCES.map(r => r.url + "::" + r.skillSlug)).size, CURATED_LEARNING_RESOURCES.length);
  for (const r of CURATED_LEARNING_RESOURCES) {
    assert.equal(new URL(r.url).protocol, "https:");
    assert.ok(r.quality >= 0 && r.quality <= 1);
    assert.ok(r.levels.length && r.modes.length);
  }
});

test("recommendations match exact skill, task type and proficiency, not unrelated words", () => {
  const sqlPractice = recommendation("sql","PRACTICE","BASIC",30);
  assert.equal(sqlPractice[0]?.id, "sqlbolt-select");
  assert.ok(sqlPractice.filter(r=>r.format!=="VIDEO").every(r => r.url.startsWith("https://sqlbolt.com/")));
  assert.ok(sqlPractice.some(r => r.format==="VIDEO"));

  const joins = recommendation("sql","PRACTICE","STANDARD",30);
  assert.equal(joins[0]?.id,"sqlbolt-joins");

  const sqlLearn = recommendation("sql","LEARN","BASIC",45);
  assert.equal(sqlLearn[0]?.id,"sql-postgres");

  assert.deepEqual(recommendation("nosuchskill","LEARN"),[]);
  assert.deepEqual(recommendation("sql;DROP TABLE learning_resources;","LEARN"),[]);
  assert.deepEqual(recommendation("sql","VALIDATE"),[]);
  assert.deepEqual(recommendation("sql","PRACTICE","ADVANCED"),[]);
});

test("resources use planned study time but do not assert full course length", () => {
  const picks = recommendation("docker","BUILD","STANDARD",30);
  assert.equal(picks[0]?.id,"docker-workshop");
  assert.ok(picks[0]?.suggested_minutes <= 30);
  assert.ok(picks[0]?.reason.includes("standard"));
  assert.ok(picks.every(r => r.suggested_minutes > 0));
});

test("results are deterministic and have bounded choices and useful provenance", () => {
  const first = recommendation("http","LEARN","BASIC",30);
  assert.ok(first.length > 0 && first.length <= 2);
  assert.deepEqual(first,recommendation("http","LEARN","BASIC",30));
  assert.ok(first.every(r => r.provider && r.title && r.reason));
});

test("roadmap API and UI display only supplemental, non-evidence links", async () => {
  const fs = await import("node:fs");
  const api = fs.readFileSync(new URL("../app/api/roadmap/route.ts",import.meta.url),"utf8");
  const ui = fs.readFileSync(new URL("../components/roadmap/roadmap-view.tsx",import.meta.url),"utf8");
  assert.match(api,/recommendCuratedResources/);
  assert.match(api,/skillSlug:/);
  assert.match(ui,/recommended_resources/);
  assert.match(ui,/Opening a resource doesn't mark this task complete/);
  assert.match(ui,/noopener noreferrer/);
});
