import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";
import { getPlanUndoService } from "@/lib/services/replanner/plan-undo-service";

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
    const result = await getPlanUndoService().undo(user.id, id);

    return ok(requestId, result, {
      plan_diff: result.diff,
      notifications: [{
        title: "Roadmap change undone",
        message: "SkillTwin created a new plan version that safely removes the unstarted reinforcement.",
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
      return fail(requestId, 401, "UNAUTHENTICATED", "Sign in to undo a roadmap change.");
    }

    const message = error instanceof Error ? error.message : String(error);
    if (message === "PLAN_DIFF_NOT_FOUND") {
      return fail(requestId, 404, "NOT_FOUND", "Plan change not found.");
    }
    if (
      message === "PLAN_DIFF_NOT_UNDOABLE"
      || message === "UNDO_STALE_BASELINE"
      || message === "UNDO_UNSUPPORTED_RESOURCE_REMOVAL"
      || message === "UNDO_UNSUPPORTED_NULL_DUE_DATE"
      || message === "UNDO_TOO_COMPLEX"
      || message.startsWith("PLAN_DIFF_VALIDATION_FAILED")
    ) {
      return fail(
        requestId,
        409,
        message,
        "This roadmap change cannot be safely compensated from the current task/progress state."
      );
    }

    console.error("plan.diff.undo.failed", { requestId, error: message });
    return fail(requestId, 500, "PLAN_DIFF_UNDO_FAILED", "Could not undo this roadmap change.");
  }
}
