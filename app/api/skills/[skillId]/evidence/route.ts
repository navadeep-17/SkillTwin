import { createHash } from "node:crypto";
import { z } from "zod";
import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";
import { getEvidenceEngine } from "@/lib/services/skills/evidence-service";

const schema = z.object({
  claim: z.string().trim().min(3).max(1000),
  levelSignal: z.number().min(0).max(4).nullable().optional()
});

export async function POST(request: Request, context: { params: Promise<{ skillId: string }> }) {
  const requestId = await getRequestId();

  try {
    const { skillId } = await context.params;
    const { user, supabase } = await requireUser();
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return fail(requestId, 400, "VALIDATION_ERROR", "Invalid evidence payload.", parsed.error.flatten().fieldErrors);
    }

    const { data: skill, error } = await supabase
      .from("skills")
      .select("id")
      .eq("id", skillId)
      .eq("is_active", true)
      .maybeSingle();

    if (error) throw error;
    if (!skill) return fail(requestId, 404, "NOT_FOUND", "Canonical skill not found.");

    const fingerprint = createHash("sha256")
      .update(`${user.id}|${skillId}|${parsed.data.claim}|${parsed.data.levelSignal ?? "null"}`)
      .digest("hex");

    const result = await getEvidenceEngine().ingestBatch({
      userId: user.id,
      trigger: { type: "MANUAL_EVIDENCE", ref: requestId },
      producerVersion: "manual-api-v1",
      candidates: [{
        skillId,
        sourceType: "MANUAL_SELF_REPORT",
        sourceRef: requestId,
        sourceGroupId: `manual:${fingerprint}`,
        claim: parsed.data.claim,
        levelSignal: parsed.data.levelSignal ?? null,
        directness: 0.75,
        quality: 0.50,
        coverage: 0.40,
        idempotencyKey: `manual:${fingerprint}`
      }]
    });

    return ok(requestId, result, {
      skill_delta: result.deltas,
      notifications: result.deltas.length ? [{
        title: "SkillTwin updated",
        message: result.deltas[0]?.learnerExplanation,
        tone: "success"
      }] : undefined
    }, 201);
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return fail(requestId, 401, "UNAUTHENTICATED", "Sign in to add evidence.");
    }
    console.error("skills.evidence.failed", { requestId, error: error instanceof Error ? error.message : String(error) });
    return fail(requestId, 500, "INTERNAL_ERROR", "Could not add evidence.");
  }
}
