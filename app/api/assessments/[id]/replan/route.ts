import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";
import { getSql } from "@/lib/db/postgres";
import { getAdaptiveReplannerService } from "@/lib/services/replanner/adaptive-replanner-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

function rows(value: unknown): Row[] {
  return value as Row[];
}

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

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const requestId = await getRequestId();

  try {
    const { user } = await requireUser();
    const { id } = await context.params;
    const sql = getSql();

    const assessment = rows(await sql.unsafe(
      "select id,skill_id,status from public.skill_assessments where id=$1::uuid and user_id=$2::uuid limit 1",
      [id, user.id]
    ))[0];

    if (!assessment) {
      return fail(requestId, 404, "ASSESSMENT_NOT_FOUND", "Assessment not found.");
    }
    if (String(assessment.status) !== "COMPLETED") {
      return fail(requestId, 409, "ASSESSMENT_NOT_COMPLETED", "Complete the assessment before adapting the roadmap.");
    }

    const outcome = rows(await sql.unsafe(
      "select weaknesses,evidence_batch_result,gap_snapshot_id from public.skill_assessment_outcomes where assessment_id=$1::uuid and user_id=$2::uuid limit 1",
      [id, user.id]
    ))[0];

    if (!outcome) {
      return fail(requestId, 409, "ASSESSMENT_OUTCOME_NOT_FOUND", "Assessment outcome is not available yet.");
    }

    const evidence = parseJson(outcome.evidence_batch_result);
    const evidenceIds = evidence && typeof evidence === "object" && !Array.isArray(evidence)
      ? stringArray((evidence as Record<string, unknown>).acceptedEvidenceIds)
      : [];

    const result = await getAdaptiveReplannerService().considerAssessment({
      userId: user.id,
      assessmentId: id,
      skillId: String(assessment.skill_id),
      weaknesses: stringArray(outcome.weaknesses),
      evidenceIds,
      gapSnapshotId: outcome.gap_snapshot_id ? String(outcome.gap_snapshot_id) : null
    });

    return ok(requestId, { replan: result });
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return fail(requestId, 401, "UNAUTHENTICATED", "Sign in to adapt your roadmap.");
    }

    console.error("assessment.replan.retry.failed", {
      requestId,
      error: error instanceof Error ? error.message : String(error)
    });

    return fail(requestId, 500, "REPLAN_RETRY_FAILED", "Could not adapt the roadmap yet.");
  }
}
