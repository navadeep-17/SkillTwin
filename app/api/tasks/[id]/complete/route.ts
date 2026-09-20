import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";
import { getSql } from "@/lib/db/postgres";
import { getEvidenceEngine } from "@/lib/services/skills/evidence-service";
import { getAdaptiveReplannerService } from "@/lib/services/replanner/adaptive-replanner-service";

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

    const taskRows = rows(await sql.unsafe(
      "select t.*,p.status plan_status,p.version plan_version,s.canonical_name from public.learning_tasks t join public.learning_plans p on p.id=t.plan_id join public.skills s on s.id=t.skill_id where t.id=$1::uuid and p.user_id=$2::uuid limit 1",
      [id, user.id]
    ));
    const task = taskRows[0];
    if (!task) return fail(requestId, 404, "NOT_FOUND", "Learning task not found.");
    if (String(task.plan_status) !== "ACTIVE") {
      return fail(requestId, 409, "STALE_PLAN_TASK", "This task belongs to an older roadmap version.");
    }
    if (String(task.type) === "VALIDATE") {
      return fail(
        requestId,
        409,
        "VALIDATION_REQUIRED",
        "Validation tasks must be completed through Challenge Me rather than manually checked off."
      );
    }

    const alreadyCompleted = String(task.status) === "COMPLETED";

    if (!alreadyCompleted) {
      await sql.begin(async tx => {
        const updated = rows(await tx.unsafe(
          "update public.learning_tasks set status='COMPLETED',completed_at=now() where id=$1::uuid and plan_id=$2::uuid and status in ('PLANNED','IN_PROGRESS') returning id",
          [id, String(task.plan_id)]
        ));
        if (!updated[0]) throw new Error("TASK_NOT_COMPLETABLE");

        await tx.unsafe(
          "insert into public.agent_events(user_id,event_type,trigger_type,trigger_ref,summary,entity_refs,metadata) values ($1::uuid,'task.completed','LEARNING_TASK',$2,$3,$4::jsonb,$5::jsonb)",
          [
            user.id,
            id,
            "Completed " + String(task.title) + ".",
            JSON.stringify([
              { type: "learning_task", id },
              { type: "learning_plan", id: String(task.plan_id) },
              { type: "skill", id: String(task.skill_id) }
            ]),
            JSON.stringify({
              taskType: String(task.type),
              durationMinutes: Number(task.duration_minutes),
              planVersion: Number(task.plan_version)
            })
          ]
        );
      });
    }

    const evidence = await getEvidenceEngine().ingestBatch({
      userId: user.id,
      trigger: { type: "LEARNING_TASK_COMPLETED", ref: id },
      producerVersion: "task-completion-d1",
      candidates: [{
        skillId: String(task.skill_id),
        sourceType: "LEARNING_TASK_COMPLETED",
        sourceRef: id,
        sourceGroupId: "task:" + String(task.logical_task_id),
        claim: "Completed roadmap task: " + String(task.title),
        levelSignal: null,
        directness: 0.65,
        quality: 0.35,
        coverage: 0.20,
        metadata: {
          taskId: id,
          logicalTaskId: String(task.logical_task_id),
          taskType: String(task.type),
          durationMinutes: Number(task.duration_minutes),
          planVersion: Number(task.plan_version)
        },
        idempotencyKey: "learning-task:" + String(task.logical_task_id) + ":complete"
      }]
    });

    let replan: unknown = null;
    let replanWarning: string | null = null;
    if (!alreadyCompleted) {
      try {
        replan = await getAdaptiveReplannerService().considerEvidenceSignal({
          userId: user.id,
          triggerType: "TASK_BEHAVIOR",
          triggerRef: id,
          skillIds: [String(task.skill_id)],
          evidenceIds: evidence.acceptedEvidenceIds,
          gapSnapshotId: null
        });
      } catch (error) {
        replanWarning = "TASK_BEHAVIOR_REPLAN_FAILED";
        console.error("task.behavior.replan.failed", {
          taskId: id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return ok(requestId, {
      taskId: id,
      alreadyCompleted,
      status: "COMPLETED",
      evidence,
      replan,
      warnings: replanWarning ? [replanWarning] : []
    }, {
      skill_delta: evidence.deltas,
      notifications: [{
        title: alreadyCompleted ? "Task already complete" : "Learning activity completed",
        message: "Completion was logged. Passive completion alone does not prove proficiency; validation evidence carries more weight.",
        tone: "success"
      }]
    });
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return fail(requestId, 401, "UNAUTHENTICATED", "Sign in to update your roadmap.");
    }

    const message = error instanceof Error ? error.message : String(error);
    if (message === "TASK_NOT_COMPLETABLE") {
      return fail(requestId, 409, "TASK_NOT_COMPLETABLE", "This task can no longer be completed from the current state.");
    }

    console.error("task.complete.failed", { requestId, error: message });
    return fail(requestId, 500, "TASK_COMPLETE_FAILED", "Could not complete this learning task.");
  }
}
