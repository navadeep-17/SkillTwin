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


test("Orbit My Twin is authenticated, reads user-scoped evidence and never mutates learner state", () => {
  const page = read("app/orbit-skills/page.tsx");
  const middleware = read("middleware.ts");
  const view = read("app/orbit-skills/orbit-skill-experience.tsx");
  const css = read("app/orbit-skills/orbit-skills.css");
  assert.ok(middleware.includes('"/orbit-skills"'));
  assert.ok(page.includes("supabase.auth.getUser()"));
  assert.ok(page.includes('redirect("/login'));
  for (const table of ["career_goals", "user_skills", "role_skill_requirements", "role_dependency_edges", "gap_snapshots", "skill_gap_results", "skill_evidence"]) {
    assert.ok(page.includes('"' + table + '"'), "Missing canonical source "+table);
  }
  assert.ok(page.includes('.eq("goal_id", goal!.id)'));
  assert.ok(page.includes('.eq("role_version_id", roleVersionId)'));
  assert.ok(page.includes('.eq("user_id", auth.user.id)'));
  assert.ok(page.includes('"NON_AGGREGATING"'));
  assert.ok(view.includes('ReactFlow'));
  assert.ok(view.includes("formatScore(selected.capability)"));
  assert.ok(view.includes("formatPercent(selected.confidence)"));
  assert.ok(view.includes("aria-pressed"));
  assert.ok(view.includes('href="/challenge-my-twin"'));
  assert.ok(css.includes("prefers-reduced-motion"));
  assert.ok(!page.includes(".insert(") && !page.includes(".update(") && !page.includes(".delete("));
  assert.ok(!view.includes('fetch("/api/tasks/'));
});

test("Orbit My Twin navigation and anonymous access are explicit", () => {
  const nav = read("components/orbit/orbit-preview-nav.tsx");
  const visual = read("scripts/orbit-visual-qa.mjs");
  assert.ok(nav.includes('href: "/orbit-skills"'));
  assert.ok(visual.includes('"/orbit-skills"'));
});


test("Sample constellation is explicitly fictional and never imports private learner data", () => {
  const page = read("app/orbit-lab/skill-demo/page.tsx");
  assert.ok(page.includes("Sample concept"));
  assert.ok(page.includes("no real learner records"));
  assert.ok(page.includes("type OrbitSkill"));
  assert.ok(page.includes("OrbitSkillExperience"));
  assert.ok(!page.includes("createClient"));
  assert.ok(!page.includes("supabase"));
});


test("Orbit Journey is user-scoped read-only and uses persisted PlanDiff/NO_OP", () => {
  const page=read("app/orbit-journey/page.tsx");
  const ui=read("app/orbit-journey/orbit-journey.tsx");
  const middleware=read("middleware.ts");
  const css=read("app/orbit-journey/orbit-journey.css");
  assert.ok(middleware.includes('"/orbit-journey"'));
  assert.ok(page.includes("supabase.auth.getUser()"));
  assert.ok(page.includes('.eq("user_id",auth.user.id)'));
  assert.ok(page.includes('.eq("goal_id",goal.id)'));
  for (const name of ["learning_plans","plan_weeks","learning_objectives","learning_tasks","plan_diffs","replan_decisions"]) assert.ok(page.includes('"' + name + '"'), "missing "+name);
  assert.ok(ui.includes('decision==="NO_OP"'));
  assert.ok(ui.includes('href={"/roadmap/task/"+encodeURIComponent(task.id)}'));
  assert.ok(ui.includes('href={"/roadmap/changes/"+encodeURIComponent(diff.id)}'));
  assert.ok(ui.includes('aria-valuenow={completion(currentWeek)}'));
  assert.ok(css.includes("prefers-reduced-motion"));
  assert.ok(!page.includes(".insert(") && !page.includes(".update(") && !page.includes(".delete("));
});

test("Public Journey demo is fictional and tested for PlanDiff and NO_OP", () => {
  const demo=read("app/orbit-lab/journey-demo/page.tsx");
  const testScript=read("scripts/orbit-visual-qa.mjs");
  assert.ok(demo.includes("Sample concept"));
  assert.ok(demo.includes("no learner records or changes"));
  assert.ok(!demo.includes("createClient"));
  assert.ok(testScript.includes("/orbit-lab/journey-demo"));
  assert.ok(testScript.includes("Plan preserved intentionally"));
});


