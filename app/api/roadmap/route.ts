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
      const { data: bankRows, error: bankError } = await supabase
        .from("assessment_question_bank")
        .select("id,skill_id")
        .in("skill_id", skillIds)
        .eq("is_active", true)
        .eq("type", "MCQ");
      if (bankError) throw bankError;
      for (const row of bankRows ?? []) {
        const key = String(row.skill_id);
        validationCounts.set(key, (validationCounts.get(key) ?? 0) + 1);
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
              resource: assignmentMap.get(task.id) ?? null
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

    console.error("roadmap.read.failed", {
      requestId,
      error: error instanceof Error ? error.message : String(error)
    });
    return fail(requestId, 500, "INTERNAL_ERROR", "Could not load the active roadmap.");
  }
}
