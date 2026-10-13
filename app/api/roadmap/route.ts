import { getSql } from "@/lib/db/postgres";
import { recommendCuratedResources, type LearnerLevel, type LearningTaskType } from "@/lib/domain/curated-learning-resources";
import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return value ? [value] : [];
    }
  }
  return [];
}

export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = await getRequestId();

  try {
    const { user, supabase } = await requireUser();

    const { data: plan, error: planError } = await supabase
      .from("learning_plans")
      .select("id,goal_id,version,status,start_date,end_date,gap_snapshot_id,planned_minutes,adaptation_buffer_minutes,rationale,warnings,planner_version,created_at")
      .eq("user_id", user.id)
      .eq("status", "ACTIVE")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (planError) throw planError;
    if (!plan) return ok(requestId, { plan: null });

    const { data: weeks, error: weekError } = await supabase
      .from("plan_weeks")
      .select("id,week_index,start_date,end_date,capacity_minutes,planned_minutes,focus_skill_ids,rationale")
      .eq("plan_id", plan.id)
      .order("week_index");

    if (weekError) throw weekError;

    const { data: objectives, error: objectiveError } = await supabase
      .from("learning_objectives")
      .select("id,week_id,skill_id,requirement_id,type,start_score,target_score,success_criteria,priority_at_creation,status,skills!inner(slug,canonical_name,category)")
      .eq("plan_id", plan.id);

    if (objectiveError) throw objectiveError;

    const { data: tasks, error: taskError } = await supabase
      .from("learning_tasks")
      .select("id,week_id,objective_id,skill_id,type,title,duration_minutes,due_at,status,difficulty,flexible,rationale_code")
      .eq("plan_id", plan.id)
      .order("due_at");

    if (taskError) throw taskError;

    const taskIds = (tasks ?? []).map(task => task.id);
    const skillIds = [...new Set((tasks ?? []).map(task => String(task.skill_id)))];
    let assignments: Array<Record<string, unknown>> = [];
    const validationCounts = new Map<string, number>();

    if (skillIds.length) {
      // The answer-bearing question bank is intentionally inaccessible through
      // the learner's PostgREST role (migration 0025). Read only aggregate
      // availability counts via the server-owned database connection.
      const bankRows = await getSql().unsafe(
        "select skill_id::text as skill_id, count(*)::integer as question_count from public.assessment_question_bank where is_active = true and type in ('MCQ','SHORT_TEXT','SCENARIO') and skill_id = any($1::uuid[]) group by skill_id",
        [skillIds]
      );
      for (const row of bankRows) {
        validationCounts.set(String(row.skill_id), Number(row.question_count));
      }
    }

    if (taskIds.length) {
      const { data, error } = await supabase
        .from("task_resource_assignments")
        .select("task_id,resource_id,rank_score,ranker_version,explanation,learning_resources!inner(id,title,provider,url,format,duration_minutes,quality)")
        .in("task_id", taskIds);
      if (error) throw error;
      assignments = data ?? [];
    }

    const objectiveMap = new Map((objectives ?? []).map(objective => [objective.id, objective]));
    const assignmentMap = new Map(assignments.map(assignment => [String(assignment.task_id), assignment]));

    const weekDtos = (weeks ?? []).map(week => ({
      ...week,
      objectives: (objectives ?? [])
        .filter(objective => objective.week_id === week.id)
        .map(objective => ({
          ...objective,
          tasks: (tasks ?? [])
            .filter(task => task.objective_id === objective.id)
            .map(task => ({
              ...task,
              validation_available: task.type !== "VALIDATE" || (validationCounts.get(String(task.skill_id)) ?? 0) >= 4,
              resource: assignmentMap.get(task.id) ?? null,
              recommended_resources: recommendCuratedResources({
                skillSlug: String((objective.skills as {slug?:string} | null)?.slug ?? ""),
                taskType: task.type as LearningTaskType,
                difficulty: task.difficulty as LearnerLevel,
                durationMinutes: Number(task.duration_minutes)
              })
            }))
        }))
    }));

    return ok(requestId, {
      plan: {
        ...plan,
        warnings: stringArray(plan.warnings),
        weeks: weekDtos,
        counts: {
          weeks: weekDtos.length,
          objectives: objectiveMap.size,
          tasks: tasks?.length ?? 0
        }
      }
    });
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return fail(requestId, 401, "UNAUTHENTICATED", "Sign in to view your roadmap.");
    }

    // PostgREST errors are plain objects, not Error instances. Preserve
    // sanitized diagnostic fields instead of logging "[object Object]".
    const details = error && typeof error === "object"
      ? error as Record<string, unknown>
      : {};
    console.error("roadmap.read.failed", {
      requestId,
      code: typeof details.code === "string" ? details.code : null,
      message: error instanceof Error ? error.message
        : typeof details.message === "string" ? details.message : "Unknown roadmap read error",
      hint: typeof details.hint === "string" ? details.hint : null
    });
    return fail(requestId, 500, "INTERNAL_ERROR", "Could not load the active roadmap.");
  }
}
