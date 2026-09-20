import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";
import { getSql } from "@/lib/db/postgres";
import { getAdaptiveReplannerService } from "@/lib/services/replanner/adaptive-replanner-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;
const rows = (value: unknown) => value as Row[];

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

function stringArray(value: unknown): string[] {
  const parsed = parseJson(value);
  return Array.isArray(parsed) ? parsed.map(String) : [];
}

export async function POST() {
  const requestId = await getRequestId();

  try {
    const { user } = await requireUser();
    const sql = getSql();

    const pending = rows(await sql.unsafe(
      `select
         a.id assessment_id,
         a.skill_id,
         o.weaknesses,
         o.evidence_batch_result,
         o.gap_snapshot_id
       from public.skill_assessments a
       join public.skill_assessment_outcomes o on o.assessment_id=a.id
       where a.user_id=$1::uuid
         and a.status='COMPLETED'
         and not exists (
           select 1
           from public.replan_decisions rd
           where rd.user_id=a.user_id
             and rd.trigger_type='ASSESSMENT_COMPLETED'
             and rd.trigger_ref=a.id::text
         )
       order by a.completed_at desc
       limit 3`,
      [user.id]
    ));

    const recovered: unknown[] = [];

    for (const item of pending) {
      const evidence = parseJson(item.evidence_batch_result);
      const evidenceIds = evidence && typeof evidence === "object" && !Array.isArray(evidence)
        ? stringArray((evidence as Record<string, unknown>).acceptedEvidenceIds)
        : [];

      try {
        const result = await getAdaptiveReplannerService().considerAssessment({
          userId: user.id,
          assessmentId: String(item.assessment_id),
          skillId: String(item.skill_id),
          weaknesses: stringArray(item.weaknesses),
          evidenceIds,
          gapSnapshotId: item.gap_snapshot_id ? String(item.gap_snapshot_id) : null
        });
        recovered.push(result);
      } catch (error) {
        console.error("roadmap.sync.replan.failed", {
          requestId,
          assessmentId: String(item.assessment_id),
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return ok(requestId, {
      checked: pending.length,
      recovered
    });
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return fail(requestId, 401, "UNAUTHENTICATED", "Sign in to synchronize your roadmap.");
    }

    console.error("roadmap.sync.failed", {
      requestId,
      error: error instanceof Error ? error.message : String(error)
    });
    return fail(requestId, 500, "ROADMAP_SYNC_FAILED", "Could not synchronize the roadmap.");
  }
}
