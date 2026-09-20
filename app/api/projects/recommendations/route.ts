import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";
import { getProjectRecommendationService } from "@/lib/services/projects/project-recommendation-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = await getRequestId();

  try {
    const { user } = await requireUser();
    const recommendations = await getProjectRecommendationService().list(user.id);
    return ok(requestId, { recommendations });
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return fail(requestId, 401, "UNAUTHENTICATED", "Sign in to view project recommendations.");
    }

    console.error("project.recommendations.read.failed", {
      requestId,
      error: error instanceof Error ? error.message : String(error)
    });
    return fail(requestId, 500, "PROJECT_RECOMMENDATIONS_READ_FAILED", "Could not load project recommendations.");
  }
}

export async function POST() {
  const requestId = await getRequestId();

  try {
    const { user } = await requireUser();
    const recommendations = await getProjectRecommendationService().generate(user.id);

    return ok(requestId, { recommendations }, {
      notifications: [{
        title: "Project ideas refreshed",
        message: "Recommendations now target your latest SkillTwin gaps.",
        tone: "success"
      }]
    });
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return fail(requestId, 401, "UNAUTHENTICATED", "Sign in to generate project recommendations.");
    }

    const message = error instanceof Error ? error.message : String(error);
    if (message === "PROJECT_RECOMMENDATION_CONTEXT_MISSING") {
      return fail(requestId, 409, message, "Choose a target role and analyze your profile first.");
    }
    if (message === "NO_PROJECT_RECOMMENDATION_GAPS") {
      return fail(requestId, 409, message, "There are no current role gaps that need a project recommendation.");
    }

    console.error("project.recommendations.generate.failed", { requestId, error: message });
    return fail(requestId, 500, "PROJECT_RECOMMENDATIONS_GENERATE_FAILED", "Could not generate project recommendations.");
  }
}
