/**
 * Deterministic, read-only role-to-role competency comparison.
 *
 * Structural overlap is NOT readiness, likelihood of employment, certification,
 * or a guarantee that the learner meets the target proficiency.
 */
export type CareerRequirementSketch = {
  skillId: string;
  name: string;
  groupType: "SINGLE" | "ALL_OF" | "ANY_OF";
  groupName: string;
  documented: boolean;
};

export type SharedCareerSkill = {
  skillId: string;
  name: string;
  documented: boolean;
  leftGroupType: CareerRequirementSketch["groupType"];
  leftGroupName: string;
  rightGroupType: CareerRequirementSketch["groupType"];
  rightGroupName: string;
};

export type CareerComparison = {
  leftCount: number;
  rightCount: number;
  shared: SharedCareerSkill[];
  leftOnly: CareerRequirementSketch[];
  rightOnly: CareerRequirementSketch[];
  recordedSharedCount: number;
};

function unique(requirements: CareerRequirementSketch[]): Map<string, CareerRequirementSketch> {
  const bySkill = new Map<string, CareerRequirementSketch>();
  for (const item of requirements) {
    if (!item.skillId) continue;
    const existing = bySkill.get(item.skillId);
    if (!existing) {
      bySkill.set(item.skillId, item);
    } else if (item.documented && !existing.documented) {
      bySkill.set(item.skillId, { ...existing, documented: true });
    }
  }
  return bySkill;
}
function alphabetize<T extends { name: string; skillId: string }>(items: T[]): T[] {
  return items.sort((a, b) => a.name.localeCompare(b.name) || a.skillId.localeCompare(b.skillId));
}

export function compareCareerRequirements(
  leftRequirements: CareerRequirementSketch[],
  rightRequirements: CareerRequirementSketch[]
): CareerComparison {
  const left = unique(leftRequirements);
  const right = unique(rightRequirements);
  const shared: SharedCareerSkill[] = [];
  const leftOnly: CareerRequirementSketch[] = [];
  const rightOnly: CareerRequirementSketch[] = [];

  for (const [skillId, item] of left) {
    const other = right.get(skillId);
    if (!other) {
      leftOnly.push(item);
      continue;
    }
    shared.push({
      skillId,
      name: item.name,
      documented: item.documented || other.documented,
      leftGroupType: item.groupType,
      leftGroupName: item.groupName,
      rightGroupType: other.groupType,
      rightGroupName: other.groupName
    });
  }
  for (const [skillId, item] of right) {
    if (!left.has(skillId)) rightOnly.push(item);
  }
  alphabetize(shared);
  alphabetize(leftOnly);
  alphabetize(rightOnly);
  return {
    leftCount: left.size,
    rightCount: right.size,
    shared,
    leftOnly,
    rightOnly,
    recordedSharedCount: shared.filter(item => item.documented).length
  };
}
