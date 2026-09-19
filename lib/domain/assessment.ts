import type { SkillEvidence } from "./skills.js";
export interface AssessmentOutcome { skillId: string; normalizedScore: number; levelSignal: number; coverage: number; evaluatorConfidence: number; strengths: string[]; weaknesses: string[] }
export const REST_DEMO_OUTCOME: AssessmentOutcome = { skillId: "rest-api", normalizedScore: 0.70, levelSignal: 1.9, coverage: 0.82, evaluatorConfidence: 0.92, strengths: ["resource design", "status codes"], weaknesses: ["PUT vs PATCH semantics", "idempotency"] };
export function outcomeToEvidence(outcome: AssessmentOutcome): SkillEvidence {
  return { id: "ev-rest-assessment-summary-001", skillId: outcome.skillId, sourceType: "ASSESSMENT_SUMMARY", sourceGroupId: "assessment-rest-demo-001", levelSignal: outcome.levelSignal, directness: 1, quality: outcome.evaluatorConfidence, coverage: outcome.coverage, claim: `Strengths: ${outcome.strengths.join(", ")}; weaknesses: ${outcome.weaknesses.join(", ")}` };
}
