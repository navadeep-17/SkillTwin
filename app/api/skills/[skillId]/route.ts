import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ skillId: string }> }) {
  const requestId = await getRequestId();

  try {
    const { skillId } = await context.params;
    const { user, supabase } = await requireUser();

    const { data: snapshot, error: snapshotError } = await supabase
      .from("user_skills")
      .select("*,skills!inner(id,slug,canonical_name,category,description)")
      .eq("user_id", user.id)
      .eq("skill_id", skillId)
      .maybeSingle();

    if (snapshotError) throw snapshotError;
    if (!snapshot) return fail(requestId, 404, "NOT_FOUND", "Skill state not found.");

    const [
      { data: evidence, error: evidenceError },
      { data: history, error: historyError }
    ] = await Promise.all([
      supabase
        .from("skill_evidence")
        .select("id,source_type,source_ref,source_group_id,claim,level_signal,status,created_at")
        .eq("user_id", user.id)
        .eq("skill_id", skillId)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("skill_history")
        .select("id,trigger_type,trigger_ref,before_state,after_state,evidence_ids,explanation,created_at")
        .eq("user_id", user.id)
        .eq("skill_id", skillId)
        .order("created_at", { ascending: false })
        .limit(20)
    ]);

    if (evidenceError) throw evidenceError;
    if (historyError) throw historyError;
    return ok(requestId, { snapshot, evidence: evidence ?? [], history: history ?? [] });
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return fail(requestId, 401, "UNAUTHENTICATED", "Sign in to view this skill.");
    }
    console.error("skills.detail.failed", { requestId, error: error instanceof Error ? error.message : String(error) });
    return fail(requestId, 500, "INTERNAL_ERROR", "Could not load skill detail.");
  }
}
