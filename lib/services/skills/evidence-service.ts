import "server-only";
import { EvidenceEngine } from "@/lib/domain/evidence-engine";
import { PostgresEvidenceRepository } from "@/lib/repositories/postgres/evidence-repository";

let engine: EvidenceEngine | null = null;

export function getEvidenceEngine(): EvidenceEngine {
  if (!engine) engine = new EvidenceEngine(new PostgresEvidenceRepository());
  return engine;
}
