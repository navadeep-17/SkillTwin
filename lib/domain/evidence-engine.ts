import {
  buildSkillDelta,
  effectiveWeight,
  estimateSkill,
  ESTIMATOR_VERSION,
  type EvidenceCandidate,
  type SkillDelta,
  type SkillEvidence,
  type UserSkillState
} from "./skills.js";

export interface EvidenceInsert extends Omit<EvidenceCandidate, "metadata"> {
  polarity: NonNullable<EvidenceCandidate["polarity"]>;
  levelSignal: number | null;
  effectiveWeight: number;
  producerVersion: string;
  estimatorVersion: string;
  metadata: Record<string, unknown>;
}

export interface StoredEvidence extends SkillEvidence {
  sourceRef: string;
  idempotencyKey: string;
  createdAt: string;
}

export interface EvidenceTransaction {
  ensureSkillSnapshots(userId: string, skillIds: string[]): Promise<void>;
  lockSkillSnapshots(userId: string, skillIds: string[]): Promise<Map<string, UserSkillState>>;
  insertEvidence(userId: string, rows: EvidenceInsert[]): Promise<StoredEvidence[]>;
  listEvidence(userId: string, skillIds: string[]): Promise<StoredEvidence[]>;
  saveSkillSnapshot(userId: string, state: UserSkillState, lastEvidenceAt: string | null): Promise<void>;
  appendSkillHistory(userId: string, input: {
    skillId: string;
    triggerType: string;
    triggerRef: string;
    before: UserSkillState | null;
    after: UserSkillState;
    evidenceIds: string[];
    explanation: string;
  }): Promise<void>;
  appendAgentEvent(userId: string, input: {
    eventType: string;
    triggerType: string;
    triggerRef: string;
    summary: string;
    entityRefs: Array<{ type: string; id: string }>;
    evidenceRefs: string[];
    metadata?: Record<string, unknown>;
  }): Promise<void>;
}

export interface EvidenceRepository {
  transaction<T>(work: (tx: EvidenceTransaction) => Promise<T>): Promise<T>;
}

function validate(candidate: EvidenceCandidate): void {
  if (!candidate.skillId) throw new Error("skillId is required");
  if (!candidate.sourceRef.trim()) throw new Error("sourceRef is required");
  if (!candidate.sourceGroupId.trim()) throw new Error("sourceGroupId is required");
  if (!candidate.claim.trim()) throw new Error("claim is required");
  if (!candidate.idempotencyKey.trim()) throw new Error("idempotencyKey is required");
  if (candidate.levelSignal != null && (candidate.levelSignal < 0 || candidate.levelSignal > 4)) {
    throw new Error("levelSignal must be between 0 and 4");
  }
  for (const [name, value] of [["directness", candidate.directness], ["quality", candidate.quality], ["coverage", candidate.coverage]] as const) {
    if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${name} must be between 0 and 1`);
  }
}

function normalize(candidate: EvidenceCandidate, producerVersion: string): EvidenceInsert {
  validate(candidate);
  const asEvidence: SkillEvidence = {
    id: "candidate",
    skillId: candidate.skillId,
    sourceType: candidate.sourceType,
    sourceRef: candidate.sourceRef,
    sourceGroupId: candidate.sourceGroupId,
    levelSignal: candidate.levelSignal ?? null,
    polarity: candidate.polarity ?? "SUPPORTS",
    directness: candidate.directness,
    quality: candidate.quality,
    coverage: candidate.coverage,
    claim: candidate.claim
  };
  return {
    ...candidate,
    levelSignal: candidate.levelSignal ?? null,
    polarity: candidate.polarity ?? "SUPPORTS",
    effectiveWeight: effectiveWeight(asEvidence),
    producerVersion,
    estimatorVersion: ESTIMATOR_VERSION,
    metadata: candidate.metadata ?? {}
  };
}

export class EvidenceEngine {
  constructor(private readonly repository: EvidenceRepository) {}

  async ingestBatch(input: {
    userId: string;
    trigger: { type: string; ref: string };
    candidates: EvidenceCandidate[];
    producerVersion: string;
  }): Promise<{
    acceptedEvidenceIds: string[];
    duplicateCount: number;
    deltas: SkillDelta[];
    downstream: { runGapAnalysis: boolean; considerReplan: boolean };
  }> {
    if (!input.candidates.length) {
      return {
        acceptedEvidenceIds: [],
        duplicateCount: 0,
        deltas: [],
        downstream: { runGapAnalysis: false, considerReplan: false }
      };
    }

    const normalized = input.candidates.map(candidate => normalize(candidate, input.producerVersion));
    const skillIds = [...new Set(normalized.map(candidate => candidate.skillId))].sort();

    return this.repository.transaction(async tx => {
      await tx.ensureSkillSnapshots(input.userId, skillIds);
      const before = await tx.lockSkillSnapshots(input.userId, skillIds);
      const inserted = await tx.insertEvidence(input.userId, normalized);
      const evidence = await tx.listEvidence(input.userId, skillIds);
      const deltas: SkillDelta[] = [];

      for (const skillId of skillIds) {
        const previous = before.get(skillId) ?? null;
        const forSkill = evidence.filter(item => item.skillId === skillId);
        const next = estimateSkill(skillId, forSkill, previous);
        const insertedForSkill = inserted.filter(item => item.skillId === skillId);
        const newestEvidenceAt = forSkill.map(item => item.createdAt).sort().at(-1) ?? null;

        await tx.saveSkillSnapshot(input.userId, next, newestEvidenceAt);
        const delta = buildSkillDelta(previous, next, insertedForSkill.map(item => item.id));
        if (!delta) continue;

        deltas.push(delta);
        await tx.appendSkillHistory(input.userId, {
          skillId,
          triggerType: input.trigger.type,
          triggerRef: input.trigger.ref,
          before: previous,
          after: next,
          evidenceIds: insertedForSkill.map(item => item.id),
          explanation: delta.learnerExplanation
        });
        await tx.appendAgentEvent(input.userId, {
          eventType: "skill.updated",
          triggerType: input.trigger.type,
          triggerRef: input.trigger.ref,
          summary: delta.learnerExplanation,
          entityRefs: [{ type: "skill", id: skillId }],
          evidenceRefs: insertedForSkill.map(item => item.id),
          metadata: { changed: delta.changed }
        });
      }

      return {
        acceptedEvidenceIds: inserted.map(item => item.id),
        duplicateCount: normalized.length - inserted.length,
        deltas,
        downstream: {
          runGapAnalysis: deltas.length > 0,
          considerReplan: deltas.some(delta =>
            delta.changed.includes("LEVEL")
            || delta.changed.includes("VALIDATION")
            || delta.changed.includes("CONFLICT")
          )
        }
      };
    });
  }
}
