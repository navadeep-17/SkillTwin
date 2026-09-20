import { z } from "zod";
import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";
import { getSql } from "@/lib/db/postgres";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("MAP"),
    skillId: z.string().uuid()
  }),
  z.object({
    action: z.literal("DISMISS")
  })
]);

type Row = Record<string, unknown>;
const rows = (value: unknown) => value as Row[];

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const requestId = await getRequestId();

  try {
    const { id } = await context.params;
    const { user } = await requireUser();
    const parsed = schema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return fail(requestId, 400, "VALIDATION_ERROR", "Choose a canonical skill or dismiss this term.");
    }

    const sql = getSql();
    const term = rows(await sql.unsafe(
      "select * from public.unresolved_skill_terms where id=$1::uuid and user_id=$2::uuid limit 1",
      [id, user.id]
    ))[0];

    if (!term) return fail(requestId, 404, "NOT_FOUND", "Unresolved skill term not found.");
    if (String(term.status) !== "UNRESOLVED") {
      return ok(requestId, {
        id,
        status: String(term.status),
        reused: true
      });
    }

    let resolvedSkillId: string | null = null;
    let resolvedSkillName: string | null = null;

    if (parsed.data.action === "MAP") {
      const skill = rows(await sql.unsafe(
        "select id,canonical_name from public.skills where id=$1::uuid and is_active=true limit 1",
        [parsed.data.skillId]
      ))[0];
      if (!skill) return fail(requestId, 404, "SKILL_NOT_FOUND", "Canonical skill not found.");
      resolvedSkillId = String(skill.id);
      resolvedSkillName = String(skill.canonical_name);
    }

    const nextStatus = parsed.data.action === "MAP" ? "MAPPED" : "DISMISSED";
    const note = parsed.data.action === "MAP"
      ? "Learner mapped unresolved term to canonical skill " + resolvedSkillName + ". This resolves taxonomy only and does not create a capability claim."
      : "Learner dismissed unresolved term.";

    const updated = rows(await sql.unsafe(
      "update public.unresolved_skill_terms set status=$1,resolved_skill_id=$2::uuid,resolution_note=$3,resolved_at=now() where id=$4::uuid and user_id=$5::uuid returning id,status,resolved_skill_id,resolution_note,resolved_at",
      [nextStatus,resolvedSkillId,note,id,user.id]
    ))[0];

    await sql.unsafe(
      "insert into public.agent_events(user_id,event_type,trigger_type,trigger_ref,summary,entity_refs,metadata) values ($1::uuid,'profile.skill_term.resolved','USER_ACTION',$2,$3,$4::jsonb,$5::jsonb)",
      [
        user.id,
        id,
        parsed.data.action === "MAP"
          ? "Mapped unresolved resume term " + String(term.raw_term) + " to " + resolvedSkillName + " without changing capability."
          : "Dismissed unresolved resume term " + String(term.raw_term) + ".",
        JSON.stringify([
          { type: "unresolved_skill_term", id },
          ...(resolvedSkillId ? [{ type: "skill", id: resolvedSkillId }] : [])
        ]),
        JSON.stringify({ action: parsed.data.action })
      ]
    );

    return ok(requestId, {
      ...updated,
      mappedSkillName: resolvedSkillName
    });
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return fail(requestId, 401, "UNAUTHENTICATED", "Sign in to resolve skill terms.");
    }

    console.error("profile.unresolved.resolve.failed", {
      requestId,
      error: error instanceof Error ? error.message : String(error)
    });
    return fail(requestId, 500, "UNRESOLVED_SKILL_RESOLVE_FAILED", "Could not resolve this skill term.");
  }
}
