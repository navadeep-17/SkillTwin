import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = await getRequestId();

  try {
    const { supabase } = await requireUser();
    const { data, error } = await supabase
      .from("role_versions")
      .select("id,version,target_roles!inner(id,slug,name,family),role_skill_requirements(id)")
      .eq("status", "ACTIVE");

    if (error) throw error;

    const roles = (data ?? []).map(row => {
      const role = Array.isArray(row.target_roles) ? row.target_roles[0] : row.target_roles;
      return {
        id: String(role?.id ?? ""),
        slug: String(role?.slug ?? ""),
        name: String(role?.name ?? "Target role"),
        family: role?.family ? String(role.family) : null,
        roleVersionId: String(row.id),
        version: Number(row.version),
        requirementCount: Array.isArray(row.role_skill_requirements) ? row.role_skill_requirements.length : 0
      };
    }).sort((a, b) => {
      const family = String(a.family ?? "").localeCompare(String(b.family ?? ""));
      return family || a.name.localeCompare(b.name);
    });

    return ok(requestId, { roles });
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return fail(requestId, 401, "UNAUTHENTICATED", "Sign in to view target roles.");
    }

    console.error("roles.read.failed", {
      requestId,
      error: error instanceof Error ? error.message : String(error)
    });
    return fail(requestId, 500, "ROLES_READ_FAILED", "Could not load target roles.");
  }
}
