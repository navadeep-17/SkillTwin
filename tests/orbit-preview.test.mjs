import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("Orbit demo is clearly sample-only and cannot commit learner state", () => {
  const demo = read("app/orbit-lab/orbit-lab.tsx");
  assert.match(demo, /Concept prototype/);
  assert.match(demo, /Demo data only|sample data|sample correct answer/i);
  assert.match(demo, /No assessment, score or roadmap is saved/);
  assert.doesNotMatch(demo, /createClient|fetch\s*\(|supabase\.from\s*\(/);
});

test("Orbit beta requires authentication and reads canonical learner state", () => {
  const page = read("app/orbit-beta/page.tsx");
  const middleware = read("middleware.ts");
  assert.match(middleware, /"\/orbit-beta"/);
  assert.match(page, /supabase\.auth\.getUser\(\)/);
  assert.match(page, /redirect\("\/login/);
  assert.match(page, /\.eq\("user_id", auth\.user\.id\)/);
  for (const table of ["career_goals", "gap_snapshots", "user_skills", "skill_gap_results", "role_skill_requirements", "role_dependency_edges"]) {
    assert.ok(page.includes('"' + table + '"'), "Missing canonical source: " + table);
  }
  assert.doesNotMatch(page, /\.insert\s*\(|\.update\s*\(|\.delete\s*\(/);
});

test("Orbit beta never synthesizes a skill score or fake readiness trend", () => {
  const ui = read("app/orbit-beta/orbit-today-live.tsx");
  assert.match(ui, /Read-only design preview/);
  assert.match(ui, /capability\.toFixed/);
  assert.match(ui, /confidence\*100/);
  assert.match(ui, /role="progressbar"/);
  assert.doesNotMatch(ui, /Math\.random|setInterval|fakeHistory|sampleReadiness|\.insert\s*\(/);
});

test("Orbit UI has keyboard graph controls and reduced-motion styling", () => {
  const ui = read("app/orbit-beta/orbit-today-live.tsx");
  const css = read("app/orbit-beta/orbit-beta.css");
  const labCss = read("app/orbit-lab/orbit-lab.css");
  assert.match(ui, /aria-label/);
  assert.match(ui, /onKeyDown/);
  assert.match(ui, /aria-pressed/);
  assert.match(ui, /orbit-live-node-list/);
  assert.match(css, /orbit-live-node-list/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(labCss, /prefers-reduced-motion/);
});



test("Orbit onboarding is authenticated and preserves the working product workflow", () => {
  const page = read("app/orbit-onboarding/page.tsx");
  const middleware = read("middleware.ts");
  const css = read("app/orbit-onboarding/orbit-onboarding.css");
  assert.ok(middleware.includes('"/orbit-onboarding"'));
  assert.ok(page.includes("supabase.auth.getUser()"));
  assert.ok(page.includes('redirect("/login'));
  assert.ok(page.includes("<OnboardingFlow initialRoleVersionId={initialRoleVersionId}"));
  assert.ok(page.includes("Saving or analyzing here updates your actual signed-in profile"));
  assert.ok(css.includes("SkillTwin setup progress"));
  assert.ok(css.includes("prefers-reduced-motion"));
  assert.ok(!page.includes(".insert(") && !page.includes(".update(") && !page.includes(".delete("));
});

test("Orbit readiness snapshot belongs to the selected goal and role", () => {
  const page = read("app/orbit-beta/page.tsx");
  assert.ok(page.includes('.eq("goal_id", goal.id)'));
  assert.ok(page.includes('.eq("role_version_id", goal.role_version_id)'));
});


test("Orbit Today retrieves an actionable task from the current active plan", () => {
  const page = read("app/orbit-beta/page.tsx");
  const ui = read("app/orbit-beta/orbit-today-live.tsx");
  assert.ok(page.includes('from("learning_plans")'));
  assert.ok(page.includes('from("learning_tasks")'));
  assert.ok(page.includes('.eq("goal_id", goal.id)'));
  assert.ok(page.includes('.eq("status", "ACTIVE")'));
  assert.ok(page.includes('"IN_PROGRESS", "PLANNED"'));
  assert.ok(ui.includes("model.nextTask.title"));
  assert.ok(ui.includes('href="/roadmap"'));
  assert.ok(!ui.includes('fetch("/api/tasks/'));
});