test("Orbit Prove uses the existing authenticated assessment and evidence services", () => {
  const page=read("app/orbit-prove/page.tsx");
  const ui=read("app/orbit-prove/orbit-proof.tsx");
  const middleware=read("middleware.ts");
  const nav=read("components/orbit/orbit-preview-nav.tsx");
  const css=read("app/orbit-prove/orbit-prove.css");
  assert.ok(middleware.includes('"/orbit-prove"'), "Prove must be auth-protected");
  assert.ok(nav.includes('href: "/orbit-prove"'));
  assert.ok(page.includes("supabase.auth.getUser()"));
  assert.ok(page.includes('.eq("user_id",userId)'));
  for(const table of ["skills","user_skills","skill_evidence","skill_history","skill_assessment_outcomes","replan_decisions","plan_diffs","skill_assessments"]) {
    assert.ok(page.includes('"' + table + '"'), "Missing canonical source "+table);
  }
  assert.ok(page.includes("buildTwinProofTrail"));
  assert.ok(page.includes("challengeAvailability"));
  assert.ok(!page.includes("correct_answer") && !page.includes("answer_key"), "No answer-key fields on the Prove route");
  assert.ok(!page.includes(".insert(") && !page.includes(".update(") && !page.includes(".delete("));
  assert.ok(ui.includes('fetch("/api/assessments"'));
  assert.ok(ui.includes('mode:"CHALLENGE_ME"'));
  assert.ok(ui.includes("if(pending||demoOnly)return;"));
  assert.ok(ui.includes("pending||demoOnly"));
  assert.ok(ui.includes("trail.planStatus"));
  assert.ok(css.includes("prefers-reduced-motion"));
});

test("Orbit proof sessions reuse ChallengeSession rather than implementing a second grader", () => {
  const page=read("app/orbit-prove/session/[id]/page.tsx");
  assert.ok(page.includes("supabase.auth.getUser()"));
  assert.ok(page.includes('<ChallengeSession assessmentId={id} proofReturnBase="/orbit-prove"/>'));
  const session=read("components/practice/challenge-session.tsx");
  assert.ok(session.includes('proofReturnBase="/challenge-my-twin"'));
  assert.ok(session.includes('href={proofReturnBase+"?skillId="+encodeURIComponent(assessment.skill.id)}'));
  assert.ok(!page.includes("getAssessmentService") && !page.includes("grade("));
});

test("Public Proof demo uses fictional data and cannot write assessments", () => {
  const page=read("app/orbit-lab/proof-demo/page.tsx");
  const qa=read("scripts/orbit-visual-qa.mjs");
  assert.ok(page.includes("Fictional demo"));
  assert.ok(page.includes("<OrbitProof skills={demoSkills} initialSkillId="));
  assert.ok(page.includes("demoOnly/>"));
  assert.ok(!page.includes("createClient") && !page.includes("supabase"));
  assert.ok(qa.includes('"/orbit-lab/proof-demo"'));
  assert.ok(qa.includes("proofCalls"));
  assert.ok(qa.includes('"/orbit-prove"'));
});


test("Orbit Explore preserves existing role-model semantics and is auth protected", () => {
  const page=read("app/orbit-explore/page.tsx");
  const client=read("app/orbit-explore/orbit-explore.tsx");
  const middleware=read("middleware.ts");
  const nav=read("components/orbit/orbit-preview-nav.tsx");
  assert.ok(middleware.includes('"/orbit-explore"'));
  assert.ok(nav.includes('href: "/orbit-explore"'));
  assert.ok(page.includes("supabase.auth.getUser()"));
  assert.ok(page.includes('from("role_versions")'));
  assert.ok(page.includes('from("role_skill_requirements")'));
  assert.ok(page.includes('from("user_skills")'));
  assert.ok(page.includes('.eq("user_id",auth.user.id)'));
  assert.ok(page.includes("role_versions") && page.includes("requirement_groups"));
  assert.ok(!page.includes(".insert(") && !page.includes(".update(") && !page.includes(".delete("));
  assert.ok(client.includes("compareCareerRequirements"));
  assert.ok(client.includes('groupType==="ANY_OF"'));
  assert.ok(client.includes('sampleOnly'));
  assert.ok(client.includes("not a career-fit or readiness percentage"));
  assert.ok(!client.includes('fetch("/api/'));
});

test("Explore fixture never touches live profile and browser QA covers comparison", () => {
  const demo=read("app/orbit-lab/explore-demo/page.tsx");
  const qa=read("scripts/orbit-visual-qa.mjs");
  assert.ok(demo.includes("Fictional careers"));
  assert.ok(demo.includes("sampleOnly"));
  assert.ok(!demo.includes("createClient") && !demo.includes("supabase"));
  assert.ok(qa.includes("/orbit-lab/explore-demo"));
  assert.ok(qa.includes("Shared skill comparison must use canonical IDs"));
  assert.ok(qa.includes('"/orbit-explore"'));
});


