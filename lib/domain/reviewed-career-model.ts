/**
 * Source-backed occupational role-model DRAFTS, deliberately isolated from
 * ACTIVE public.role_versions, readiness scoring and learner planning.
 *
 * A reviewed identifier crosswalk is not a reviewed occupation requirement.
 * Each target score / importance must be supplied independently by a human.
 */
import {
  buildMappingReviewQueue, validateMappingReviewManifest,
  type CanonicalSnapshot, type MappingReviewManifest,
  type SourceSnapshot, type SourceOccupation
} from "./occupation-mapping.js";

export type DraftRequirement = {
  sourceSkillKey: string;
  canonicalSkillSlug: string;
  groupType: "SINGLE";
  targetScore: number | null;
  importance: number | null;
  importanceBand: "CORE" | "IMPORTANT" | "SUPPORTING" | null;
  learningStage: 1 | 2 | 3 | 4 | null;
  rationale: string;
  reviewer: string | null;
  reviewedAt: string | null;
};

export type DraftOccupationModel = {
  occupationId: string;
  status: "DRAFT";
  jurisdiction: "US";
  requirements: DraftRequirement[];
};

export type DraftModelManifest = {
  schemaVersion: 1;
  sourceSnapshotId: string;
  canonicalSnapshotId: string;
  mappingLedgerVersion: "review-decisions-v2";
  models: DraftOccupationModel[];
};

export type SourceRequirementStatus = {
  sourceSkillKey: string;
  sourceName: string;
  sourceGroup: "ESSENTIAL" | "TRANSFERABLE";
  importance: number;
  mappingStatus: "PENDING" | "REJECTED" | "NEEDS_NEW_SKILL" | "APPROVED";
  canonicalSkillSlug: string | null;
  targetScore: number | null;
  importanceBand: DraftRequirement["importanceBand"];
  learningStage: DraftRequirement["learningStage"];
  configured: boolean;
};

export type DraftModelSummary = {
  occupationId: string;
  name: string;
  family: string;
  sourceUrl: string;
  jurisdiction: "US";
  status: "EXPLORATORY";
  sourceSkillCount: number;
  approvedMappings: number;
  configuredRequirements: number;
  draftRequirementCount: number;
  blockers: string[];
  sourceSkills: SourceRequirementStatus[];
};

/** A score is configured only if a reviewer supplied *all* required metadata. */
function configured(row: DraftRequirement): boolean {
  return row.targetScore !== null &&
    row.importance !== null &&
    row.importanceBand !== null &&
    row.learningStage !== null &&
    row.rationale.trim().length >= 30 &&
    typeof row.reviewer === "string" && /^@[a-zA-Z0-9][a-zA-Z0-9-]{0,38}$/.test(row.reviewer) &&
    typeof row.reviewedAt === "string" && !Number.isNaN(Date.parse(row.reviewedAt)) &&
    row.reviewedAt.endsWith("Z");
}
const inRange = (v: number | null, min: number, max: number) =>
  v === null || (typeof v === "number" && Number.isFinite(v) && v >= min && v <= max);

function entries(occupation: SourceOccupation) {
  return [
    ...occupation.essentialSkills.map(x => ({ name: x.name, group: "ESSENTIAL" as const, importance: x.importance })),
    ...occupation.transferableSkills.map(x => ({ name: x.name, group: "TRANSFERABLE" as const, importance: x.importance }))
  ];
}

