import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = await getRequestId();

  try {
    const { user, supabase } = await requireUser();
    const { data, error } = await supabase
      .from("user_skills")
      .select("skill_id,level_value,capability_score,confidence,conflict_state,last_validated_at,evidence_count,source_family_count,estimator_version,updated_at,skills!inner(id,slug,canonical_name,category)")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return ok(requestId, { skills: data ?? [] });
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return fail(requestId, 401, "UNAUTHENTICATED", "Sign in to view your SkillTwin.");
    }
    console.error("skills.list.failed", { requestId, error: error instanceof Error ? error.message : String(error) });
    return fail(requestId, 500, "INTERNAL_ERROR", "Could not load SkillTwin skills.");
  }
}
