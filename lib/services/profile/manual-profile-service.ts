import "server-only";
import { getSql } from "@/lib/db/postgres";
import { getEvidenceEngine } from "@/lib/services/skills/evidence-service";
import { getGapAnalysisService } from "@/lib/services/gaps/gap-analysis-service";
import { getInitialPlanService } from "@/lib/services/planner/initial-plan-service";
import { getAdaptiveReplannerService } from "@/lib/services/replanner/adaptive-replanner-service";
import { PostgresProfileAnalysisRepository } from "@/lib/repositories/postgres/profile-analysis-repository";
import { extractMappedSkills } from "@/lib/profile/skill-mapper";
import { extractSemanticSkillEvidence, mergeProfileExtractions } from "@/lib/profile/semantic-extractor";
import type { ProfileSourceBlock } from "@/lib/profile/segmenter";

export const MANUAL_PROFILE_ANALYZER_VERSION = "manual-profile-b1";

type Row = Record<string, unknown>;
const rows = (value: unknown) => value as Row[];

export class ManualProfileService {
  private readonly repository = new PostgresProfileAnalysisRepository();

  async createAndAnalyze(input: { userId: string; title: string; text: string }) {
    const sql = getSql();
    const source = rows(await sql.unsafe(
      "insert into public.profile_manual_sources(user_id,title,text_content,version,status) values ($1::uuid,$2,$3,1,'ACTIVE') returning *",
      [input.userId,input.title,input.text]
    ))[0];
    const sourceId = String(source.id);
    const version = Number(source.version ?? 1);

    const block: ProfileSourceBlock = {
      id: "manual:" + sourceId + ":v" + version + ":b0",
      sourceId,
      kind: "other",
      title: input.title,
      text: input.text,
      pageStart: null,
      pageEnd: null,
      ordinal: 0
    };

    try {
      const catalog = await this.repository.listCatalog();
      const deterministic = extractMappedSkills({
        blocks: [block],
        catalog,
        documentId: sourceId,
        documentVersion: version
      });

      let semantic = null;
      try {
        semantic = await extractSemanticSkillEvidence({
          blocks: [block],
          catalog,
          documentId: sourceId,
          documentVersion: version
        });
      } catch {
        semantic = null;
      }

      const extraction = mergeProfileExtractions(deterministic, semantic);
      const candidates = extraction.evidence.map(candidate => ({
        ...candidate,
        sourceType: "MANUAL_SELF_REPORT" as const,
        sourceGroupId: candidate.sourceGroupId.replace(/^resume:/, "manual:"),
        idempotencyKey: candidate.idempotencyKey.replace(/^resume(-ai)?:/, "manual:"),
        metadata: {
          ...(candidate.metadata ?? {}),
          sourceKind: "manual_self_report",
          analyzerVersion: MANUAL_PROFILE_ANALYZER_VERSION
        }
      }));

      const evidence = await getEvidenceEngine().ingestBatch({
        userId: input.userId,
        trigger: { type: "MANUAL_PROFILE", ref: sourceId },
        candidates,
        producerVersion: MANUAL_PROFILE_ANALYZER_VERSION
      });

      const gap = await getGapAnalysisService().recompute(input.userId, {
        type: evidence.downstream.runGapAnalysis ? "SKILL_DELTA" : "MANUAL_PROFILE",
        ref: sourceId
      });

      let plan: unknown = null;
      let replan: unknown = null;
      const activePlan = rows(await sql.unsafe(
        "select id,version from public.learning_plans where user_id=$1::uuid and goal_id=$2::uuid and status='ACTIVE' order by version desc limit 1",
        [input.userId, String(gap.goal.id)]
      ))[0];

      try {
        if (activePlan && evidence.deltas.length) {
          replan = await getAdaptiveReplannerService().considerEvidenceSignal({
            userId: input.userId,
            triggerType: "SKILL_DELTA_COMMITTED",
            triggerRef: sourceId,
            skillIds: evidence.deltas.map(delta => delta.skillId),
            evidenceIds: evidence.acceptedEvidenceIds,
            gapSnapshotId: gap.snapshotId
          });
          plan = {
            planId: String(activePlan.id),
            version: Number(activePlan.version),
            reused: true,
            reason: "ACTIVE_PLAN_REEVALUATED_FROM_PROFILE_EVIDENCE"
          };
        } else if (activePlan) {
          plan = {
            planId: String(activePlan.id),
            version: Number(activePlan.version),
            reused: true,
            reason: "ACTIVE_PLAN_UNCHANGED"
          };
        } else {
          plan = await getInitialPlanService().generate(input.userId);
        }
      } catch {
        plan = activePlan
          ? {
              planId: String(activePlan.id),
              version: Number(activePlan.version),
              reused: true,
              reason: "ACTIVE_PLAN_UPDATE_FAILED"
            }
          : null;
      }

      const result = {
        sourceId,
        claims: extraction.claims.length,
        evidence,
        gapAnalysis: gap
          ? {
              snapshotId: gap.snapshotId,
              readiness: gap.readiness,
              evidenceCoverage: gap.evidenceCoverage
            }
          : null,
        plan,
        replan,
        unresolvedTerms: extraction.unresolvedTerms ?? []
      };

      await sql.begin(async tx => {
        await tx.unsafe(
          "update public.profile_manual_sources set analysis_result=$1::jsonb,updated_at=now() where id=$2::uuid and user_id=$3::uuid",
          [JSON.stringify(result),sourceId,input.userId]
        );
        await tx.unsafe(
          "insert into public.agent_events(user_id,event_type,trigger_type,trigger_ref,summary,entity_refs,evidence_refs,metadata) values ($1::uuid,'profile.manual.processed','MANUAL_PROFILE',$2,$3,$4::jsonb,$5::jsonb,$6::jsonb)",
          [
            input.userId,
            sourceId,
            "Processed manual profile evidence across " + extraction.claims.length + " mapped skill claims.",
            JSON.stringify([{ type: "profile_manual_source", id: sourceId }]),
            JSON.stringify(evidence.acceptedEvidenceIds),
            JSON.stringify({
              claims: extraction.claims.length,
              unresolvedTerms: extraction.unresolvedTerms?.length ?? 0,
              analyzerVersion: MANUAL_PROFILE_ANALYZER_VERSION
            })
          ]
        );
      });

      return result;
    } catch (error) {
      await sql.unsafe(
        "update public.profile_manual_sources set status='INACTIVE',analysis_result=$1::jsonb,updated_at=now() where id=$2::uuid and user_id=$3::uuid",
        [
          JSON.stringify({ error: error instanceof Error ? error.message.slice(0, 600) : String(error).slice(0, 600) }),
          sourceId,
          input.userId
        ]
      );
      throw error;
    }
  }
}

let service: ManualProfileService | null = null;

export function getManualProfileService() {
  if (!service) service = new ManualProfileService();
  return service;
}
