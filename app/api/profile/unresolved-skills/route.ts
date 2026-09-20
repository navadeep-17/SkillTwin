import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = await getRequestId();

  try {
    const { user, supabase } = await requireUser();

    const [{ data: terms, error: termsError }, { data: skills, error: skillsError }] = await Promise.all([
      supabase
        .from("unresolved_skill_terms")
        .select("id,raw_term,context,status,created_at,analysis_run_id,source_block_id")
        .eq("user_id", user.id)
        .eq("status", "UNRESOLVED")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("skills")
        .select("id,slug,canonical_name,category")
        .eq("is_active", true)
        .order("canonical_name")
        .limit(250)
    ]);

    if (termsError) throw termsError;
    if (skillsError) throw skillsError;

    return ok(requestId, {
      terms: terms ?? [],
      skills: skills ?? []
    });
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return fail(requestId, 401, "UNAUTHENTICATED", "Sign in to review unresolved skills.");
    }

    console.error("profile.unresolved.read.failed", {
      requestId,
      error: error instanceof Error ? error.message : String(error)
    });
    return fail(requestId, 500, "UNRESOLVED_SKILLS_READ_FAILED", "Could not load unresolved skill terms.");
  }
}