test("Orbit authenticated routes use real indeterminate loading states", () => {
  const loader=read("components/orbit/orbit-loading.tsx");
  const css=read("components/orbit/orbit-loading.css");
  assert.ok(loader.includes('role="status"')&&loader.includes('aria-busy="true"'));
  assert.ok(loader.includes("no simulated percentages"));
  assert.ok(css.includes("prefers-reduced-motion"));
  for(const route of ["orbit-beta","orbit-skills","orbit-journey","orbit-prove","orbit-explore","orbit-onboarding"]) {
    const file=read("app/"+route+"/loading.tsx");
    assert.ok(file.includes("OrbitLoading"),route+" lacks branded loader");
    assert.ok(!file.includes("setInterval"),route+" must not fake progress");
  }
});

test("Writing E2E assessment test is gated to an isolated non-production database", () => {
  const script=read("scripts/orbit-e2e-isolated.mjs");
  assert.ok(script.includes("ORBIT_E2E_ALLOW_WRITES"));
  assert.ok(script.includes("ORBIT_E2E_ISOLATED_PREVIEW"));
  assert.ok(script.includes("ORBIT_E2E_TEST_DB_REF"));
  assert.ok(script.includes('branchRef==="eozvilqmrhtujqtdmrri"'));
  assert.ok(script.includes('"skilltwin-production.up.railway.app"'));
  assert.ok(script.includes("ORBIT_E2E_BLOCKED"));
  assert.ok(script.includes("Recorded completed challenge"));
  assert.ok(!read(".github/workflows/ci.yml").includes("orbit-e2e-isolated"),"CI must never execute writing E2E automatically");
});


test("Orbit integration preserves newer main certifications and deployment setup", () => {
  const mainCI = read(".github/workflows/ci.yml");
  const middleware = read("middleware.ts");
  const nav = read("components/orbit/orbit-preview-nav.tsx");
  const chrome = read("components/shell/orbit-aware-chrome.tsx");
  const layout = read("app/layout.tsx");
  const orbitCSS = read("components/orbit/orbit-preview-nav-extra.css");
  assert.ok(mainCI.includes("tests/certification-journey.test.mjs"));
  assert.ok(mainCI.includes("tests/certification-preparation.test.mjs"));
  assert.ok(mainCI.includes("tests/orbit-preview.test.mjs"));
  assert.ok(mainCI.includes("docker build --progress plain"));
  assert.ok(read("next.config.ts").includes('output: "standalone"'));
  assert.ok(read("supabase/migrations/0026_user_certification_journey.sql").includes("user_certification_goals"));
  assert.ok(middleware.includes('"/certifications"') && middleware.includes('"/orbit-skills"'));
  assert.ok(nav.includes('href="/certifications"') && nav.includes('href="/certifications/journey"'));
  assert.ok(nav.includes('href="/journey"') && nav.includes("<LogoutButton"));
  assert.ok(orbitCSS.includes(".orbit-preview-menu"));
  assert.ok(chrome.includes('pathname.startsWith("/orbit-")'));
  assert.ok(chrome.includes("signedIn && !orbit"));
  assert.ok(layout.includes("OrbitAwareChrome"));
});


test("Orbit default activation is opt-in, reversible and preserves classic sign-in routes", () => {
  const links = read("components/shell/app-nav-links.tsx");
  const login = read("app/login/page.tsx");
  const form = read("components/auth/auth-form.tsx");
  const callback = read("app/auth/callback/route.ts");
  const flag = "NEXT_PUBLIC_SKILLTWIN_ORBIT_DEFAULT";
  for (const [name,source] of [["links",links],["login",login],["signup",form],["callback",callback]]) {
    assert.ok(source.includes(flag), name + " should respect the single rollout flag");
  }
  assert.ok(links.includes('href: "/orbit-beta"') && links.includes('href: "/overview"'));
  assert.ok(links.includes('label: "Try SkillTwin Orbit"'), "Classic product must offer explicit opt-in before the default switch is enabled");
  assert.ok(links.includes('href: "/orbit-prove"') && links.includes('href: "/practice"'));
  assert.ok(login.includes('orbitDefault ? "/orbit-beta" : "/onboarding"'));
  assert.ok(form.includes('"/orbit-onboarding" : "/onboarding"'));
  assert.ok(callback.includes('"/orbit-onboarding" : "/onboarding"'));
});
