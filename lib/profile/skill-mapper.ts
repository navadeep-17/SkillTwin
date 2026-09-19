import type { EvidenceCandidate } from "@/lib/domain/skills";
import type { ProfileSourceBlock } from "./segmenter";
import { normalizedLookupText } from "./normalizer";

export interface CanonicalSkillEntry {
  id: string;
  slug: string;
  canonicalName: string;
  aliases: string[];
}

export interface CandidateSkillClaim {
  sourceBlockId: string;
  rawSkillName: string;
  canonicalSkillId: string;
  claimType: "explicit" | "usage" | "inferred_context";
  evidenceSnippet: string;
  extractionConfidence: number;
  mappingMethod: "exact_alias" | "ai_catalog_selection";
  mappingConfidence: number;
}

export interface ProfileSkillExtraction {
  claims: CandidateSkillClaim[];
  evidence: EvidenceCandidate[];
}

const USAGE_VERBS = [
  "built", "implemented", "developed", "created", "integrated", "used", "using",
  "designed", "deployed", "optimized", "architected", "maintained", "tested", "secured"
];

const STRONG_VERBS = ["designed", "deployed", "optimized", "architected", "led", "scaled", "migrated"];
const PRODUCTION_TERMS = ["production", "scalable", "performance", "latency", "concurrent", "distributed", "high traffic"];

function escapeRegex(value: string) {
  return value.replace(/[|\\{}()[\]^$+*?.-]/g, "\\$&");
}

function lineContaining(text: string, alias: string): string {
  const lower = text.toLowerCase();
  const index = lower.indexOf(alias.toLowerCase());
  if (index < 0) return text.slice(0, 320);

  const lineStart = text.lastIndexOf("\n", index);
  const lineEnd = text.indexOf("\n", index);
  const start = lineStart < 0 ? 0 : lineStart + 1;
  const end = lineEnd < 0 ? text.length : lineEnd;
  const line = text.slice(start, end).trim();
  if (line.length <= 420) return line;

  const local = index - start;
  const snippetStart = Math.max(0, local - 180);
  return line.slice(snippetStart, snippetStart + 420).trim();
}

function usageSignal(snippet: string): number | null {
  const normalized = normalizedLookupText(snippet);
  const hasUsage = USAGE_VERBS.some(verb => normalized.includes(verb));
  if (!hasUsage) return null;

  let signal = 1.55;
  if (STRONG_VERBS.some(verb => normalized.includes(verb))) signal = 2.0;
  if (PRODUCTION_TERMS.some(term => normalized.includes(term))) signal += 0.2;
  return Math.min(2.3, Number(signal.toFixed(2)));
}

function evidenceShape(block: ProfileSourceBlock, signal: number | null) {
  const usageContext = block.kind === "projects" || block.kind === "experience";
  if (usageContext && signal != null) {
    return {
      sourceType: "RESUME_PROJECT_DETAIL" as const,
      claimType: "usage" as const,
      directness: 1,
      quality: 0.75,
      coverage: 0.62,
      extractionConfidence: 0.92
    };
  }
  return {
    sourceType: "RESUME_SKILL_MENTION" as const,
    claimType: "explicit" as const,
    directness: 0.8,
    quality: 0.42,
    coverage: block.kind === "skills" ? 0.3 : 0.22,
    extractionConfidence: 0.98
  };
}

export function extractMappedSkills(input: {
  blocks: ProfileSourceBlock[];
  catalog: CanonicalSkillEntry[];
  documentId: string;
  documentVersion: number;
}): ProfileSkillExtraction {
  const claims: CandidateSkillClaim[] = [];
  const evidence: EvidenceCandidate[] = [];
  const dedupe = new Set<string>();

  const aliases = input.catalog
    .flatMap(skill => {
      const values = [...new Set([skill.canonicalName, skill.slug, ...skill.aliases].filter(Boolean))];
      return values.map(alias => ({ skill, alias }));
    })
    .sort((a, b) => b.alias.length - a.alias.length);

  for (const block of input.blocks) {
    for (const { skill, alias } of aliases) {
      const pattern = new RegExp("(^|[^a-zA-Z0-9])" + escapeRegex(alias) + "(?=$|[^a-zA-Z0-9])", "i");
      if (!pattern.test(block.text)) continue;

      const dedupeKey = block.id + ":" + skill.id;
      if (dedupe.has(dedupeKey)) continue;
      dedupe.add(dedupeKey);

      const snippet = lineContaining(block.text, alias);
      const signal = usageSignal(snippet);
      const shape = evidenceShape(block, signal);
      const groupId = "resume:" + input.documentId + ":v" + input.documentVersion + ":" + block.id;

      claims.push({
        sourceBlockId: block.id,
        rawSkillName: alias,
        canonicalSkillId: skill.id,
        claimType: shape.claimType,
        evidenceSnippet: snippet,
        extractionConfidence: shape.extractionConfidence,
        mappingMethod: "exact_alias",
        mappingConfidence: 1
      });

      evidence.push({
        skillId: skill.id,
        sourceType: shape.sourceType,
        sourceRef: block.id,
        sourceGroupId: groupId,
        claim: snippet,
        levelSignal: shape.claimType === "usage" ? signal : null,
        directness: shape.directness,
        quality: shape.quality,
        coverage: shape.coverage,
        metadata: {
          documentId: input.documentId,
          documentVersion: input.documentVersion,
          blockKind: block.kind,
          blockTitle: block.title,
          pageStart: block.pageStart,
          pageEnd: block.pageEnd,
          rawSkillName: alias,
          mappingMethod: "exact_alias"
        },
        idempotencyKey: "resume:" + input.documentId + ":v" + input.documentVersion + ":" + block.id + ":" + skill.id
      });
    }
  }

  return { claims, evidence };
}
