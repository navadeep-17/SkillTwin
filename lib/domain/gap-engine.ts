import type { UserSkillState } from "./skills.js";
import type { RequirementGroup, RoleDependencyEdge, RoleRequirement, RoleVersion } from "./role-model.js";

export interface GapResult {
  requirementId: string;
  groupId: string;
  skillId: string;
  currentScore: number | null;
  currentConfidence: number;
  targetScore: number;
  attainment: number;
  gapSeverity: number;
  dependencyImpact: number;
  urgency: number;
  priorityScore: number;
  priorityBand: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "COMPLETE";
  status: "STRONG" | "DEVELOPING" | "GAP";
  recommendedAction: "LEARN" | "VALIDATE" | "VALIDATE_FIRST" | "MAINTAIN";
  reasonCodes: string[];
}

export interface GapAnalysis {
  roleVersionId: string;
  gaps: GapResult[];
  readiness: number;
  evidenceCoverage: number;
  selectedAlternatives: Record<string, string>;
}

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const band = (score: number): GapResult["priorityBand"] =>
  score <= 0 ? "COMPLETE" : score >= 0.80 ? "CRITICAL" : score >= 0.65 ? "HIGH" : score >= 0.45 ? "MEDIUM" : "LOW";

function chooseAnyOf(group: RequirementGroup, members: RoleRequirement[], states: Map<string, UserSkillState>, preferred?: string) {
  if (preferred && members.some(member => member.skillId === preferred)) return preferred;

  const ranked = members
    .map(member => ({ member, state: states.get(member.skillId) }))
    .filter(row => row.state?.capabilityScore != null)
    .map(row => ({
      skillId: row.member.skillId,
      score: 0.75 * clamp((row.state!.capabilityScore ?? 0) / row.member.targetScore) + 0.25 * row.state!.confidence
    }))
    .sort((a, b) => b.score - a.score || a.skillId.localeCompare(b.skillId));

  return ranked[0]?.skillId
    ?? members.find(member => member.isDefaultAlternative)?.skillId
    ?? members[0]?.skillId
    ?? group.id;
}

function dependencyImpact(requirements: RoleRequirement[], edges: RoleDependencyEdge[], activeIds: Set<string>) {
  const children = new Map<string, Array<{ id: string; weight: number }>>();
  for (const edge of edges) {
    if (!activeIds.has(edge.prerequisiteRequirementId) || !activeIds.has(edge.dependentRequirementId)) continue;
    const list = children.get(edge.prerequisiteRequirementId) ?? [];
    list.push({ id: edge.dependentRequirementId, weight: edge.edgeType === "HARD" ? 1 : 0.5 });
    children.set(edge.prerequisiteRequirementId, list);
  }

  const requirementMap = new Map(requirements.map(item => [item.id, item]));
  const raw = new Map<string, number>();
  for (const requirement of requirements.filter(item => activeIds.has(item.id))) {
    let score = 0;
    for (const child of children.get(requirement.id) ?? []) {
      score += (requirementMap.get(child.id)?.importance ?? 0) * child.weight;
    }
    raw.set(requirement.id, score);
  }
  const max = Math.max(0, ...raw.values());
  return new Map([...raw].map(([id, score]) => [id, max ? score / max : 0]));
}

