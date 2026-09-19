import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";
import { getInitialPlanService } from "@/lib/services/planner/initial-plan-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const requestId = await getRequestId();

  try {
    const { user } = await requireUser();
    const result = await getInitialPlanService().generate(user.id);

    return ok(requestId, result, {
      notifications: [{
        title: result.reused ? "Roadmap already active" : "Roadmap created",
        message: result.reused
          ? "SkillTwin kept your existing active baseline instead of silently regenerating it."
          : "Your first evidence-backed learning roadmap is ready.",
        tone: "success"
      }],
      next_action: { type: "OPEN_ROADMAP", label: "View roadmap", href: "/roadmap" }
    });
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return fail(requestId, 401, "UNAUTHENTICATED", "Sign in to generate your roadmap.");
    }

    const message = error instanceof Error ? error.message : String(error);
    if (message === "ACTIVE_GOAL_NOT_FOUND") {
      return fail(requestId, 409, "ACTIVE_GOAL_NOT_FOUND", "Choose a target role before generating a roadmap.");
    }
    if (message === "GAP_SNAPSHOT_NOT_FOUND") {
      return fail(requestId, 409, "GAP_SNAPSHOT_NOT_FOUND", "Analyze your profile before generating a roadmap.");
    }

    console.error("plan.generate.failed", { requestId, error: message });
    return fail(requestId, 500, "PLAN_GENERATION_FAILED", "Could not generate the learning roadmap.");
  }
}
