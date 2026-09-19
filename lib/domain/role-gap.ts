import type { UserSkillState } from "./skills.js";

export interface RoleRequirement { skillId: string; targetScore: number; importance: number; prerequisites?: string[] }
export const BACKEND_ENGINEER_V1: RoleRequirement[] = [
  { skillId: "http", targetScore: 2.0, importance: 0.95 },
  { skillId: "rest-api", targetScore: 2.0, importance: 1.0, prerequisites: ["http"] },
  { skillId: "authentication", targetScore: 2.0, importance: 0.9, prerequisites: ["rest-api"] },
  { skillId: "sql", targetScore: 2.0, importance: 0.85 },
  { skillId: "git", targetScore: 2.0, importance: 0.65 },
  { skillId: "linux", targetScore: 1.5, importance: 0.7 },
  { skillId: "docker", targetScore: 2.0, importance: 0.85, prerequisites: ["linux"] },
  { skillId: "system-design", targetScore: 1.5, importance: 0.9, prerequisites: ["rest-api", "sql"] }
];

export type GapStatus = "STRONG" | "DEVELOPING" | "GAP";
export type PriorityBand = "COMPLETE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export interface GapRow { skillId: string; currentScore: number | null; targetScore: number; status: GapStatus; gapSeverity: number; priorityScore: number; priority: PriorityBand; recommendedAction: "LEARN" | "VALIDATE" | "VALIDATE_FIRST" | "MAINTAIN" }

const band = (score: number): PriorityBand => score <= 0 ? "COMPLETE" : score < 0.25 ? "LOW" : score < 0.5 ? "MEDIUM" : score < 0.75 ? "HIGH" : "CRITICAL";

export function analyzeGaps(requirements: RoleRequirement[], skills: UserSkillState[]): GapRow[] {
  const state = new Map(skills.map(s => [s.skillId, s]));
  return requirements.map(req => {
    const current = state.get(req.skillId);
    const score = current?.capabilityScore ?? null;
    const gap = score === null ? 1 : Math.max(0, (req.targetScore - score) / req.targetScore);
    const uncertainty = current ? 1 - current.confidence : 1;
    const dependencyImpact = requirements.some(r => r.prerequisites?.includes(req.skillId)) ? 1 : 0.4;
    const priorityScore = gap === 0 ? 0 : Math.min(1, 0.40 * req.importance + 0.30 * gap + 0.20 * dependencyImpact + 0.10 * 0.6);
    const status: GapStatus = gap === 0 ? "STRONG" : gap <= 0.35 ? "DEVELOPING" : "GAP";
    const recommendedAction: GapRow["recommendedAction"] = gap === 0 ? "MAINTAIN" : uncertainty >= 0.7 ? "VALIDATE" : uncertainty >= 0.55 && gap <= 0.45 ? "VALIDATE_FIRST" : "LEARN";
    return { skillId: req.skillId, currentScore: score, targetScore: req.targetScore, status, gapSeverity: Number(gap.toFixed(3)), priorityScore: Number(priorityScore.toFixed(3)), priority: band(priorityScore), recommendedAction };
  }).sort((a, b) => b.priorityScore - a.priorityScore);
}

export function readiness(requirements: RoleRequirement[], skills: UserSkillState[]): number {
  const state = new Map(skills.map(s => [s.skillId, s]));
  let earned = 0, possible = 0;
  for (const req of requirements) {
    possible += req.importance;
    const current = state.get(req.skillId);
    const ratio = current?.capabilityScore == null ? 0 : Math.min(current.capabilityScore / req.targetScore, 1);
    earned += req.importance * ratio * (0.75 + 0.25 * (current?.confidence ?? 0));
  }
  return possible === 0 ? 0 : Math.round((earned / possible) * 100);
}
