import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = await getRequestId();

  try {
    const { user, supabase } = await requireUser();
    const { data, error } = await supabase
      .from("learning_plans")
      .select("id,goal_id,version,status,start_date,end_date,planned_minutes,adaptation_buffer_minutes,parent_plan_id,gap_snapshot_id,created_at")
      .eq("user_id", user.id)
      .order("version", { ascending: false });

    if (error) throw error;

    return ok(requestId, {
      versions: (data ?? []).map(plan => ({
        planId: plan.id,
        goalId: plan.goal_id,
        version: plan.version,
        status: plan.status,
        startDate: plan.start_date,
        endDate: plan.end_date,
        plannedMinutes: plan.planned_minutes,
        adaptationBufferMinutes: plan.adaptation_buffer_minutes,
        parentPlanId: plan.parent_plan_id,
        gapSnapshotId: plan.gap_snapshot_id,
        createdAt: plan.created_at,
        active: plan.status === "ACTIVE"
      }))
    });
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return fail(requestId, 401, "UNAUTHENTICATED", "Sign in to view roadmap history.");
    }

    console.error("roadmap.versions.failed", {
      requestId,
      error: error instanceof Error ? error.message : String(error)
    });
    return fail(requestId, 500, "ROADMAP_HISTORY_FAILED", "Could not load roadmap versions.");
  }
}
