import type { EvidenceSource } from "./skills.js";
import { getCompetencyRubric, type CompetencyCriterion, type CompetencyTier } from "./competency-rubrics-a3.js";

export const EVIDENCE_ESTIMATOR_A3_VERSION = "evidence-estimator-a3-pilot1";

/**
 * Criterion IDs must be selected by a trusted evaluator that checks the
 * underlying performance against the published competency criterion.
 * NEVER accept evaluationKind from raw learner input or a resume extractor.
 *
 * Critically: a filename, GitHub URL or persuasive project claim is NOT
 * equivalent to independent artifact review.
 */
export interface CompetencyObservation {
  evidenceId: string;
  sourceGroupId: string;
  criterionId: string;
  sourceType: EvidenceSource;
  outcome: "SUPPORTS" | "CONTRADICTS";
  evaluationKind?: "SERVER_EVALUATED" | "INDEPENDENT_ARTIFACT_REVIEW";
}

export type CriterionStatus =
  | "UNOBSERVED" | "CLAIMED" | "DISPUTED_CLAIM"
  | "DEMONSTRATED" | "REVIEWED" | "NOT_DEMONSTRATED" | "CONFLICTED";

export interface CriterionResult extends CompetencyCriterion {
  status: CriterionStatus;
  supportingEvidenceIds: string[];
  contradictingEvidenceIds: string[];
}

export type ValidationState =
  | "NOT_REQUIRED" | "NO_EVIDENCE" | "CLAIMED_ONLY"
  | "PARTIALLY_DEMONSTRATED" | "CONTRADICTED" | "SUPPORTED";

export interface CompetencyAssessment {
  version: typeof EVIDENCE_ESTIMATOR_A3_VERSION;
  rubricVersion: string;
  skillSlug: string;
  targetScore: number;
  targetTier: CompetencyTier | 0;
  demonstratedLevel: CompetencyTier | null;
  requiredCriterionCount: number;
  demonstratedCriterionCount: number;
  observedCriterionCount: number;
  failedCriterionCount: number;
  conflictedCriterionCount: number;
  demonstratedCoverage: number;
  evidenceCoverage: number;
  validationState: ValidationState;
  criteria: CriterionResult[];
}

type Tier = 0 | 1 | 2;
const round = (v: number) => Number(v.toFixed(4));
const validated = (n: Tier) => n >= 1;
const statusValid = (s: CriterionStatus) => s === "DEMONSTRATED" || s === "REVIEWED";

function evidenceTier(row: CompetencyObservation): Tier {
  if (row.evaluationKind === "INDEPENDENT_ARTIFACT_REVIEW") {
    if (row.sourceType !== "PROJECT_ARTIFACT_VERIFIED") throw new Error("INVALID_VERIFICATION_PROVENANCE");
    return 2;
  }
  if (row.evaluationKind === "SERVER_EVALUATED") {
    if (row.sourceType !== "ASSESSMENT_QUESTION" && row.sourceType !== "PRACTICE_EVALUATED")
      throw new Error("INVALID_VERIFICATION_PROVENANCE");
    return 1;
  }
  return 0;
}

function deduplicateObservations(rows: readonly CompetencyObservation[]) {
  const groups = new Map<string, {item:CompetencyObservation;tier:Tier}>();
  for (const item of rows) {
    if (!item.evidenceId.trim() || !item.sourceGroupId.trim() || !item.criterionId.trim())
      throw new Error("INVALID_COMPETENCY_EVIDENCE_ID");
    if (item.outcome !== "SUPPORTS" && item.outcome !== "CONTRADICTS")
      throw new Error("INVALID_COMPETENCY_OUTCOME");
    if (item.evaluationKind &&
      item.evaluationKind !== "SERVER_EVALUATED" &&
      item.evaluationKind !== "INDEPENDENT_ARTIFACT_REVIEW")
      throw new Error("INVALID_VERIFICATION_PROVENANCE");
    const tier = evidenceTier(item);
    const key = item.criterionId + ":" + item.sourceGroupId;
    const current = groups.get(key);
    // Duplicate reports from the same underlying project/test are correlated.
    // Prefer higher-assurance observations; conservatively prefer contradiction
    // at equal assurance. Never count a duplicate as extra corroboration.
    if (!current || current.tier < tier
      || (current.tier === tier && item.outcome === "CONTRADICTS" && current.item.outcome === "SUPPORTS")
      || (current.tier === tier && item.outcome === current.item.outcome && item.evidenceId < current.item.evidenceId)) {
      groups.set(key,{item,tier});
    }
  }
  return [...groups.values()];
}

