import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(relative) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

function exists(relative) {
  return fs.existsSync(path.join(root, relative));
}

const requiredFiles = [
  "app/api/health/route.ts",
  "app/api/readiness/route.ts",
  "app/api/demo/reset/route.ts",
  "app/api/profile/documents/route.ts",
  "app/api/gaps/route.ts",
  "app/api/plans/generate/route.ts",
  "app/api/assessments/route.ts",
  "app/api/roadmap/diffs/[id]/apply/route.ts",
  "app/api/roadmap/diffs/[id]/undo/route.ts",
  "app/api/chat/route.ts",
  "app/api/chat/actions/[id]/confirm/route.ts",
  "app/api/agent-events/route.ts",
  "app/overview/page.tsx",
  "app/skills/page.tsx",
  "app/roadmap/page.tsx",
  "app/roadmap/task/[id]/page.tsx",
  "app/practice/page.tsx",
  "app/projects/page.tsx",
  "app/progress/page.tsx",
  "components/skills/skill-graph.tsx",
  "components/shell/global-assistant-dock.tsx",
  "components/realtime/product-sync.tsx",
  "scripts/release-smoke.mjs",
  "scripts/database-security-qa.mjs"
];

for (const file of requiredFiles) {
  assert(exists(file), "missing required product contract file: " + file);
}

const migrations = fs.readdirSync(path.join(root, "supabase/migrations"))
  .filter(name => /^\d{4}_.+\.sql$/.test(name))
  .sort();

assert(migrations.length >= 23, "expected at least 23 versioned migrations");
for (let index = 0; index < 23; index += 1) {
  const prefix = String(index + 1).padStart(4, "0") + "_";
  assert(migrations.some(name => name.startsWith(prefix)), "missing migration " + prefix);
}

const replannerDomain = read("lib/domain/replanner.ts");
for (const operation of [
  "ADD_TASK",
  "MOVE_TASK",
  "REMOVE_TASK",
  "CHANGE_DIFFICULTY",
  "CHANGE_DURATION",
  "CHANGE_RESOURCE"
]) {
  assert(replannerDomain.includes(operation), "replanner domain missing operation " + operation);
}

const replannerService = read("lib/services/replanner/adaptive-replanner-service.ts");
for (const trigger of [
  "ASSESSMENT_COMPLETED",
  "PROJECT_EVIDENCE_COMMITTED",
  "TASK_BEHAVIOR_SIGNAL",
  "CONSTRAINT_CHANGED"
]) {
  assert(replannerService.includes(trigger), "adaptive replanner missing live trigger " + trigger);
}
for (const operation of [
  "ADD_TASK",
  "MOVE_TASK",
  "REMOVE_TASK",
  "CHANGE_DIFFICULTY",
  "CHANGE_DURATION",
  "CHANGE_RESOURCE"
]) {
  assert(replannerService.includes(operation), "adaptive replanner apply path missing " + operation);
}

const assessmentService = read("lib/services/assessment/assessment-service.ts");
for (const questionType of ["MCQ", "SHORT_TEXT", "SCENARIO"]) {
  assert(assessmentService.includes(questionType), "assessment service missing " + questionType);
}
assert(assessmentService.includes("considerAssessment"), "assessment completion does not invoke adaptive replanning");

const skillGraph = read("components/skills/skill-graph.tsx");
assert(skillGraph.includes("ReactFlow"), "Skill Graph is not backed by React Flow");

const realtime = read("components/realtime/product-sync.tsx");
assert(realtime.includes("postgres_changes"), "realtime product synchronization is not subscribed to postgres_changes");

const globalDock = read("components/shell/global-assistant-dock.tsx");
assert(globalDock.includes("JourneyChat"), "global Ask SkillTwin drawer is missing Journey Chat");
assert(globalDock.includes("agent-events"), "global Agent Activity drawer is not connected to AgentEvents");

const upload = read("app/api/profile/documents/route.ts");
assert(upload.includes("MAX_BYTES"), "resume upload has no explicit file-size boundary");
assert(upload.includes("application/pdf"), "resume upload has no PDF MIME check");
assert(upload.includes("%PDF-"), "resume upload has no PDF signature check");

const evidenceEngine = read("lib/domain/evidence-engine.ts");
assert(evidenceEngine.includes("lockSkillSnapshots"), "Evidence Engine is missing transactional row locking");
assert(evidenceEngine.includes("idempotencyKey"), "Evidence Engine is missing idempotency");

const roleGenerator = read("app/api/roles/generate/route.ts");
assert(roleGenerator.includes("assertAcyclic"), "custom role generation is missing DAG validation");
assert(roleGenerator.includes("canonical"), "custom role generation is not constrained to canonical skills");

const releaseSmoke = read("scripts/release-smoke.mjs");
for (const marker of [
  "PUBLIC_SMOKE=PASS",
  "AUTH_SMOKE=PASS",
  "CAUSAL_E2E=PASS",
  "RELEASE_SMOKE=PASS"
]) {
  assert(releaseSmoke.includes(marker), "release smoke is missing marker " + marker);
}

console.log("SPEC_CONTRACT_QA=PASS");
console.log("MIGRATIONS=" + migrations.length);
console.log("REQUIRED_PRODUCT_FILES=" + requiredFiles.length);
console.log("REPLANNER_OPERATIONS=6");
console.log("ASSESSMENT_TYPES=3");
