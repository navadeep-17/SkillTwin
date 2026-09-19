export type SkillLevel = "UNKNOWN" | "NONE" | "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT";
export type ConfidenceBand = "LOW" | "MEDIUM" | "HIGH";
export type ConflictState = "NONE" | "RESOLVED" | "UNRESOLVED";
export type EvidencePolarity = "SUPPORTS" | "CONTRADICTS" | "NEUTRAL";
export type EvidenceStatus = "ACCEPTED" | "REJECTED" | "SUPERSEDED" | "NON_AGGREGATING";

export type EvidenceSource =
  | "MANUAL_SELF_REPORT"
  | "RESUME_SKILL_MENTION"
  | "RESUME_PROJECT_DETAIL"
  | "LEARNING_TASK_COMPLETED"
  | "PRACTICE_EVALUATED"
  | "ASSESSMENT_QUESTION"
  | "ASSESSMENT_SUMMARY"
  | "PROJECT_DESCRIPTION"
  | "PROJECT_ARTIFACT_VERIFIED";

export interface SkillEvidence {
  id: string;
  skillId: string;
  sourceType: EvidenceSource;
  sourceRef?: string;
  sourceGroupId: string;
  levelSignal: number | null;
  polarity?: EvidencePolarity;
  directness: number;
  quality: number;
  coverage: number;
  claim: string;
  status?: EvidenceStatus;
  createdAt?: string;
  idempotencyKey?: string;
}

export interface EvidenceCandidate {
  skillId: string;
  sourceType: EvidenceSource;
  sourceRef: string;
  sourceGroupId: string;
  claim: string;
  levelSignal?: number | null;
  polarity?: EvidencePolarity;
  directness: number;
  quality: number;
  coverage: number;
  metadata?: Record<string, unknown>;
  idempotencyKey: string;
}

export interface UserSkillState {
  skillId: string;
  capabilityScore: number | null;
  level: SkillLevel;
  confidence: number;
  confidenceBand: ConfidenceBand;
  conflictState: ConflictState;
  evidenceCount: number;
  sourceFamilyCount: number;
  lastValidatedAt: string | null;
  estimatorVersion: string;
}

export interface SkillDelta {
  skillId: string;
  before: UserSkillState | null;
  after: UserSkillState;
  changed: Array<"LEVEL" | "SCORE" | "CONFIDENCE" | "CONFLICT" | "VALIDATION">;
  evidenceIds: string[];
  learnerExplanation: string;
}

export const ESTIMATOR_VERSION = "skill-estimator-a1";

const BASELINE: Record<EvidenceSource, number> = {
  MANUAL_SELF_REPORT: 0.20,
  RESUME_SKILL_MENTION: 0.25,
  RESUME_PROJECT_DETAIL: 0.45,
  LEARNING_TASK_COMPLETED: 0.35,
  PRACTICE_EVALUATED: 0.55,
  ASSESSMENT_QUESTION: 0.65,
  ASSESSMENT_SUMMARY: 0.85,
  PROJECT_DESCRIPTION: 0.60,
  PROJECT_ARTIFACT_VERIFIED: 0.70
};

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));

export function effectiveWeight(evidence: SkillEvidence): number {
  return BASELINE[evidence.sourceType]
    * clamp(evidence.directness)
    * clamp(evidence.quality)
    * clamp(evidence.coverage);
}

export function scoreToLevel(score: number | null): SkillLevel {
  if (score === null) return "UNKNOWN";
  if (score < 0.5) return "NONE";
  if (score < 1.5) return "BEGINNER";
  if (score < 2.5) return "INTERMEDIATE";
  if (score < 3.5) return "ADVANCED";
  return "EXPERT";
}

function confidenceBand(confidence: number): ConfidenceBand {
  if (confidence < 0.45) return "LOW";
  if (confidence < 0.75) return "MEDIUM";
  return "HIGH";
}

function sourceFamily(source: EvidenceSource): string {
  if (source.startsWith("RESUME")) return "RESUME";
  if (source.startsWith("ASSESSMENT") || source === "PRACTICE_EVALUATED") return "VALIDATION";
  if (source.startsWith("PROJECT")) return "PROJECT";
  if (source.startsWith("LEARNING")) return "LEARNING";
  return "MANUAL";
}

function representatives(evidence: SkillEvidence[]): SkillEvidence[] {
  const accepted = evidence.filter(item =>
    item.status !== "REJECTED"
    && item.status !== "SUPERSEDED"
    && item.status !== "NON_AGGREGATING"
    && item.levelSignal !== null
    && item.directness >= 0.4
  );

  const summaryGroups = new Set(
    accepted.filter(item => item.sourceType === "ASSESSMENT_SUMMARY").map(item => item.sourceGroupId)
  );

  const byGroup = new Map<string, SkillEvidence>();
  for (const item of accepted) {
    if (item.sourceType === "ASSESSMENT_QUESTION" && summaryGroups.has(item.sourceGroupId)) continue;
    const current = byGroup.get(item.sourceGroupId);
    if (!current || effectiveWeight(item) > effectiveWeight(current)) byGroup.set(item.sourceGroupId, item);
  }
  return [...byGroup.values()];
}

