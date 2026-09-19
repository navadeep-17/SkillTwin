import { z } from "zod";
import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";
import { getAssessmentService } from "@/lib/services/assessment/assessment-service";

const schema = z.object({
  targetSkillId: z.string().uuid().optional(),
  sourceTaskId: z.string().uuid().optional(),
  mode: z.enum(["CHALLENGE_ME","SCHEDULED_VALIDATION","CALIBRATION","CONFLICT_RESOLUTION"]).optional()
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = await getRequestId();

  try {
    const { user } = await requireUser();
    const body = await request.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return fail(requestId, 400, "VALIDATION_ERROR", "Invalid assessment request.", parsed.error.flatten().fieldErrors);
    }

    const result = await getAssessmentService().create({
      userId: user.id,
      targetSkillId: parsed.data.targetSkillId,
      sourceTaskId: parsed.data.sourceTaskId,
      mode: parsed.data.mode
    });

    return ok(requestId, result, {
      notifications: [{
        title: "Challenge ready",
        message: "Answer the short validation to strengthen your SkillTwin evidence.",
        tone: "info"
      }],
      next_action: {
        type: "OPEN_ASSESSMENT",
        label: "Start challenge",
        href: "/practice/" + result.assessment.id,
        entityId: result.assessment.id
      }
    }, 201);
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return fail(requestId, 401, "UNAUTHENTICATED", "Sign in to start Challenge Me.");
    }

    const message = error instanceof Error ? error.message : String(error);
    if (message === "NO_ASSESSABLE_SKILL") {
      return fail(requestId, 409, "NO_ASSESSABLE_SKILL", "No current high-value skill has a challenge bank yet.");
    }
    if (message === "SOURCE_TASK_NOT_FOUND") {
      return fail(requestId, 404, "SOURCE_TASK_NOT_FOUND", "Scheduled validation task not found.");
    }
    if (message === "QUESTION_BANK_TOO_SMALL") {
      return fail(requestId, 409, "QUESTION_BANK_TOO_SMALL", "This skill does not have enough validated challenge items.");
    }

    console.error("assessment.create.failed", { requestId, error: message });
    return fail(requestId, 500, "ASSESSMENT_CREATE_FAILED", "Could not start Challenge Me.");
  }
}