export function analyzeRoleGaps(input: {
  role: RoleVersion;
  userSkills: UserSkillState[];
  preferredAlternatives?: Record<string, string>;
  remainingWeeks?: number;
}): GapAnalysis {
  const states = new Map(input.userSkills.map(item => [item.skillId, item]));
  const selectedAlternatives: Record<string, string> = {};
  const active: RoleRequirement[] = [];

  for (const group of input.role.groups) {
    const members = input.role.requirements.filter(item => item.groupId === group.id);
    if (group.type === "ANY_OF") {
      const selectedSkill = chooseAnyOf(group, members, states, input.preferredAlternatives?.[group.id]);
      selectedAlternatives[group.id] = selectedSkill;
      const requirement = members.find(member => member.skillId === selectedSkill);
      if (requirement) active.push({ ...requirement, importance: group.groupImportance });
    } else {
      active.push(...members);
    }
  }

  const activeIds = new Set(active.map(item => item.id));
  const impacts = dependencyImpact(input.role.requirements, input.role.dependencies, activeIds);
  const pressure = input.remainingWeeks == null ? 0.5 : clamp(8 / Math.max(input.remainingWeeks, 1), 0.25, 1);

  const gaps = active.map(requirement => {
    const state = states.get(requirement.skillId);
    const currentScore = state?.capabilityScore ?? null;
    const confidence = state?.confidence ?? 0;
    const gapSeverity = currentScore == null ? 1 : clamp(Math.max(requirement.targetScore - currentScore, 0) / Math.max(requirement.targetScore, 0.5));
    const attainment = currentScore == null ? 0 : clamp(currentScore / Math.max(requirement.targetScore, 0.5));
    const dep = impacts.get(requirement.id) ?? 0;
    const stage = ({1:1,2:0.75,3:0.5,4:0.25} as Record<number, number>)[requirement.learningStage] ?? 0.25;
    const urgency = clamp(0.70 * stage + 0.30 * pressure);
    const priorityScore = gapSeverity <= 0.05 ? 0 : clamp(0.40 * requirement.importance + 0.30 * gapSeverity + 0.20 * dep + 0.10 * urgency);
    const status: GapResult["status"] = gapSeverity <= 0.05 ? "STRONG" : gapSeverity < 0.60 ? "DEVELOPING" : "GAP";
    const recommendedAction: GapResult["recommendedAction"] =
      gapSeverity <= 0.05 ? (confidence >= 0.55 ? "MAINTAIN" : "VALIDATE")
      : ((currentScore == null || confidence < 0.45) && requirement.importance >= 0.75 ? "VALIDATE_FIRST" : "LEARN");
    const reasonCodes: string[] = [];
    if (requirement.importance >= 0.9) reasonCodes.push("CORE_REQUIREMENT");
    if (gapSeverity >= 0.6) reasonCodes.push("LARGE_GAP");
    if (dep >= 0.5) reasonCodes.push("BLOCKS_DEPENDENCIES");
    if (requirement.learningStage === 1) reasonCodes.push("FOUNDATION_SKILL");
    if (confidence < 0.45) reasonCodes.push("LOW_CONFIDENCE");

    return {
      requirementId: requirement.id,
      groupId: requirement.groupId,
      skillId: requirement.skillId,
      currentScore,
      currentConfidence: confidence,
      targetScore: requirement.targetScore,
      attainment: Number(attainment.toFixed(4)),
      gapSeverity: Number(gapSeverity.toFixed(4)),
      dependencyImpact: Number(dep.toFixed(4)),
      urgency: Number(urgency.toFixed(4)),
      priorityScore: Number(priorityScore.toFixed(4)),
      priorityBand: band(priorityScore),
      status,
      recommendedAction,
      reasonCodes
    };
  }).sort((a, b) => b.priorityScore - a.priorityScore);

  let earned = 0;
  let coverage = 0;
  let possible = 0;
  for (const requirement of active) {
    const state = states.get(requirement.skillId);
    const attainment = state?.capabilityScore == null ? 0 : clamp(state.capabilityScore / requirement.targetScore);
    const certainty = state?.capabilityScore == null ? 0 : 0.80 + 0.20 * state.confidence;
    earned += requirement.importance * attainment * certainty;
    coverage += requirement.importance * (state?.confidence ?? 0);
    possible += requirement.importance;
  }

  return {
    roleVersionId: input.role.roleVersionId,
    gaps,
    readiness: possible ? Math.round(100 * earned / possible) : 0,
    evidenceCoverage: possible ? Math.round(100 * coverage / possible) : 0,
    selectedAlternatives
  };
}
