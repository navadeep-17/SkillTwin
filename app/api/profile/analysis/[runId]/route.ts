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
      .select("id,source_type,source_id,source_version,status,stage,progress_percent,counts,warnings,structured_profile,evidence_batch_result,error_code,error_message,started_at,completed_at")
      .eq("id", runId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return fail(requestId, 404, "NOT_FOUND", "Analysis run not found.");

    const { data: unresolved, error: unresolvedError } = await supabase
      .from("unresolved_skill_terms")
      .select("id,source_block_id,raw_term,context,status,resolved_skill_id,resolution_note,created_at,resolved_at")
      .eq("analysis_run_id", runId)
      .eq("user_id", user.id)
      .order("created_at");
    if (unresolvedError) throw unresolvedError;

    return ok(requestId, { analysis: data, unresolvedTerms: unresolved ?? [] });
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
