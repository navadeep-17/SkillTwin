export type RequirementGroupType = "SINGLE" | "ALL_OF" | "ANY_OF";
export type DependencyEdgeType = "HARD" | "SOFT";

export interface RoleRequirement {
  id: string;
  groupId: string;
  skillId: string;
  targetScore: number;
  importance: number;
  learningStage: 1 | 2 | 3 | 4;
  isDefaultAlternative: boolean;
  rationale: string;
}

export interface RequirementGroup {
  id: string;
  name: string;
  type: RequirementGroupType;
  groupImportance: number;
}

export interface RoleDependencyEdge {
  prerequisiteRequirementId: string;
  dependentRequirementId: string;
  edgeType: DependencyEdgeType;
}

export interface RoleVersion {
  roleId: string;
  roleName: string;
  roleVersionId: string;
  version: number;
  groups: RequirementGroup[];
  requirements: RoleRequirement[];
  dependencies: RoleDependencyEdge[];
}
