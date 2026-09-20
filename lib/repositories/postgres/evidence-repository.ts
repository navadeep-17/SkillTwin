import "server-only";
import { getSql } from "@/lib/db/postgres";
import {
  ESTIMATOR_VERSION,
  type ConfidenceBand,
  type ConflictState,
  type EvidenceStatus,
  type SkillLevel,
  type UserSkillState
} from "@/lib/domain/skills";
import type {
  EvidenceInsert,
  EvidenceRepository,
  EvidenceTransaction,
  StoredEvidence
} from "@/lib/domain/evidence-engine";

function band(confidence: number): ConfidenceBand {
  if (confidence < 0.45) return "LOW";
  if (confidence < 0.75) return "MEDIUM";
  return "HIGH";
}

function skillState(row: Record<string, unknown>): UserSkillState {
  const confidence = Number(row.confidence ?? 0.1);
  return {
    skillId: String(row.skill_id),
    capabilityScore: row.capability_score == null ? null : Number(row.capability_score),
    level: String(row.level_value) as SkillLevel,
    confidence,
    confidenceBand: band(confidence),
    conflictState: String(row.conflict_state ?? "NONE") as ConflictState,
    evidenceCount: Number(row.evidence_count ?? 0),
    sourceFamilyCount: Number(row.source_family_count ?? 0),
    lastValidatedAt: row.last_validated_at ? new Date(String(row.last_validated_at)).toISOString() : null,
    estimatorVersion: String(row.estimator_version ?? ESTIMATOR_VERSION)
  };
}

function storedEvidence(row: Record<string, unknown>): StoredEvidence {
  return {
    id: String(row.id),
    skillId: String(row.skill_id),
    sourceType: String(row.source_type) as StoredEvidence["sourceType"],
    sourceRef: String(row.source_ref),
    sourceGroupId: String(row.source_group_id),
    claim: String(row.claim),
    levelSignal: row.level_signal == null ? null : Number(row.level_signal),
    polarity: String(row.polarity ?? "SUPPORTS") as StoredEvidence["polarity"],
    directness: Number(row.directness),
    quality: Number(row.quality),
    coverage: Number(row.coverage),
    status: String(row.status) as EvidenceStatus,
    idempotencyKey: String(row.idempotency_key),
    createdAt: new Date(String(row.created_at)).toISOString()
  };
}

export class PostgresEvidenceRepository implements EvidenceRepository {
  async transaction<T>(work: (tx: EvidenceTransaction) => Promise<T>): Promise<T> {
    const sql = getSql();

    return (await sql.begin(async transaction => {
      const adapter: EvidenceTransaction = {
        ensureSkillSnapshots: async (userId, skillIds) => {
          for (const skillId of skillIds) {
            await transaction`
              insert into public.user_skills(user_id, skill_id)
              values (${userId}::uuid, ${skillId}::uuid)
              on conflict (user_id, skill_id) do nothing
            `;
          }
        },

        lockSkillSnapshots: async (userId, skillIds) => {
          if (!skillIds.length) return new Map();
          const rows = await transaction<Record<string, unknown>[]>`
            select *
            from public.user_skills
            where user_id = ${userId}::uuid
              and skill_id in ${transaction(skillIds)}
            order by skill_id
            for update
          `;
          return new Map(rows.map(row => [String(row.skill_id), skillState(row)]));
        },

        insertEvidence: async (userId, rows: EvidenceInsert[]) => {
          const inserted: StoredEvidence[] = [];
          for (const row of rows) {
            const result = await transaction<Record<string, unknown>[]>`
              insert into public.skill_evidence(
                user_id, skill_id, source_type, source_ref, source_group_id, claim,
                level_signal, polarity, directness, quality, coverage, effective_weight,
                idempotency_key, producer_version, estimator_version, metadata
              ) values (
                ${userId}::uuid, ${row.skillId}::uuid, ${row.sourceType}, ${row.sourceRef},
                ${row.sourceGroupId}, ${row.claim}, ${row.levelSignal}, ${row.polarity},
                ${row.directness}, ${row.quality}, ${row.coverage}, ${row.effectiveWeight},
                ${row.idempotencyKey}, ${row.producerVersion}, ${row.estimatorVersion},
                ${JSON.stringify(row.metadata)}::jsonb
              )
              on conflict (user_id, idempotency_key) do nothing
              returning *
            `;
            if (result[0]) inserted.push(storedEvidence(result[0]));
          }
          return inserted;
        },

        listEvidence: async (userId, skillIds) => {
          if (!skillIds.length) return [];
          const rows = await transaction<Record<string, unknown>[]>`
            select *
            from public.skill_evidence
            where user_id = ${userId}::uuid
              and skill_id in ${transaction(skillIds)}
              and status in ('ACCEPTED','NON_AGGREGATING')
            order by created_at asc, id asc
          `;
          return rows.map(storedEvidence);
        },

        saveSkillSnapshot: async (userId, state, lastEvidenceAt) => {
          await transaction`
            update public.user_skills
            set level_value = ${state.level},
                capability_score = ${state.capabilityScore},
                confidence = ${state.confidence},
                conflict_state = ${state.conflictState},
                last_evidence_at = ${lastEvidenceAt},
                last_validated_at = ${state.lastValidatedAt},
                evidence_count = ${state.evidenceCount},
                source_family_count = ${state.sourceFamilyCount},
                estimator_version = ${state.estimatorVersion},
                updated_at = now()
            where user_id = ${userId}::uuid
              and skill_id = ${state.skillId}::uuid
          `;
        },

        appendSkillHistory: async (userId, history) => {
          await transaction`
            insert into public.skill_history(
              user_id, skill_id, trigger_type, trigger_ref,
              before_state, after_state, evidence_ids, estimator_version, explanation
            ) values (
              ${userId}::uuid, ${history.skillId}::uuid, ${history.triggerType}, ${history.triggerRef},
              ${history.before ? JSON.stringify(history.before) : null}::jsonb,
              ${JSON.stringify(history.after)}::jsonb,
              ${JSON.stringify(history.evidenceIds)}::jsonb,
              ${ESTIMATOR_VERSION}, ${history.explanation}
            )
          `;
        },

        appendAgentEvent: async (userId, event) => {
          await transaction`
            insert into public.agent_events(
              user_id, event_type, trigger_type, trigger_ref,
              summary, entity_refs, evidence_refs, metadata
            ) values (
              ${userId}::uuid, ${event.eventType}, ${event.triggerType}, ${event.triggerRef},
              ${event.summary}, ${JSON.stringify(event.entityRefs)}::jsonb,
              ${JSON.stringify(event.evidenceRefs)}::jsonb,
              ${JSON.stringify(event.metadata ?? {})}::jsonb
            )
          `;
        }
      };

      return work(adapter);
    })) as T;
  }
}
