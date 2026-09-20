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
    const result = await getAdaptiveReplannerService().applyProposed(user.id, id);

    return ok(requestId, result, {
      plan_diff: result.diff,
      notifications: [{
        title: "Roadmap change applied",
        message: "SkillTwin created a new plan version from the confirmed proposal.",
        tone: "success"
      }],
      next_action: {
        type: "OPEN_ROADMAP",
        label: "View roadmap",
        href: "/roadmap"
      }
    });
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return fail(requestId, 401, "UNAUTHENTICATED", "Sign in to apply a roadmap change.");
    }

    const message = error instanceof Error ? error.message : String(error);
    if (message === "PLAN_DIFF_NOT_FOUND") {
      return fail(requestId, 404, "NOT_FOUND", "Plan change not found.");
    }
    if ([
      "PLAN_DIFF_NOT_APPLICABLE",
      "PLAN_DIFF_UNSUPPORTED_PATCH_SHAPE",
      "PLAN_DIFF_INVALID_OPERATION",
      "PLAN_DIFF_STALE_BASELINE",
      "PLAN_DIFF_CAPACITY_EXCEEDED",
      "PLAN_DIFF_REFERENCE_ERROR"
    ].includes(message)) {
      return fail(requestId, 409, message, "This proposed roadmap change can no longer be applied safely.");
    }

    console.error("plan.diff.apply.failed", { requestId, error: message });
    return fail(requestId, 500, "PLAN_DIFF_APPLY_FAILED", "Could not apply this roadmap change.");
  }
}
