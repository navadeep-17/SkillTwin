import { z } from "zod";
import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";
import { getAssessmentService } from "@/lib/services/assessment/assessment-service";

const schema = z.object({
  questionId: z.string().uuid(),
  optionId: z.string().trim().min(1).max(50).optional(),
  answerText: z.string().trim().min(3).max(3000).optional(),
  idempotencyKey: z.string().trim().min(8).max(400).optional()
}).refine(value => Boolean(value.optionId || value.answerText), {
  message: "Answer is required."
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const requestId = await getRequestId();

  try {
    const { id } = await context.params;
    const { user } = await requireUser();
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return fail(requestId, 400, "VALIDATION_ERROR", "Invalid answer payload.", parsed.error.flatten().fieldErrors);
    }

    const result = await getAssessmentService().submitAnswer({
      userId: user.id,
      assessmentId: id,
      questionId: parsed.data.questionId,
      optionId: parsed.data.optionId,
      answerText: parsed.data.answerText,
      idempotencyKey: parsed.data.idempotencyKey
    });

    const completed = "completed" in result && result.completed === true;
    const finalResult = completed ? result as {
      completed: true;
      evidence?: { deltas?: unknown[] };
      outcome?: { weaknesses?: unknown; strengths?: unknown };
      gapAnalysis?: { readiness?: number } | null;
      replan?: {
        changed?: boolean;
        diff?: unknown;
      } | null;
      warnings?: string[];
    } : null;

    return ok(requestId, result, completed ? {
      skill_delta: finalResult?.evidence?.deltas ?? [],
      plan_diff: finalResult?.replan?.changed ? finalResult.replan.diff : undefined,
      notifications: [{
        title: "Validation committed",
        message: finalResult?.gapAnalysis?.readiness != null
          ? "SkillTwin and role readiness were recomputed from the completed assessment."
          : "Assessment evidence was processed by SkillTwin.",
        tone: "success"
      }],
      next_action: finalResult?.replan?.changed && finalResult.replan.diff && typeof finalResult.replan.diff === "object" && "diffId" in finalResult.replan.diff
        ? {
            type: "OPEN_PLAN_DIFF",
            label: "See what changed",
            href: "/roadmap/changes/" + String((finalResult.replan.diff as { diffId: unknown }).diffId)
          }
        : {
            type: "OPEN_ASSESSMENT_RESULT",
            label: "View result",
            href: "/practice/" + id
          }
    } : undefined);
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return fail(requestId, 401, "UNAUTHENTICATED", "Sign in to submit an answer.");
    }

    const message = error instanceof Error ? error.message : String(error);
    if (message === "ASSESSMENT_NOT_FOUND" || message === "QUESTION_NOT_FOUND") {
      return fail(requestId, 404, "NOT_FOUND", "Assessment question not found.");
    }
    if (message === "STALE_QUESTION") {
      return fail(requestId, 409, "STALE_QUESTION", "This question is no longer the current assessment step. Reload the challenge.");
    }
    if (message === "ANSWER_REQUIRED") {
      return fail(requestId, 400, "ANSWER_REQUIRED", "Enter an answer before submitting.");
    }
    if (message === "ASSESSMENT_NOT_ACTIVE") {
      return fail(requestId, 409, "ASSESSMENT_NOT_ACTIVE", "This assessment is no longer active.");
    }

    console.error("assessment.answer.failed", { requestId, error: message });
    return fail(requestId, 500, "ANSWER_SUBMIT_FAILED", "Could not evaluate this answer.");
  }
}
