import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";
import { getAdaptiveReplannerService } from "@/lib/services/replanner/adaptive-replanner-service";
import { getAssessmentService } from "@/lib/services/assessment/assessment-service";
import { getInitialPlanService } from "@/lib/services/planner/initial-plan-service";
import { getSql } from "@/lib/db/postgres";

type Row = Record<string, unknown>;
const rows = (value: unknown) => value as Row[];

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const requestId = await getRequestId();

  try {
    const { id } = await context.params;
    const { user } = await requireUser();
    const sql = getSql();

    const proposalRows = rows(await sql.unsafe(
      "select * from public.chat_action_proposals where id=$1::uuid and user_id=$2::uuid limit 1",
      [id, user.id]
    ));
    const proposal = proposalRows[0];
    if (!proposal) return fail(requestId, 404, "NOT_FOUND", "Action proposal not found.");
    if (String(proposal.status) !== "PROPOSED") {
      return fail(requestId, 409, "ACTION_NOT_PROPOSED", "This action proposal is no longer pending.");
    }
    if (new Date(String(proposal.expires_at)).getTime() <= Date.now()) {
      await sql.unsafe(
        "update public.chat_action_proposals set status='EXPIRED' where id=$1::uuid and user_id=$2::uuid",
        [id, user.id]
      );
      return fail(requestId, 409, "ACTION_EXPIRED", "This action proposal expired. Ask Journey Chat again.");
    }

    const payload = proposal.payload && typeof proposal.payload === "object" && !Array.isArray(proposal.payload)
      ? proposal.payload as Record<string, unknown>
      : {};
    const baseline = proposal.baseline_ref && typeof proposal.baseline_ref === "object" && !Array.isArray(proposal.baseline_ref)
      ? proposal.baseline_ref as Record<string, unknown>
      : {};

    if (String(proposal.action_type) === "START_ASSESSMENT" || String(proposal.action_type) === "GENERATE_PLAN") {
      const expectedGap = baseline.gapSnapshotId ? String(baseline.gapSnapshotId) : null;
      if (expectedGap) {
        const currentGap = rows(await sql.unsafe(
          "select id from public.gap_snapshots where user_id=$1::uuid order by created_at desc limit 1",
          [user.id]
        ))[0];
        if (!currentGap || String(currentGap.id) !== expectedGap) {
          await sql.unsafe(
            "update public.chat_action_proposals set status='EXPIRED' where id=$1::uuid and user_id=$2::uuid",
            [id, user.id]
          );
          return fail(requestId, 409, "ACTION_STALE_BASELINE", "Learner state changed after this proposal. Ask Journey Chat again so it can ground a fresh action.");
        }
      }
    }

    await sql.unsafe(
      "update public.chat_action_proposals set status='CONFIRMED' where id=$1::uuid and user_id=$2::uuid and status='PROPOSED'",
      [id, user.id]
    );

    let result: unknown;
    try {
      if (String(proposal.action_type) === "UNDO_PLAN_DIFF") {
        const diffId = String(payload.diffId ?? "");
        if (!diffId) throw new Error("MISSING_DIFF_ID");
        result = await getAdaptiveReplannerService().undo(user.id, diffId);
      } else if (String(proposal.action_type) === "START_ASSESSMENT") {
        result = await getAssessmentService().create({
          userId: user.id,
          targetSkillId: payload.targetSkillId ? String(payload.targetSkillId) : undefined,
          mode: "CHALLENGE_ME"
        });
      } else if (String(proposal.action_type) === "GENERATE_PLAN") {
        result = await getInitialPlanService().generate(user.id);
      } else {
        throw new Error("UNSUPPORTED_CHAT_ACTION");
      }

      await sql.unsafe(
        "update public.chat_action_proposals set status='EXECUTED',executed_at=now() where id=$1::uuid and user_id=$2::uuid",
        [id, user.id]
      );
    } catch (dispatchError) {
      await sql.unsafe(
        "update public.chat_action_proposals set status='FAILED' where id=$1::uuid and user_id=$2::uuid",
        [id, user.id]
      );
      throw dispatchError;
    }

    const actionType = String(proposal.action_type);
    return ok(requestId, { actionType, result }, {
      notifications: [{
        title: "Action completed",
        message: actionType === "UNDO_PLAN_DIFF"
          ? "The confirmed roadmap undo was validated and applied."
          : actionType === "START_ASSESSMENT"
            ? "Your confirmed challenge is ready."
            : "Your confirmed roadmap action completed.",
        tone: "success"
      }],
      next_action: actionType === "START_ASSESSMENT" && result && typeof result === "object" && "assessment" in result
        ? {
            type: "OPEN_ASSESSMENT",
            label: "Open challenge",
            href: "/practice/" + String((result as { assessment: { id: unknown } }).assessment.id)
          }
        : actionType === "UNDO_PLAN_DIFF"
          ? { type: "OPEN_ROADMAP", label: "View roadmap", href: "/roadmap" }
          : { type: "OPEN_ROADMAP", label: "View roadmap", href: "/roadmap" }
    });
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return fail(requestId, 401, "UNAUTHENTICATED", "Sign in to confirm this action.");
    }

    console.error("chat.action.confirm.failed", {
      requestId,
      error: error instanceof Error ? error.message : String(error)
    });
    return fail(requestId, 409, "CHAT_ACTION_FAILED", "The action could not be safely executed from the current state.");
  }
}
