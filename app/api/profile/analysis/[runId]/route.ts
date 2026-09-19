import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ runId: string }> }
) {
  const requestId = await getRequestId();

  try {
    const { runId } = await context.params;
    const { user, supabase } = await requireUser();
    const { data, error } = await supabase
      .from("profile_analysis_runs")
      .select("id,source_id,source_version,status,stage,progress_percent,counts,warnings,evidence_batch_result,error_code,error_message,started_at,completed_at")
      .eq("id", runId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return fail(requestId, 404, "NOT_FOUND", "Analysis run not found.");
    return ok(requestId, { analysis: data });
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return fail(requestId, 401, "UNAUTHENTICATED", "Sign in to view analysis progress.");
    }

    console.error("profile.analysis.read.failed", {
      requestId,
      error: error instanceof Error ? error.message : String(error)
    });
    return fail(requestId, 500, "INTERNAL_ERROR", "Could not load analysis status.");
  }
}
