import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";
import { getProfileAnalysisService } from "@/lib/services/profile/profile-analysis-service";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ documentId: string }> }
) {
  const requestId = await getRequestId();

  try {
    const { documentId } = await context.params;
    const { user, supabase } = await requireUser();
    const deferPlan = new URL(request.url).searchParams.get("deferPlan") === "1";
    const analysis = await getProfileAnalysisService().analyzeDocument({
      userId: user.id,
      documentId,
      supabase,
      deferPlan
    });

    const result = analysis.result as {
      evidence?: { deltas?: unknown[] };
      gapAnalysis?: { readiness?: number } | null;
    };

    return ok(
      requestId,
      analysis,
      {
        skill_delta: result.evidence?.deltas ?? [],
        notifications: [{
          title: analysis.reused ? "Profile analysis already complete" : "Profile analysis complete",
          message: result.gapAnalysis?.readiness != null
            ? "SkillTwin updated. Target-role readiness is now " + result.gapAnalysis.readiness + "%."
            : "Profile evidence processed.",
          tone: "success"
        }],
        next_action: {
          type: "OPEN_OVERVIEW",
          label: "View your SkillTwin",
          href: "/overview"
        }
      }
    );
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return fail(requestId, 401, "UNAUTHENTICATED", "Sign in to analyze this profile document.");
    }

    const message = error instanceof Error ? error.message : String(error);
    if (message === "PROFILE_DOCUMENT_NOT_FOUND") {
      return fail(requestId, 404, "NOT_FOUND", "Profile document not found.");
    }
    if (message === "TEXT_EXTRACTION_TOO_LOW") {
      return fail(
        requestId,
        422,
        "PDF_TEXT_TOO_LOW",
        "This PDF appears image-based or has too little extractable text. Upload a text-based PDF or enter the information manually; OCR is intentionally outside the frozen MVP."
      );
    }

    console.error("profile.analysis.failed", { requestId, error: message });
    return fail(requestId, 500, "PROFILE_ANALYSIS_FAILED", "Could not analyze this profile document.");
  }
}
