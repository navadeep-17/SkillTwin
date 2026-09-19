export type SkillLevel = "UNKNOWN" | "NONE" | "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT";
export type ConfidenceBand = "LOW" | "MEDIUM" | "HIGH";
export type EvidenceSource = "MANUAL_SELF_REPORT" | "RESUME_SKILL_MENTION" | "RESUME_PROJECT_DETAIL" | "PRACTICE_EVALUATED" | "ASSESSMENT_SUMMARY" | "PROJECT_DESCRIPTION" | "PROJECT_ARTIFACT_VERIFIED";

export interface SkillEvidence {
  id: string;
  skillId: string;
  sourceType: EvidenceSource;
  sourceGroupId: string;
  levelSignal: number | null;
  directness: number;
  quality: number;
  coverage: number;
  claim: string;
}

export interface UserSkillState {
  skillId: string;
  capabilityScore: number | null;
  level: SkillLevel;
  confidence: number;
  confidenceBand: ConfidenceBand;
  evidenceCount: number;
}

const BASELINE: Record<EvidenceSource, number> = {
  MANUAL_SELF_REPORT: 0.20,
  RESUME_SKILL_MENTION: 0.25,
  RESUME_PROJECT_DETAIL: 0.45,
  PRACTICE_EVALUATED: 0.55,
  ASSESSMENT_SUMMARY: 0.85,
  PROJECT_DESCRIPTION: 0.60,
  PROJECT_ARTIFACT_VERIFIED: 0.70
};

const clamp = (n: number, min = 0, max = 1) => Math.max(min, Math.min(max, n));
export const effectiveWeight = (e: SkillEvidence) => BASELINE[e.sourceType] * clamp(e.directness) * clamp(e.quality) * clamp(e.coverage);

export function scoreToLevel(score: number | null): SkillLevel {
  if (score === null) return "UNKNOWN";
  if (score < 0.5) return "NONE";
  if (score < 1.5) return "BEGINNER";
  if (score < 2.5) return "INTERMEDIATE";
  if (score < 3.5) return "ADVANCED";
  return "EXPERT";
}

export function estimateSkill(skillId: string, evidence: SkillEvidence[]): UserSkillState {
  const eligible = evidence.filter(e => e.skillId === skillId && e.levelSignal !== null && e.directness >= 0.4);
  const byGroup = new Map<string, SkillEvidence>();
  for (const item of eligible) {
    const current = byGroup.get(item.sourceGroupId);
    if (!current || effectiveWeight(item) > effectiveWeight(current)) byGroup.set(item.sourceGroupId, item);
  }
  const rows = [...byGroup.values()];
  const totalWeight = rows.reduce((sum, e) => sum + effectiveWeight(e), 0);
  if (totalWeight < 0.2) return { skillId, capabilityScore: null, level: "UNKNOWN", confidence: 0.1, confidenceBand: "LOW", evidenceCount: evidence.filter(e => e.skillId === skillId).length };

  const score = rows.reduce((sum, e) => sum + effectiveWeight(e) * (e.levelSignal ?? 0), 0) / totalWeight;
  const families = new Set(rows.map(e => e.sourceType.split("_")[0])).size;
  const variance = rows.reduce((sum, e) => sum + effectiveWeight(e) * Math.pow((e.levelSignal ?? 0) - score, 2), 0) / totalWeight;
  const consistency = 1 - Math.min(Math.sqrt(variance) / 1.5, 1);
  const coverage = rows.reduce((sum, e) => sum + effectiveWeight(e) * e.coverage, 0) / totalWeight;
  const validated = rows.some(e => e.sourceType === "ASSESSMENT_SUMMARY" && effectiveWeight(e) >= 0.45) ? 1 : 0;
  const confidence = clamp(0.10 + 0.40 * Math.min(totalWeight / 1.5, 1) + 0.20 * Math.min(families / 3, 1) + 0.15 * consistency + 0.10 * coverage + 0.05 * validated, 0.10, 0.95);
  const band: ConfidenceBand = confidence < 0.45 ? "LOW" : confidence < 0.75 ? "MEDIUM" : "HIGH";
  return { skillId, capabilityScore: Number(score.toFixed(3)), level: scoreToLevel(score), confidence: Number(confidence.toFixed(3)), confidenceBand: band, evidenceCount: evidence.filter(e => e.skillId === skillId).length };
}
