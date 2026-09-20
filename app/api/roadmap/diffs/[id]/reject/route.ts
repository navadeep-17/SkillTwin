import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";
import { getAdaptiveReplannerService } from "@/lib/services/replanner/adaptive-replanner-service";

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
    const result = await getAdaptiveReplannerService().rejectProposed(user.id, id);

    return ok(requestId, result, {
      plan_diff: result.diff,
      notifications: [{
        title: "Current roadmap kept",
        message: "The proposed change was rejected and no plan version was changed.",
        tone: "info"
      }],
      next_action: {
        type: "OPEN_ROADMAP",
        label: "Back to roadmap",
        href: "/roadmap"
      }
    });
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return fail(requestId, 401, "UNAUTHENTICATED", "Sign in to reject a roadmap change.");
    }

    const message = error instanceof Error ? error.message : String(error);
    if (message === "PLAN_DIFF_NOT_FOUND") {
      return fail(requestId, 404, "NOT_FOUND", "Plan change not found.");
    }
    if (message === "PLAN_DIFF_NOT_REJECTABLE") {
      return fail(requestId, 409, message, "This roadmap proposal can no longer be rejected.");
    }

    console.error("plan.diff.reject.failed", { requestId, error: message });
    return fail(requestId, 500, "PLAN_DIFF_REJECT_FAILED", "Could not reject this roadmap change.");
  }
}
