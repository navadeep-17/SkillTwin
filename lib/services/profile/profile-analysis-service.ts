import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getEvidenceEngine } from "@/lib/services/skills/evidence-service";
import { getGapAnalysisService } from "@/lib/services/gaps/gap-analysis-service";
import { getInitialPlanService } from "@/lib/services/planner/initial-plan-service";
import { PostgresProfileAnalysisRepository } from "@/lib/repositories/postgres/profile-analysis-repository";
import { parsePdf } from "@/lib/profile/pdf-parser";
import { segmentResume } from "@/lib/profile/segmenter";
import { extractMappedSkills } from "@/lib/profile/skill-mapper";

export const PROFILE_ANALYZER_SCHEMA_VERSION = "profile-analyzer-b1";

export class ProfileAnalysisService {
  constructor(private readonly repository = new PostgresProfileAnalysisRepository()) {}

  async analyzeResume(input: { userId: string; documentId: string; supabase: SupabaseClient }) {
    const document = await this.repository.getDocument(input.userId, input.documentId);
    if (!document) throw new Error("PROFILE_DOCUMENT_NOT_FOUND");

    const run = await this.repository.getOrCreateRun(
      input.userId,
      document,
      PROFILE_ANALYZER_SCHEMA_VERSION
    );
    const runId = String(run.id);

    if (String(run.status) === "complete" && run.evidence_batch_result) {
      return { runId, reused: true, result: run.evidence_batch_result };
    }

    await this.repository.startRun(input.userId, runId);

    try {
      const { data: blob, error: downloadError } = await input.supabase.storage
        .from("profile-documents")
        .download(document.storagePath);

      if (downloadError || !blob) {
        throw new Error("PROFILE_DOWNLOAD_FAILED:" + (downloadError?.message ?? "missing blob"));
      }

      const parsed = await parsePdf(new Uint8Array(await blob.arrayBuffer()));
      await this.repository.saveParse(input.userId, document, parsed);

      const warnings: string[] = [];
      if (parsed.quality.needsOcr) warnings.push("LOW_TEXT_EXTRACTION");
      if (parsed.quality.needsOcr && parsed.quality.charCount < 120) {
        throw new Error("TEXT_EXTRACTION_TOO_LOW");
      }

      await this.repository.setStage(input.userId, runId, "segmenting", 35);
      const blocks = segmentResume({
        documentId: document.id,
        documentVersion: document.version,
        pages: parsed.pages
      });

      await this.repository.setStage(
        input.userId,
        runId,
        "mapping",
        55,
        { pages: parsed.quality.pageCount, blocks: blocks.length },
        warnings
      );

      const catalog = await this.repository.listCatalog();
      const extraction = extractMappedSkills({
        blocks,
        catalog,
        documentId: document.id,
        documentVersion: document.version
      });

      await this.repository.replaceBlocksAndClaims({
        userId: input.userId,
        runId,
        sourceId: document.id,
        blocks,
        claims: extraction.claims
      });

      await this.repository.setStage(
        input.userId,
        runId,
        "evidence",
        75,
        {
          pages: parsed.quality.pageCount,
          blocks: blocks.length,
          mappedClaims: extraction.claims.length,
          evidenceCandidates: extraction.evidence.length
        },
        warnings
      );

      const evidenceResult = await getEvidenceEngine().ingestBatch({
        userId: input.userId,
        trigger: { type: "PROFILE_ANALYSIS", ref: runId },
        candidates: extraction.evidence,
        producerVersion: PROFILE_ANALYZER_SCHEMA_VERSION
      });

      const gapResult = evidenceResult.downstream.runGapAnalysis
        ? await getGapAnalysisService().recompute(
            input.userId,
            { type: "SKILL_DELTA", ref: runId }
          )
        : null;

      let planResult: unknown = null;
      if (gapResult) {
        try {
          planResult = await getInitialPlanService().generate(input.userId);
        } catch (planError) {
          warnings.push("INITIAL_PLAN_GENERATION_FAILED");
          console.error("profile.analysis.plan.failed", {
            runId,
            error: planError instanceof Error ? planError.message : String(planError)
          });
        }
      }

      const result = {
        runId,
        documentId: document.id,
        quality: parsed.quality,
        blocks: blocks.length,
        claims: extraction.claims.length,
        evidence: evidenceResult,
        gapAnalysis: gapResult
          ? {
              snapshotId: gapResult.snapshotId,
              readiness: gapResult.readiness,
              evidenceCoverage: gapResult.evidenceCoverage
            }
          : null,
        plan: planResult,
        warnings
      };

      await this.repository.complete(
        input.userId,
        runId,
        document.id,
        result,
        {
          pages: parsed.quality.pageCount,
          blocks: blocks.length,
          mappedClaims: extraction.claims.length,
          evidenceAccepted: evidenceResult.acceptedEvidenceIds.length,
          skillDeltas: evidenceResult.deltas.length
        },
        warnings
      );

      return { runId, reused: false, result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.repository.fail(
        input.userId,
        runId,
        document.id,
        message.split(":")[0] || "ANALYSIS_FAILED",
        message
      );
      throw error;
    }
  }
}

let service: ProfileAnalysisService | null = null;

export function getProfileAnalysisService() {
  if (!service) service = new ProfileAnalysisService();
  return service;
}
