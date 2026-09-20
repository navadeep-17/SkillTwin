import "server-only";
import { getSql } from "@/lib/db/postgres";
import type { EvidenceCandidate } from "@/lib/domain/skills";
import { getEvidenceEngine } from "@/lib/services/skills/evidence-service";
import { getGapAnalysisService } from "@/lib/services/gaps/gap-analysis-service";
import { getAdaptiveReplannerService } from "@/lib/services/replanner/adaptive-replanner-service";
import { PostgresProfileAnalysisRepository } from "@/lib/repositories/postgres/profile-analysis-repository";

export const PROJECT_ANALYZER_VERSION = "project-analyzer-b1";

type Row = Record<string, unknown>;

function rows(value: unknown): Row[] {
  return value as Row[];
}

const USAGE_VERBS = [
  "built","implemented","developed","created","integrated","used","using",
  "designed","deployed","optimized","architected","tested","secured","maintained"
];

const STRONG_VERBS = ["designed","deployed","optimized","architected","scaled","migrated"];

function escapeRegex(value: string) {
  return value.replace(/[|\\{}()[\]^$+*?.-]/g, "\\$&");
}

function normalize(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

function lineContaining(text: string, alias: string) {
  const lower = text.toLowerCase();
  const index = lower.indexOf(alias.toLowerCase());
  if (index < 0) return text.slice(0, 420).trim();

  const lineStart = text.lastIndexOf("\n", index);
  const lineEnd = text.indexOf("\n", index);
  const start = lineStart < 0 ? 0 : lineStart + 1;
  const end = lineEnd < 0 ? text.length : lineEnd;
  return text.slice(start, end).trim().slice(0, 420);
}

function usageSignal(snippet: string) {
  const text = normalize(snippet);
  if (!USAGE_VERBS.some(verb => text.includes(verb))) return null;
  let signal = 1.65;
  if (STRONG_VERBS.some(verb => text.includes(verb))) signal = 2.05;
  return signal;
}

export class ProjectEvidenceService {
  private readonly profileRepository = new PostgresProfileAnalysisRepository();

  async createAndAnalyze(input: {
    userId: string;
    title: string;
    description: string;
    technologies: string[];
    artifactUrl?: string | null;
  }) {
    const sql = getSql();
    const projectRows = rows(await sql.unsafe(
      "insert into public.profile_projects(user_id,title,description,technologies,artifact_url,analysis_status) values ($1::uuid,$2,$3,$4::jsonb,$5,'RUNNING') returning *",
      [
        input.userId,
        input.title,
        input.description,
        JSON.stringify(input.technologies),
        input.artifactUrl ?? null
      ]
    ));
    const project = projectRows[0];
    const projectId = String(project.id);

    try {
      const catalog = await this.profileRepository.listCatalog();
      const candidates: EvidenceCandidate[] = [];
      const seen = new Set<string>();
      const description = input.description;
      const techText = input.technologies.join(" ");

      const aliases = catalog
        .flatMap(skill =>
          [...new Set([skill.canonicalName, skill.slug, ...skill.aliases].filter(Boolean))]
            .map(alias => ({ skill, alias }))
        )
        .sort((a, b) => b.alias.length - a.alias.length);

      for (const { skill, alias } of aliases) {
        if (seen.has(skill.id)) continue;

        const pattern = new RegExp("(^|[^a-zA-Z0-9])" + escapeRegex(alias) + "(?=$|[^a-zA-Z0-9])", "i");
        const inDescription = pattern.test(description);
        const inTechnologyList = pattern.test(techText);

        if (!inDescription && !inTechnologyList) continue;
        seen.add(skill.id);

        const snippet = inDescription
          ? lineContaining(description, alias)
          : "Declared project technology: " + alias;

        const levelSignal = inDescription ? usageSignal(snippet) : null;
        const usage = levelSignal != null;

        candidates.push({
          skillId: skill.id,
          sourceType: "PROJECT_DESCRIPTION",
          sourceRef: projectId,
          sourceGroupId: "project:" + projectId + ":v" + String(project.version),
          claim: snippet,
          levelSignal,
          directness: usage ? 1 : 0.82,
          quality: usage ? 0.72 : 0.48,
          coverage: usage ? 0.58 : 0.28,
          metadata: {
            projectId,
            projectTitle: input.title,
            projectVersion: Number(project.version),
            artifactUrl: input.artifactUrl ?? null,
            matchedAlias: alias,
            matchSource: inDescription ? "description" : "technology_list",
            analyzerVersion: PROJECT_ANALYZER_VERSION
          },
          idempotencyKey: "project:" + projectId + ":v" + String(project.version) + ":" + skill.id
        });
      }

      const evidenceResult = await getEvidenceEngine().ingestBatch({
        userId: input.userId,
        trigger: { type: "PROJECT_ANALYSIS", ref: projectId },
        candidates,
        producerVersion: PROJECT_ANALYZER_VERSION
      });

      const gapResult = evidenceResult.downstream.runGapAnalysis
        ? await getGapAnalysisService().recompute(
            input.userId,
            { type: "PROJECT_SKILL_DELTA", ref: projectId }
          )
        : null;

      let replan: unknown = null;
      let replanWarning: string | null = null;
      if (evidenceResult.deltas.length) {
        try {
          replan = await getAdaptiveReplannerService().considerEvidenceSignal({
            userId: input.userId,
            triggerType: "PROJECT_EVIDENCE",
            triggerRef: projectId,
            skillIds: evidenceResult.deltas.map(delta => delta.skillId),
            evidenceIds: evidenceResult.acceptedEvidenceIds,
            gapSnapshotId: gapResult?.snapshotId ?? null
          });
        } catch (error) {
          replanWarning = "PROJECT_REPLAN_FAILED";
          console.error("project.replan.failed", {
            projectId,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      const result = {
        projectId,
        matchedSkills: candidates.length,
        evidence: evidenceResult,
        gapAnalysis: gapResult
          ? {
              snapshotId: gapResult.snapshotId,
              readiness: gapResult.readiness,
              evidenceCoverage: gapResult.evidenceCoverage
            }
          : null,
        replan,
        warnings: replanWarning ? [replanWarning] : []
      };

      await sql.begin(async tx => {
        await tx.unsafe(
          "update public.profile_projects set analysis_status='COMPLETE',analysis_result=$1::jsonb where id=$2::uuid and user_id=$3::uuid",
          [JSON.stringify(result), projectId, input.userId]
        );

        await tx.unsafe(
          "insert into public.agent_events(user_id,event_type,trigger_type,trigger_ref,summary,entity_refs,evidence_refs,metadata) values ($1::uuid,'project.evidence.processed','PROJECT_ANALYSIS',$2,$3,$4::jsonb,$5::jsonb,$6::jsonb)",
          [
            input.userId,
            projectId,
            "Processed project evidence from " + input.title + " across " + candidates.length + " canonical skills.",
            JSON.stringify([{ type: "profile_project", id: projectId }]),
            JSON.stringify(evidenceResult.acceptedEvidenceIds),
            JSON.stringify({
              matchedSkills: candidates.length,
              skillDeltas: evidenceResult.deltas.length,
              analyzerVersion: PROJECT_ANALYZER_VERSION
            })
          ]
        );
      });

      return result;
    } catch (error) {
      await sql.unsafe(
        "update public.profile_projects set analysis_status='FAILED',analysis_result=$1::jsonb where id=$2::uuid and user_id=$3::uuid",
        [
          JSON.stringify({
            error: error instanceof Error ? error.message.slice(0, 600) : String(error).slice(0, 600)
          }),
          projectId,
          input.userId
        ]
      );
      throw error;
    }
  }
}

let service: ProjectEvidenceService | null = null;

export function getProjectEvidenceService() {
  if (!service) service = new ProjectEvidenceService();
  return service;
}
