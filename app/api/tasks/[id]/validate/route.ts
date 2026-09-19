import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";
import { getAssessmentService } from "@/lib/services/assessment/assessment-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const requestId = await getRequestId();

  try {
    const { id } = await context.params;
    const { user } = await requireUser();
    const result = await getAssessmentService().create({
      userId: user.id,
      sourceTaskId: id,
      mode: "SCHEDULED_VALIDATION"
    });

    return ok(requestId, result, {
      next_action: {
        type: "OPEN_ASSESSMENT",
        label: "Start validation",
        href: "/practice/" + result.assessment.id,
        entityId: result.assessment.id
      }
    }, 201);
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return fail(requestId, 401, "UNAUTHENTICATED", "Sign in to start validation.");
    }

    const message = error instanceof Error ? error.message : String(error);
    if (message === "SOURCE_TASK_NOT_FOUND") {
      return fail(requestId, 404, "NOT_FOUND", "Validation task not found.");
    }
    if (message === "QUESTION_BANK_TOO_SMALL") {
      return fail(requestId, 409, "NO_VALIDATION_BANK", "This skill does not have a validation bank yet.");
    }

    console.error("task.validate.failed", { requestId, error: message });
    return fail(requestId, 500, "VALIDATION_START_FAILED", "Could not start the validation challenge.");
  }
}
