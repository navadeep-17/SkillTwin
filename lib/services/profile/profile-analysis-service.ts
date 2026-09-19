import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getEvidenceEngine } from "@/lib/services/skills/evidence-service";
import { getGapAnalysisService } from "@/lib/services/gaps/gap-analysis-service";
import { getInitialPlanService } from "@/lib/services/planner/initial-plan-service";
import { PostgresProfileAnalysisRepository } from "@/lib/repositories/postgres/profile-analysis-repository";
import { parsePdf } from "@/lib/profile/pdf-parser";
import { segmentResume } from "@/lib/profile/segmenter";
import { extractMappedSkills } from "@/lib/profile/skill-mapper";
import { extractSemanticSkillEvidence, mergeProfileExtractions } from "@/lib/profile/semantic-extractor";

export const PROFILE_ANALYZER_SCHEMA_VERSION = "profile-analyzer-b1";

export class ProfileAnalysisService {
  constructor(private readonly repository = new PostgresProfileAnalysisRepository()) {}

  async analyzeDocument(input: { userId: string; documentId: string; supabase: SupabaseClient; deferPlan?: boolean }) {
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
        documentType: document.documentType,
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
      const deterministicExtraction = extractMappedSkills({
        blocks,
        catalog,
        documentId: document.id,
        documentVersion: document.version
      });

      let semanticExtraction = null;
      try {
        await this.repository.setStage(
          input.userId,
          runId,
          "extracting",
          48,
          { pages: parsed.quality.pageCount, blocks: blocks.length },
          warnings
        );
        semanticExtraction = await extractSemanticSkillEvidence({
          blocks,
          catalog,
          documentId: document.id,
          documentVersion: document.version
        });
      } catch (semanticError) {
        warnings.push("AI_SEMANTIC_EXTRACTION_FAILED");
        console.error("profile.semantic_extraction.failed", {
          runId,
          error: semanticError instanceof Error ? semanticError.message : String(semanticError)
        });
      }

      const extraction = mergeProfileExtractions(
        deterministicExtraction,
        semanticExtraction
      );

      if (document.documentType === "certificate") {
        extraction.evidence = extraction.evidence.map(candidate => ({
          ...candidate,
          sourceType: "MANUAL_SELF_REPORT",
          sourceGroupId: "certificate:" + document.id + ":v" + document.version + ":" + candidate.sourceRef,
          levelSignal: null,
          directness: Math.min(candidate.directness, 0.65),
          quality: Math.min(candidate.quality, 0.35),
          coverage: Math.min(candidate.coverage, 0.25),
          metadata: {
            ...(candidate.metadata ?? {}),
            sourceKind: "certificate",
            certificateDocumentId: document.id,
            originalProposedSourceType: candidate.sourceType
          },
          idempotencyKey: "certificate:" + document.id + ":v" + document.version + ":" + candidate.skillId + ":" + candidate.sourceRef
        }));
      }

      await this.repository.setStage(
        input.userId,
        runId,
        "mapping",
        58,
        {
          pages: parsed.quality.pageCount,
          blocks: blocks.length,
          deterministicClaims: deterministicExtraction.claims.length,
          semanticClaims: semanticExtraction?.claims.length ?? 0,
          mergedClaims: extraction.claims.length
        },
        warnings
      );

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
        trigger: { type: document.documentType === "certificate" ? "CERTIFICATE_ANALYSIS" : "PROFILE_ANALYSIS", ref: runId },
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
      if (gapResult && !input.deferPlan) {
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

  analyzeResume(input: { userId: string; documentId: string; supabase: SupabaseClient; deferPlan?: boolean }) {
    return this.analyzeDocument(input);
  }
}

let service: ProfileAnalysisService | null = null;

export function getProfileAnalysisService() {
  if (!service) service = new ProfileAnalysisService();
  return service;
}