function evaluateCriterion(criterion: CompetencyCriterion,
  observations: ReturnType<typeof deduplicateObservations>): CriterionResult {
  const rows = observations.filter(row => row.item.criterionId === criterion.id);
  const positive = rows.filter(row => row.item.outcome === "SUPPORTS");
  const negative = rows.filter(row => row.item.outcome === "CONTRADICTS");
  const demonstratedSupport = positive.some(row => validated(row.tier));
  const demonstratedFailure = negative.some(row => validated(row.tier));
  let status: CriterionStatus = "UNOBSERVED";
  if (demonstratedSupport && demonstratedFailure) status = "CONFLICTED";
  else if (demonstratedFailure) status = "NOT_DEMONSTRATED";
  else if (demonstratedSupport) {
    status = positive.some(row => row.tier === 2) ? "REVIEWED" : "DEMONSTRATED";
  } else if (positive.length && negative.length) status = "DISPUTED_CLAIM";
  else if (positive.length) status = "CLAIMED";

  return {
    ...criterion,
    status,
    supportingEvidenceIds: positive.map(row => row.item.evidenceId).sort(),
    contradictingEvidenceIds: negative.map(row => row.item.evidenceId).sort()
  };
}

/**
 * Assesses specific observable competencies, NOT aggregate resume prose.
 * No invented numerical weights, calibrated probabilities or inferred missing
 * evidence. Absence of validation means UNKNOWN, not low skill ability.
 */
export function assessSkillCompetencies(input: {
  skillSlug: string;
  targetScore: number;
  observations: readonly CompetencyObservation[];
}): CompetencyAssessment {
  const rubric = getCompetencyRubric(input.skillSlug);
  if (!rubric) throw new Error("COMPETENCY_RUBRIC_NOT_FOUND");
  if (!Number.isFinite(input.targetScore) || input.targetScore < 0 || input.targetScore > 4)
    throw new Error("INVALID_COMPETENCY_TARGET");

  const ids = new Set(rubric.criteria.map(c => c.id));
  for (const row of input.observations) {
    if (!ids.has(row.criterionId)) throw new Error("UNKNOWN_COMPETENCY_CRITERION");
  }

  const representatives = deduplicateObservations(input.observations);
  const criteria = rubric.criteria.map(c => evaluateCriterion(c,representatives));
  const targetTier = Math.ceil(input.targetScore) as CompetencyTier | 0;
  const required = criteria.filter(c => c.tier <= targetTier);
  const demonstrated = required.filter(c => statusValid(c.status));
  const asserted = required.filter(c => c.status !== "UNOBSERVED");
  const failed = required.filter(c => c.status === "NOT_DEMONSTRATED");
  const conflicted = required.filter(c => c.status === "CONFLICTED");

  let demonstratedLevel: CompetencyTier | null = null;
  for (const tier of [1,2,3,4] as const) {
    const upToTier = criteria.filter(c => c.tier <= tier);
    if (upToTier.every(c => statusValid(c.status))) demonstratedLevel = tier;
    else break;
  }

  const state: ValidationState =
    !required.length ? "NOT_REQUIRED"
    : conflicted.length || failed.length ? "CONTRADICTED"
    : demonstrated.length === required.length ? "SUPPORTED"
    : demonstrated.length ? "PARTIALLY_DEMONSTRATED"
    : asserted.length ? "CLAIMED_ONLY"
    : "NO_EVIDENCE";

  return {
    version:EVIDENCE_ESTIMATOR_A3_VERSION,
    rubricVersion:rubric.version,
    skillSlug:rubric.skillSlug,
    targetScore:input.targetScore,
    targetTier,
    demonstratedLevel,
    requiredCriterionCount:required.length,
    demonstratedCriterionCount:demonstrated.length,
    observedCriterionCount:asserted.length,
    failedCriterionCount:failed.length,
    conflictedCriterionCount:conflicted.length,
    demonstratedCoverage:required.length ? round(demonstrated.length/required.length) : 1,
    evidenceCoverage:required.length ? round(asserted.length/required.length) : 1,
    validationState:state,
    criteria
  };
}
