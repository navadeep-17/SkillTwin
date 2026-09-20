import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";

function parseJson(value: unknown): unknown {
  let current = value;
  for (let depth = 0; depth < 2 && typeof current === "string"; depth += 1) {
    try {
      current = JSON.parse(current);
    } catch {
      break;
    }
  }
  return current;
}

function jsonArray(value: unknown): unknown[] {
  const parsed = parseJson(value);
  return Array.isArray(parsed) ? parsed : [];
}

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const requestId = await getRequestId();

  try {
    const { id } = await context.params;
    const { user, supabase } = await requireUser();

    const { data: diff, error } = await supabase
      .from("plan_diffs")
      .select("id,status,from_plan_id,from_version,to_plan_id,to_version,trigger_type,trigger_refs,evidence_refs,summary,reason,operations,weekly_impact,timeline_impact,total_minute_delta,touch_count,complexity,can_undo,generator_version,validator_version,created_at,applied_at")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;
    if (!diff) return fail(requestId, 404, "NOT_FOUND", "Plan change not found.");

    return ok(requestId, {
      diffId: diff.id,
      status: diff.status,
      fromPlanId: diff.from_plan_id,
      fromVersion: diff.from_version,
      toPlanId: diff.to_plan_id,
      toVersion: diff.to_version,
      headline: diff.summary,
      triggerLabel: diff.trigger_type === "ASSESSMENT_COMPLETED" ? "Completed assessment" : diff.trigger_type,
      whatChanged: jsonArray(diff.operations),
      weeklyImpact: jsonArray(diff.weekly_impact),
      timelineImpact: diff.timeline_impact,
      totalMinuteDelta: diff.total_minute_delta,
      touchCount: diff.touch_count,
      complexity: diff.complexity,
      canUndo: diff.can_undo,
      reason: diff.reason,
      triggerRefs: jsonArray(diff.trigger_refs),
      evidenceRefs: jsonArray(diff.evidence_refs),
      generatorVersion: diff.generator_version,
      validatorVersion: diff.validator_version,
      createdAt: diff.created_at,
      appliedAt: diff.applied_at
    });
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return fail(requestId, 401, "UNAUTHENTICATED", "Sign in to inspect roadmap changes.");
    }

    console.error("plan.diff.read.failed", {
      requestId,
      error: error instanceof Error ? error.message : String(error)
    });
    return fail(requestId, 500, "PLAN_DIFF_READ_FAILED", "Could not load this roadmap change.");
  }
}
