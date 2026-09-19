import type { SkillEvidence, UserSkillState } from "./skills.js";
import { estimateSkill } from "./skills.js";
import { BACKEND_ENGINEER_V1, analyzeGaps, readiness } from "./role-gap.js";
import { createWeekOnePlan } from "./planner.js";
import { outcomeToEvidence, REST_DEMO_OUTCOME } from "./assessment.js";
import { replanForRestWeakness } from "./replanner.js";

const initialEvidence: SkillEvidence[] = [
  { id: "ev-http-1", skillId: "http", sourceType: "RESUME_PROJECT_DETAIL", sourceGroupId: "resume-http", levelSignal: 1.7, directness: 1, quality: 0.82, coverage: 0.72, claim: "Built API endpoints and handled HTTP methods/status codes" },
  { id: "ev-rest-1", skillId: "rest-api", sourceType: "RESUME_PROJECT_DETAIL", sourceGroupId: "resume-rest", levelSignal: 1.4, directness: 1, quality: 0.78, coverage: 0.65, claim: "Developed REST APIs with Node.js and Express" },
  { id: "ev-auth-1", skillId: "authentication", sourceType: "RESUME_PROJECT_DETAIL", sourceGroupId: "resume-auth", levelSignal: 1.4, directness: 1, quality: 0.80, coverage: 0.62, claim: "Implemented JWT-based authentication" },
  { id: "ev-sql-1", skillId: "sql", sourceType: "RESUME_PROJECT_DETAIL", sourceGroupId: "resume-sql", levelSignal: 2.2, directness: 1, quality: 0.88, coverage: 0.78, claim: "Designed relational queries and schemas" },
  { id: "ev-git-1", skillId: "git", sourceType: "RESUME_PROJECT_DETAIL", sourceGroupId: "resume-git", levelSignal: 2.1, directness: 0.95, quality: 0.82, coverage: 0.65, claim: "Used Git branches and pull requests" },
  { id: "ev-linux-1", skillId: "linux", sourceType: "PROJECT_DESCRIPTION", sourceGroupId: "project-linux", levelSignal: 1.8, directness: 0.9, quality: 0.82, coverage: 0.65, claim: "Used Linux CLI for development" },
  { id: "ev-docker-1", skillId: "docker", sourceType: "RESUME_SKILL_MENTION", sourceGroupId: "resume-docker", levelSignal: 1.0, directness: 0.8, quality: 0.35, coverage: 0.25, claim: "Docker listed in skills" },
  { id: "ev-design-1", skillId: "system-design", sourceType: "MANUAL_SELF_REPORT", sourceGroupId: "manual-design", levelSignal: 0.9, directness: 0.75, quality: 0.55, coverage: 0.45, claim: "Studied caching and load balancing" }
];

const states = (evidence: SkillEvidence[]): UserSkillState[] => BACKEND_ENGINEER_V1.map(r => estimateSkill(r.skillId, evidence));
export function runVerticalSlice() {
  const beforeSkills = states(initialEvidence);
  const beforeGaps = analyzeGaps(BACKEND_ENGINEER_V1, beforeSkills);
  const beforePlan = createWeekOnePlan(beforeGaps, 600);
  const afterEvidence = [...initialEvidence, outcomeToEvidence(REST_DEMO_OUTCOME)];
  const afterSkills = states(afterEvidence);
  const afterGaps = analyzeGaps(BACKEND_ENGINEER_V1, afterSkills);
  const replan = replanForRestWeakness(beforePlan, REST_DEMO_OUTCOME.weaknesses);
  return { before: { readiness: readiness(BACKEND_ENGINEER_V1, beforeSkills), skills: beforeSkills, gaps: beforeGaps, plan: beforePlan }, assessment: REST_DEMO_OUTCOME, after: { readiness: readiness(BACKEND_ENGINEER_V1, afterSkills), skills: afterSkills, gaps: afterGaps, plan: replan.plan }, planDiff: replan.diff };
}
