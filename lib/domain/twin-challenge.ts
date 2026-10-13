/**
 * Pure presentation logic for learner-challengeable skill estimates.
 * No score fabrication, proficiency write, assessment grading or plan change.
 */
export type TwinEvidence = {
  source_type: string;
  claim: string;
  status: string;
  created_at: string;
};
export type TwinSnapshot = {
  level_value: string;
  capability_score: number | null;
  confidence: number | null;
  conflict_state: string;
  evidence_count: number;
  last_validated_at: string | null;
};
export type TwinProofOutcome = {
  assessment_id: string;
  skill_id: string;
  normalized_score: number | null;
  coverage: number | null;
  created_at: string;
};
export type TwinHistory = {
  skill_id: string;
  trigger_ref: string;
  before_state: unknown;
  after_state: unknown;
  explanation: string | null;
};
export type TwinReplanDecision = {
  trigger_ref: string;
  decision: string;
  reason_code: string | null;
  reason: string | null;
};
export type TwinPlanDiff = {
  id: string;
  trigger_refs: unknown;
  status: string;
  summary: string | null;
};

export function normalizedConfidence(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.round(Math.max(0,Math.min(1,value))*100);
}

export function challengeAvailability(questionCount: number, activeAssessmentId?: string | null):
  "RESUME" | "READY" | "NO_VALIDATED_BANK" {
  if (activeAssessmentId) return "RESUME";
  return Number.isFinite(questionCount) && questionCount >= 4 ? "READY" : "NO_VALIDATED_BANK";
}

export function evidenceReliabilityLabel(source: string): string {
  const names: Record<string,string> = {
    MANUAL_SELF_REPORT:"Self-report",
    RESUME_SKILL_MENTION:"Resume mention",
    RESUME_PROJECT_DETAIL:"Resume project",
    PROJECT_DESCRIPTION:"Project description",
    PROJECT_ARTIFACT_VERIFIED:"Reviewed project artifact",
    LEARNING_TASK_COMPLETED:"Learning activity",
    PRACTICE_EVALUATED:"Evaluated practice",
    ASSESSMENT_SUMMARY:"Completed assessment",
    ASSESSMENT_QUESTION:"Assessment item"
  };
  return names[source] ?? "Other evidence";
}

type ChangeState = {
  level: string | null;
  confidencePercent: number | null;
  capability: number | null;
};
function parseState(raw: unknown): ChangeState {
  // Older evidence-history writes can serialize their JSON object *inside*
  // a JSONB string. Decode a bounded number of layers without guessing
  // missing data or ever executing the stored value.
  let value=raw;
  for(let depth=0;depth<2 && typeof value==="string";depth++) {
    try { value=JSON.parse(value); }
    catch { break; }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { level:null,confidencePercent:null,capability:null };
  }
  const object = value as Record<string,unknown>;
  const score = object.capabilityScore ?? object.capability_score;
  const confidence = object.confidence;
  return {
    level: typeof object.level === "string" ? object.level : typeof object.level_value === "string" ? object.level_value : null,
    confidencePercent: typeof confidence === "number" ? normalizedConfidence(confidence) : null,
    capability: typeof score === "number" && Number.isFinite(score) ? score : null
  };
}

/** Match an exact UUID/string reference in structured trigger refs; never substring-match. */
export function containsExactReference(value: unknown, reference: string): boolean {
  if (typeof value === "string") return value === reference;
  if (Array.isArray(value)) return value.some(item=>containsExactReference(item,reference));
  if (value && typeof value === "object") {
    return Object.values(value as Record<string,unknown>)
      .some(item=>containsExactReference(item,reference));
  }
  return false;
}

export type TwinProofTrail = {
  assessmentId: string;
  scorePercent: number | null;
  coveragePercent: number | null;
  before: ChangeState | null;
  after: ChangeState | null;
  skillExplanation: string | null;
  planStatus: "CHANGED" | "UNCHANGED" | "NOT_RECORDED";
  planReason: string;
  planDiffId: string | null;
};

export function buildTwinProofTrail(
  outcome: TwinProofOutcome | null,
  history: TwinHistory[],
  decisions: TwinReplanDecision[],
  diffs: TwinPlanDiff[]
): TwinProofTrail | null {
  if (!outcome) return null;
  const matchingHistory = history.find(row =>
    row.skill_id === outcome.skill_id && row.trigger_ref === outcome.assessment_id
  );
  const decision = decisions.find(row => row.trigger_ref === outcome.assessment_id);
  const diff = diffs.find(row => row.status === "APPLIED" && containsExactReference(row.trigger_refs,outcome.assessment_id));
  const planStatus = diff ? "CHANGED" : decision?.decision === "NO_OP" ? "UNCHANGED" : "NOT_RECORDED";
  return {
    assessmentId:outcome.assessment_id,
    scorePercent:normalizedConfidence(outcome.normalized_score),
    coveragePercent:normalizedConfidence(outcome.coverage),
    before:matchingHistory ? parseState(matchingHistory.before_state) : null,
    after:matchingHistory ? parseState(matchingHistory.after_state) : null,
    skillExplanation:matchingHistory?.explanation ?? null,
    planStatus,
    planReason:diff
      ? (diff.summary?.trim() || "A recorded roadmap revision is available for this assessment.")
      : decision?.decision === "NO_OP"
        ? (decision.reason?.trim() || "No safe future learning tasks needed a change.")
        : "No matching roadmap decision has been recorded for this assessment.",
    planDiffId:diff?.id ?? null
  };
}
