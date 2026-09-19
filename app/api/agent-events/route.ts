import { z } from "zod";
import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(40)
});

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = await getRequestId();

  try {
    const { user, supabase } = await requireUser();
    const params = Object.fromEntries(new URL(request.url).searchParams.entries());
    const parsed = querySchema.safeParse(params);
    if (!parsed.success) {
      return fail(requestId, 400, "VALIDATION_ERROR", "Invalid activity query.");
    }

    const { data, error } = await supabase
      .from("agent_events")
      .select("id,event_type,trigger_type,trigger_ref,summary,entity_refs,evidence_refs,metadata,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(parsed.data.limit);

    if (error) throw error;

    return ok(requestId, {
      events: data ?? []
    });
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return fail(requestId, 401, "UNAUTHENTICATED", "Sign in to view Agent Activity.");
    }

    console.error("agent.events.failed", {
      requestId,
      error: error instanceof Error ? error.message : String(error)
    });
    return fail(requestId, 500, "AGENT_ACTIVITY_FAILED", "Could not load Agent Activity.");
  }
}