function sourceKey(name: string, group: "ESSENTIAL" | "TRANSFERABLE") {
  return group + "::" + name.normalize("NFKC").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

/**
 * This function rejects ALL unreviewed source-to-canonical assignments, even
 * if exact string labels match. Does not query or modify any user record.
 */
export function validateDraftModelManifest(
  source: SourceSnapshot,
  catalog: CanonicalSnapshot,
  mappingLedger: MappingReviewManifest,
  draft: DraftModelManifest
): string[] {
  const errors = [...validateMappingReviewManifest(source, catalog, mappingLedger)];
  if (draft.schemaVersion !== 1) errors.push("Unsupported model-draft schema");
  if (draft.sourceSnapshotId !== source.snapshotId) errors.push("Occupation source version mismatch");
  if (draft.canonicalSnapshotId !== catalog.snapshotId) errors.push("Canonical taxonomy version mismatch");
  if (draft.mappingLedgerVersion !== "review-decisions-v2") errors.push("Unexpected mapping ledger version");
  if (!Array.isArray(draft.models)) return [...errors, "Model drafts must be an array"];
  const permitted = new Map(source.occupations.map(x => [x.occupationId, x]));
  const decisionByKey = new Map(mappingLedger.decisions.map(x => [x.sourceSkillKey, x]));
  const canonical = new Set(catalog.skills.map(x => x.slug));
  const seenModels = new Set<string>();
  for (const model of draft.models) {
    const prefix = String(model.occupationId);
    const occupation = permitted.get(prefix);
    if (!occupation) { errors.push("Unknown occupation: " + prefix); continue; }
    if (seenModels.has(prefix)) errors.push("Duplicate occupation model: " + prefix);
    seenModels.add(prefix);
    if (model.status !== "DRAFT" || model.jurisdiction !== "US") errors.push("Draft must retain EXPLORATORY US context: " + prefix);
    if (!Array.isArray(model.requirements)) { errors.push("Requirements must be an array: " + prefix); continue; }
    const sourceKeys = new Set(entries(occupation).map(x => sourceKey(x.name, x.group)));
    const seenRequirements = new Set<string>();
    for (const row of model.requirements) {
      const key = String(row.sourceSkillKey);
      if (!sourceKeys.has(key)) errors.push("Requirement not present in sourced occupation: " + prefix + "/" + key);
      if (seenRequirements.has(key)) errors.push("Duplicate draft requirement: " + prefix + "/" + key);
      seenRequirements.add(key);
      const decision = decisionByKey.get(key);
      if (decision?.decision !== "APPROVED" || decision.canonicalSkillSlug !== row.canonicalSkillSlug) {
        errors.push("Requirement needs approved source-to-canonical mapping: " + prefix + "/" + key);
      }
      if (!canonical.has(row.canonicalSkillSlug)) errors.push("Requirement references unknown canonical skill: " + key);
      if (row.groupType !== "SINGLE") errors.push("Alternatives need separate expert group review: " + key);
      if (!inRange(row.targetScore, 0.5, 4)) errors.push("Invalid proposed proficiency: " + key);
      if (!inRange(row.importance, 0.1, 1)) errors.push("Invalid proposed importance: " + key);
      if (row.importanceBand !== null && !["CORE", "IMPORTANT", "SUPPORTING"].includes(row.importanceBand)) errors.push("Invalid importance band: " + key);
      if (row.learningStage !== null && (![1,2,3,4].includes(row.learningStage))) errors.push("Invalid learning stage: " + key);
      const reviewMeta = [row.targetScore, row.importance, row.importanceBand, row.learningStage]
        .some(value => value !== null) || Boolean(row.rationale || row.reviewer || row.reviewedAt);
      if (reviewMeta && !configured(row)) errors.push("Partial or unreviewed requirement configuration: " + key);
    }
  }
  return errors;
}

export function buildDraftModelSummaries(
  source: SourceSnapshot,
  catalog: CanonicalSnapshot,
  mappingLedger: MappingReviewManifest,
  draft: DraftModelManifest
): DraftModelSummary[] {
  const errors = validateDraftModelManifest(source, catalog, mappingLedger, draft);
  if (errors.length) throw new Error("Invalid reviewed career model draft: " + errors.join("; "));
  const queue = buildMappingReviewQueue(source, catalog, mappingLedger);
  const reviewByKey = new Map(queue.map(x => [x.sourceSkillKey, x]));
  const draftByOccupation = new Map(draft.models.map(x => [x.occupationId, x]));
  return source.occupations.map(occupation => {
    const model = draftByOccupation.get(occupation.occupationId);
    const draftRows = new Map((model?.requirements ?? []).map(x => [x.sourceSkillKey, x]));
    const listed = entries(occupation);
    const requirements: SourceRequirementStatus[] = listed.map(item => {
      const key = sourceKey(item.name, item.group);
      const reviewed = reviewByKey.get(key);
      const row = draftRows.get(key);
      return {
        sourceSkillKey: key, sourceName: item.name, sourceGroup: item.group,
        importance: item.importance,
        mappingStatus: reviewed?.status ?? "PENDING",
        canonicalSkillSlug: reviewed?.review?.decision === "APPROVED" ? reviewed.review.canonicalSkillSlug : null,
        targetScore: row?.targetScore ?? null,
        importanceBand: row?.importanceBand ?? null,
        learningStage: row?.learningStage ?? null,
        configured: row ? configured(row) : false
      };
    });
    const approved = requirements.filter(x => x.mappingStatus === "APPROVED").length;
    const configuredCount = requirements.filter(x => x.configured).length;
    const blockers = [];
    if (approved < listed.length) blockers.push("Unreviewed or rejected O*NET skill mappings (" + (listed.length-approved) + " remaining)");
    if (configuredCount < approved) blockers.push("Human-authored proficiency, priority and stage missing for " + (approved-configuredCount) + " approved mappings");
    if (configuredCount < 4) blockers.push("At least four reviewed draft requirements needed before model review");
    blockers.push("Independent assessment coverage not validated");
    blockers.push("Regional qualifications and professional licensing not reviewed");
    blockers.push("No approved activation or source-to-role promotion");
    return {
      occupationId: occupation.occupationId, name: occupation.name,
      family: String((occupation as SourceOccupation & { family?: string }).family ?? "Other careers"),
      sourceUrl: occupation.sourceUrl, jurisdiction: "US" as const,
      status: "EXPLORATORY" as const,
      sourceSkillCount: listed.length,
      approvedMappings: approved,
      configuredRequirements: configuredCount,
      draftRequirementCount: model?.requirements.length ?? 0,
      blockers, sourceSkills: requirements
    };
  });
}
