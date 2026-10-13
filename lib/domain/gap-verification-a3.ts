import type { GapAnalysis, GapResult } from "./gap-engine.js";
import { getCompetencyRubric } from "./competency-rubrics-a3.js";
import { assessSkillCompetencies, type CompetencyObservation, type CompetencyAssessment, type ValidationState } from "./evidence-estimator-a3.js";

export const GAP_VERIFICATION_A3_VERSION = "gap-verification-a3-pilot1";
export type VerificationStatus = ValidationState | "RUBRIC_NOT_AVAILABLE";

export interface VerifiedGapProjection {
  requirementId: string;
  skillId: string;
  skillSlug: string | null;
  originalStatus: GapResult["status"];
  displayStatus: GapResult["status"] | "NEEDS_VALIDATION";
  originalAction: GapResult["recommendedAction"];
  recommendedAction: GapResult["recommendedAction"];
  verificationStatus: VerificationStatus;
  missingCriteria: Array<{id:string;description:string}>;
  failedCriteria: Array<{id:string;description:string}>;
  demonstratedCoverage: number | null;
  claimCoverage: number | null;
  evidenceIds: string[];
  reasonCodes: string[];
}

export interface GapVerificationProjection {
  version: typeof GAP_VERIFICATION_A3_VERSION;
  roleVersionId: string;
  originalReadiness: number; // Preserved A1 metric, not a new A3 probability.
  results: VerifiedGapProjection[];
}

/**
 * Read-only verification overlay. Does NOT modify role model weights, persist
 * gap snapshots, or rewrite existing user skill history and readiness.
 */
export function addCompetencyVerification(input: {
  gapAnalysis: GapAnalysis;
  skillSlugsById: Readonly<Record<string,string>>;
  observationsBySkillId: Readonly<Record<string,readonly CompetencyObservation[]>>;
}): GapVerificationProjection {
  const results = input.gapAnalysis.gaps.map(gap => {
    const slug = input.skillSlugsById[gap.skillId] ?? null;
    const rubric = slug ? getCompetencyRubric(slug) : null;
    if (!rubric) {
      return {
        requirementId:gap.requirementId,
        skillId:gap.skillId,
        skillSlug:slug,
        originalStatus:gap.status,
        displayStatus:gap.status,
        originalAction:gap.recommendedAction,
        recommendedAction:gap.recommendedAction,
        verificationStatus:"RUBRIC_NOT_AVAILABLE" as const,
        missingCriteria:[],
        failedCriteria:[],
        demonstratedCoverage:null,
        claimCoverage:null,
        evidenceIds:[],
        reasonCodes:[...gap.reasonCodes,"RUBRIC_NOT_DEFINED"]
      };
    }

    const assessment:CompetencyAssessment=assessSkillCompetencies({
      skillSlug:slug!,
      targetScore:gap.targetScore,
      observations:input.observationsBySkillId[gap.skillId] ?? []
    });
    const isSupported=assessment.validationState==="SUPPORTED"
      || assessment.validationState==="NOT_REQUIRED";
    const isFailed=assessment.validationState==="CONTRADICTED";
    const displayStatus=isSupported ? gap.status
      : gap.status==="STRONG" ? "NEEDS_VALIDATION" as const : gap.status;
    const recommendedAction: GapResult["recommendedAction"] =
      isSupported ? gap.recommendedAction
      : isFailed ? "LEARN"
      : gap.status==="STRONG" || assessment.validationState==="CLAIMED_ONLY" || assessment.validationState==="NO_EVIDENCE"
        ? "VALIDATE_FIRST"
        : gap.recommendedAction;

    const relevant=assessment.criteria.filter(c => c.tier <= assessment.targetTier);
    const missingCriteria=relevant
      .filter(c => c.status==="UNOBSERVED" || c.status==="CLAIMED" || c.status==="DISPUTED_CLAIM")
      .map(c => ({id:c.id,description:c.description}));
    const failedCriteria=relevant
      .filter(c => c.status==="NOT_DEMONSTRATED" || c.status==="CONFLICTED")
      .map(c => ({id:c.id,description:c.description}));
    const evidenceIds=[...new Set(relevant.flatMap(c => [...c.supportingEvidenceIds,...c.contradictingEvidenceIds]))].sort();
    const reasonCodes=[...gap.reasonCodes];
    if (!isSupported) reasonCodes.push("COMPETENCY_VERIFICATION_INCOMPLETE");
    if (gap.status==="STRONG" && !isSupported) reasonCodes.push("NUMERICALLY_STRONG_BUT_UNVERIFIED");
    if (assessment.validationState==="CLAIMED_ONLY") reasonCodes.push("ONLY_SELF_REPORTED_COMPETENCIES");
    if (isFailed) reasonCodes.push("CONTRADICTING_EVALUATED_EVIDENCE");

    return {
      requirementId:gap.requirementId,
      skillId:gap.skillId,
      skillSlug:slug,
      originalStatus:gap.status,
      displayStatus,
      originalAction:gap.recommendedAction,
      recommendedAction,
      verificationStatus:assessment.validationState,
      missingCriteria,
      failedCriteria,
      demonstratedCoverage:assessment.demonstratedCoverage,
      claimCoverage:assessment.evidenceCoverage,
      evidenceIds,
      reasonCodes
    };
  });
  return {
    version:GAP_VERIFICATION_A3_VERSION,
    roleVersionId:input.gapAnalysis.roleVersionId,
    originalReadiness:input.gapAnalysis.readiness,
    results
  };
}
