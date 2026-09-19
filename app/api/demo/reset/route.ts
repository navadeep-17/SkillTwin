import { createHash, timingSafeEqual } from "node:crypto";
import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";
import { getServerEnv } from "@/lib/config/env";
import { getSql } from "@/lib/db/postgres";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function secretMatches(provided: string, expected: string) {
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const requestId = await getRequestId();

  try {
    const { user, supabase } = await requireUser();
    const env = getServerEnv();

    if (env.DEMO_FALLBACK_ENABLED !== "true" || !env.DEMO_RESET_SECRET) {
      return fail(requestId, 404, "NOT_FOUND", "Demo reset is not enabled.");
    }

    const provided = request.headers.get("x-skilltwin-demo-secret") ?? "";
    if (!provided || !secretMatches(provided, env.DEMO_RESET_SECRET)) {
      return fail(requestId, 403, "FORBIDDEN", "Invalid demo reset credential.");
    }

    const sql = getSql();
    const documentRows = await sql.unsafe(
      "select storage_path from public.profile_documents where user_id=$1::uuid order by created_at",
      [user.id]
    ) as Array<Record<string, unknown>>;

    const storagePaths = documentRows
      .map(row => String(row.storage_path ?? ""))
      .filter(Boolean);

    if (storagePaths.length) {
      const { error: storageError } = await supabase.storage
        .from("profile-documents")
        .remove(storagePaths);

      if (storageError) {
        throw new Error("DEMO_RESET_STORAGE_FAILED:" + storageError.message);
      }
    }

    const deleted = await sql.begin(async tx => {
      const counts: Record<string, number> = {};

      async function remove(label: string, query: string) {
        const result = await tx.unsafe(query, [user.id]);
        counts[label] = Number(result.count ?? 0);
      }

      await remove("journeyThreads", "delete from public.journey_chat_threads where user_id=$1::uuid");
      await remove("assessments", "delete from public.skill_assessments where user_id=$1::uuid");
      await remove("replanDecisions", "delete from public.replan_decisions where user_id=$1::uuid");
      await remove("planDiffs", "delete from public.plan_diffs where user_id=$1::uuid");
      await remove("planGenerationRuns", "delete from public.plan_generation_runs where user_id=$1::uuid");
      await remove("learningPlans", "delete from public.learning_plans where user_id=$1::uuid");
      await remove("skillGapResults", "delete from public.skill_gap_results where user_id=$1::uuid");
      await remove("gapSnapshots", "delete from public.gap_snapshots where user_id=$1::uuid");
      await remove("careerGoals", "delete from public.career_goals where user_id=$1::uuid");
      await remove("profileAnalysisRuns", "delete from public.profile_analysis_runs where user_id=$1::uuid");
      await remove("profileDocuments", "delete from public.profile_documents where user_id=$1::uuid");
      await remove("skillHistory", "delete from public.skill_history where user_id=$1::uuid");
      await remove("skillEvidence", "delete from public.skill_evidence where user_id=$1::uuid");
      await remove("userSkills", "delete from public.user_skills where user_id=$1::uuid");
      await remove("agentEvents", "delete from public.agent_events where user_id=$1::uuid");

      return counts;
    });

    return ok(
      requestId,
      {
        reset: true,
        userId: user.id,
        removedStorageObjects: storagePaths.length,
        deleted,
        preserved: [
          "auth.users",
          "public.users",
          "skills",
          "skill_aliases",
          "target_roles",
          "role_versions",
          "role requirements",
          "learning_resources",
          "assessment_question_bank"
        ]
      },
      {
        notifications: [{
          title: "Demo learner reset",
          message: "Learner-specific SkillTwin state was cleared. The next profile analysis will recreate the default Backend Engineer goal.",
          tone: "success"
        }],
        next_action: {
          type: "OPEN_ONBOARDING",
          label: "Start demo again",
          href: "/onboarding"
        }
      }
    );
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return fail(requestId, 401, "UNAUTHENTICATED", "Sign in before resetting demo state.");
    }

    console.error("demo.reset.failed", {
      requestId,
      error: error instanceof Error ? error.message : String(error)
    });
    return fail(requestId, 500, "DEMO_RESET_FAILED", "Could not reset this demo learner safely.");
  }
}