function detectConflict(evidence: SkillEvidence[]): ConflictState {
  const strong = evidence
    .map(item => ({ item, weight: effectiveWeight(item) }))
    .filter(row => row.item.levelSignal !== null && row.weight >= 0.45);

  for (let i = 0; i < strong.length; i++) {
    for (let j = i + 1; j < strong.length; j++) {
      const left = strong[i];
      const right = strong[j];
      if (left.item.sourceGroupId === right.item.sourceGroupId) continue;
      if (Math.abs((left.item.levelSignal ?? 0) - (right.item.levelSignal ?? 0)) < 1.5) continue;
      const reliabilityDelta = Math.abs(BASELINE[left.item.sourceType] - BASELINE[right.item.sourceType]);
      return reliabilityDelta >= 0.25 ? "RESOLVED" : "UNRESOLVED";
    }
  }
  return "NONE";
}

function applyHysteresis(score: number, previous: UserSkillState | null | undefined, directValidation: boolean): SkillLevel {
  const raw = scoreToLevel(score);
  if (!previous || previous.level === "UNKNOWN" || directValidation || previous.level === raw) return raw;

  const levels: SkillLevel[] = ["NONE", "BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"];
  const previousIndex = levels.indexOf(previous.level);
  const rawIndex = levels.indexOf(raw);
  if (previousIndex < 0 || rawIndex < 0 || Math.abs(previousIndex - rawIndex) !== 1) return raw;

  const boundaries = [0.5, 1.5, 2.5, 3.5];
  if (rawIndex > previousIndex) return score >= (boundaries[previousIndex] ?? 4) + 0.1 ? raw : previous.level;
  return score <= (boundaries[rawIndex] ?? 0) - 0.1 ? raw : previous.level;
}

export function estimateSkill(
  skillId: string,
  evidence: SkillEvidence[],
  previous?: UserSkillState | null
): UserSkillState {
  const all = evidence.filter(item =>
    item.skillId === skillId && item.status !== "REJECTED" && item.status !== "SUPERSEDED"
  );
  const rows = representatives(all);
  const totalWeight = rows.reduce((sum, item) => sum + effectiveWeight(item), 0);
  const families = new Set(rows.map(item => sourceFamily(item.sourceType))).size;

  if (totalWeight < 0.2) {
    return {
      skillId,
      capabilityScore: null,
      level: "UNKNOWN",
      confidence: 0.1,
      confidenceBand: "LOW",
      conflictState: "NONE",
      evidenceCount: all.length,
      sourceFamilyCount: families,
      lastValidatedAt: previous?.lastValidatedAt ?? null,
      estimatorVersion: ESTIMATOR_VERSION
    };
  }

  const score = clamp(
    rows.reduce((sum, item) => sum + effectiveWeight(item) * (item.levelSignal ?? 0), 0) / totalWeight,
    0,
    4
  );
  const variance = rows.reduce(
    (sum, item) => sum + effectiveWeight(item) * Math.pow((item.levelSignal ?? 0) - score, 2),
    0
  ) / totalWeight;
  const consistency = 1 - Math.min(Math.sqrt(variance) / 1.5, 1);
  const coverage = rows.reduce((sum, item) => sum + effectiveWeight(item) * item.coverage, 0) / totalWeight;
  const validations = rows.filter(item =>
    (item.sourceType === "ASSESSMENT_SUMMARY" || item.sourceType === "PROJECT_ARTIFACT_VERIFIED")
    && effectiveWeight(item) >= 0.45
  );
  const conflictState = detectConflict(rows);

  let confidence = clamp(
    0.10
      + 0.40 * Math.min(totalWeight / 1.5, 1)
      + 0.20 * Math.min(families / 3, 1)
      + 0.15 * consistency
      + 0.10 * coverage
      + 0.05 * (validations.length ? 1 : 0),
    0.10,
    0.95
  );
  if (conflictState === "UNRESOLVED") confidence = Math.min(confidence, 0.65);

  const directValidation = validations.some(item => item.quality >= 0.8 && item.coverage >= 0.6);
  const newestValidation = validations
    .map(item => item.createdAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);

  return {
    skillId,
    capabilityScore: Number(score.toFixed(3)),
    level: applyHysteresis(score, previous, directValidation),
    confidence: Number(confidence.toFixed(3)),
    confidenceBand: confidenceBand(confidence),
    conflictState,
    evidenceCount: all.length,
    sourceFamilyCount: families,
    lastValidatedAt: newestValidation ?? previous?.lastValidatedAt ?? null,
    estimatorVersion: ESTIMATOR_VERSION
  };
}

export function buildSkillDelta(
  before: UserSkillState | null,
  after: UserSkillState,
  evidenceIds: string[]
): SkillDelta | null {
  const changed: SkillDelta["changed"] = [];
  if (!before || before.level !== after.level) changed.push("LEVEL");
  if (!before || before.capabilityScore === null || after.capabilityScore === null
    ? before?.capabilityScore !== after.capabilityScore
    : Math.abs(before.capabilityScore - after.capabilityScore) >= 0.1) changed.push("SCORE");
  if (!before || Math.abs(before.confidence - after.confidence) >= 0.05) changed.push("CONFIDENCE");
  if (!before || before.conflictState !== after.conflictState) changed.push("CONFLICT");
  if (!before || before.lastValidatedAt !== after.lastValidatedAt) changed.push("VALIDATION");
  if (!changed.length) return null;

  const beforeLevel = before?.level ?? "UNKNOWN";
  return {
    skillId: after.skillId,
    before,
    after,
    changed,
    evidenceIds,
    learnerExplanation: `Skill estimate changed from ${beforeLevel} to ${after.level}. Confidence is now ${Math.round(after.confidence * 100)}%.`
  };
}
