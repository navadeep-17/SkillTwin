import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";
import { getAssessmentService } from "@/lib/services/assessment/assessment-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const requestId = await getRequestId();

  try {
    const { id } = await context.params;
    const { user } = await requireUser();
    const result = await getAssessmentService().get(user.id, id);
    return ok(requestId, result);
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return fail(requestId, 401, "UNAUTHENTICATED", "Sign in to view this assessment.");
    }
    const message = error instanceof Error ? error.message : String(error);
    if (message === "ASSESSMENT_NOT_FOUND") {
      return fail(requestId, 404, "NOT_FOUND", "Assessment not found.");
    }

    console.error("assessment.read.failed", { requestId, error: message });
    return fail(requestId, 500, "ASSESSMENT_READ_FAILED", "Could not load this assessment.");
  }
}
