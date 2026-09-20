import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";
import { getSql } from "@/lib/db/postgres";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = await getRequestId();

  try {
    await requireUser();
    const sql = getSql();
    const rows = await sql<Record<string, unknown>[]>\`
      select
        tr.id,
        tr.slug,
        tr.name,
        tr.family,
        rv.id as role_version_id,
        rv.version,
        count(rsr.id)::int as requirement_count
      from public.target_roles tr
      join public.role_versions rv
        on rv.role_id = tr.id
       and rv.status = 'ACTIVE'
      left join public.role_skill_requirements rsr
        on rsr.role_version_id = rv.id
      group by tr.id,tr.slug,tr.name,tr.family,rv.id,rv.version
      order by tr.family nulls last,tr.name
    \`;

    return ok(requestId, {
      roles: rows.map(row => ({
        id: String(row.id),
        slug: String(row.slug),
        name: String(row.name),
        family: row.family ? String(row.family) : null,
        roleVersionId: String(row.role_version_id),
        version: Number(row.version),
        requirementCount: Number(row.requirement_count)
      }))
    });
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
