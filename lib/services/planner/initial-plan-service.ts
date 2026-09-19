import "server-only";
import { createHash } from "node:crypto";
import { getSql } from "@/lib/db/postgres";
import {
  generateInitialLearningPlan,
  PLANNER_VERSION,
  type PlannerGap,
  type PlannerConstraints,
  type GeneratedTask
} from "@/lib/domain/learning-planner";

const RESOURCE_CATALOG_VERSION = "resource-catalog-d1";

type Row = Record<string, unknown>;

function rows(value: unknown): Row[] {
  return value as Row[];
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function dueAt(weekStart: Date, dayName: string) {
  const order: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6
  };
  const wanted = order[dayName] ?? 1;
  const current = weekStart.getUTCDay();
  const offset = (wanted - current + 7) % 7;
  const date = addDays(weekStart, offset);
  date.setUTCHours(12, 0, 0, 0);
  return date.toISOString();
}

function jsonArray(value: unknown, fallback: string[]) {
  if (Array.isArray(value)) return value.map(String);
  return fallback;
}

function catalogTags(value: unknown) {
  return Array.isArray(value) ? value.map(String) : [];
}

function resourceScore(resource: Row, task: GeneratedTask, preferredSessionMinutes: number) {
  const tags = catalogTags(resource.tags);
  if (!task.resourceTag || !tags.includes(task.resourceTag)) return -1;
  const quality = Number(resource.quality ?? 0);
  const duration = Number(resource.duration_minutes ?? preferredSessionMinutes);
  const durationFit = Math.max(0, 1 - Math.abs(duration - preferredSessionMinutes) / Math.max(preferredSessionMinutes, 1));
  return Number((0.8 * quality + 0.2 * durationFit).toFixed(4));
}

export class InitialPlanService {
  async generate(userId: string) {
    const sql = getSql();

    const goalRows = rows(await sql.unsafe(
      "select * from public.career_goals where user_id=$1::uuid and status='ACTIVE' limit 1",
      [userId]
    ));
    const goal = goalRows[0];
    if (!goal) throw new Error("ACTIVE_GOAL_NOT_FOUND");

    const existingActive = rows(await sql.unsafe(
      "select id,version,generation_key from public.learning_plans where goal_id=$1::uuid and status='ACTIVE' limit 1",
      [String(goal.id)]
    ));
    if (existingActive[0]) {
      return {
        planId: String(existingActive[0].id),
        version: Number(existingActive[0].version),
        reused: true,
        reason: "ACTIVE_BASELINE_ALREADY_EXISTS"
      };
    }

    const snapshotRows = rows(await sql.unsafe(
      "select * from public.gap_snapshots where user_id=$1::uuid and goal_id=$2::uuid order by created_at desc limit 1",
      [userId, String(goal.id)]
    ));
    const snapshot = snapshotRows[0];
    if (!snapshot) throw new Error("GAP_SNAPSHOT_NOT_FOUND");

    const gapRows = rows(await sql.unsafe(
      "select sgr.*,rsr.learning_stage,s.canonical_name,s.slug from public.skill_gap_results sgr join public.role_skill_requirements rsr on rsr.id=sgr.requirement_id join public.skills s on s.id=sgr.skill_id where sgr.snapshot_id=$1::uuid order by sgr.priority_score desc,s.canonical_name",
      [String(snapshot.id)]
    ));

    const gaps: PlannerGap[] = gapRows.map(row => ({
      requirementId: String(row.requirement_id),
      skillId: String(row.skill_id),
      skillName: String(row.canonical_name),
      skillSlug: String(row.slug),
      currentScore: row.current_score == null ? null : Number(row.current_score),
      currentConfidence: Number(row.current_confidence),
      targetScore: Number(row.target_score),
      priorityScore: Number(row.priority_score),
      priorityBand: String(row.priority_band) as PlannerGap["priorityBand"],
      status: String(row.status) as PlannerGap["status"],
      recommendedAction: String(row.recommended_action) as PlannerGap["recommendedAction"],
      learningStage: Number(row.learning_stage) as PlannerGap["learningStage"]
    }));

    const constraints: PlannerConstraints = {
      hoursPerWeek: Number(goal.hours_per_week),
      learningDays: jsonArray(goal.learning_days, ["Mon","Tue","Wed","Thu","Fri","Sat"]),
      preferredSessionMinutes: Number(goal.preferred_session_minutes),
      minSessionMinutes: Number(goal.min_session_minutes)
    };

    const constraintFingerprint = createHash("sha256")
      .update(JSON.stringify(constraints))
      .digest("hex");

    const generationKey = createHash("sha256")
      .update([
        userId,
        String(goal.id),
        String(goal.role_version_id),
        String(snapshot.id),
        constraintFingerprint,
        PLANNER_VERSION,
        RESOURCE_CATALOG_VERSION
      ].join("|"))
      .digest("hex");

    const existingGeneration = rows(await sql.unsafe(
      "select result_plan_id from public.plan_generation_runs where generation_key=$1 and status='COMPLETE' limit 1",
      [generationKey]
    ));
    if (existingGeneration[0]?.result_plan_id) {
      return {
        planId: String(existingGeneration[0].result_plan_id),
        version: 1,
        reused: true,
        reason: "GENERATION_KEY_REPLAY"
      };
    }

    const generated = generateInitialLearningPlan(gaps, constraints, 4);
    const resourceRows = rows(await sql.unsafe(
      "select * from public.learning_resources where is_verified=true and status='ACTIVE' and catalog_version=$1 order by quality desc,title",
      [RESOURCE_CATALOG_VERSION]
    ));

    const runRows = rows(await sql.unsafe(
      "insert into public.plan_generation_runs(user_id,goal_id,gap_snapshot_id,constraint_fingerprint,generation_key,status,warnings,planner_version) values ($1::uuid,$2::uuid,$3::uuid,$4,$5,'RUNNING',$6::jsonb,$7) returning id",
      [
        userId,
        String(goal.id),
        String(snapshot.id),
        constraintFingerprint,
        generationKey,
        JSON.stringify(generated.warnings),
        PLANNER_VERSION
      ]
    ));
    const generationRunId = String(runRows[0].id);

    let planId = "";

    try {
      await sql.begin(async tx => {
        const start = new Date();
        start.setUTCHours(0,0,0,0);
        const end = addDays(start, Math.max(generated.weeks.length * 7 - 1, 0));
        const rationale = {
          selected: generated.selectedSkillIds,
          deferred: generated.deferredSkillIds,
          capacity: {
            weekly: generated.weeklyCapacityMinutes,
            buffer: generated.adaptationBufferMinutes,
            planned: generated.weeks.reduce((sum, week) => sum + week.plannedMinutes, 0)
          },
          reasonCodes: ["PRIORITY_FIRST","PREREQUISITE_STAGE_ORDER","ADAPTATION_BUFFER_RESERVED"]
        };

        const planRows = rows(await tx.unsafe(
          "insert into public.learning_plans(user_id,goal_id,version,status,start_date,end_date,gap_snapshot_id,constraint_fingerprint,planner_version,generation_key,planned_minutes,adaptation_buffer_minutes,rationale,warnings) values ($1::uuid,$2::uuid,1,'ACTIVE',$3::date,$4::date,$5::uuid,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb) returning id",
          [
            userId,
            String(goal.id),
            dateOnly(start),
            dateOnly(end),
            String(snapshot.id),
            constraintFingerprint,
            PLANNER_VERSION,
            generationKey,
            generated.weeks.reduce((sum, week) => sum + week.plannedMinutes, 0),
            generated.adaptationBufferMinutes,
            JSON.stringify(rationale),
            JSON.stringify(generated.warnings)
          ]
        ));
        planId = String(planRows[0].id);

        for (const week of generated.weeks) {
          const weekStart = addDays(start, (week.weekIndex - 1) * 7);
          const weekEnd = addDays(weekStart, 6);
          const weekRows = rows(await tx.unsafe(
            "insert into public.plan_weeks(plan_id,week_index,start_date,end_date,capacity_minutes,planned_minutes,focus_skill_ids,rationale) values ($1::uuid,$2,$3::date,$4::date,$5,$6,$7::jsonb,$8) returning id",
            [
              planId,
              week.weekIndex,
              dateOnly(weekStart),
              dateOnly(weekEnd),
              week.capacityMinutes,
              week.plannedMinutes,
              JSON.stringify(week.focusSkillIds),
              "Focus is constrained to prerequisite-stage order and at most two related skills."
            ]
          ));
          const weekId = String(weekRows[0].id);

          for (const objective of week.objectives) {
            const objectiveRows = rows(await tx.unsafe(
              "insert into public.learning_objectives(plan_id,week_id,skill_id,requirement_id,type,start_score,target_score,success_criteria,priority_at_creation,status) values ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7,$8,$9,'PLANNED') returning id",
              [
                planId,
                weekId,
                objective.skillId,
                objective.requirementId,
                objective.type,
                objective.startScore,
                objective.targetScore,
                objective.successCriteria,
                objective.priorityAtCreation
              ]
            ));
            const objectiveId = String(objectiveRows[0].id);

            for (const task of objective.tasks) {
              const taskRows = rows(await tx.unsafe(
                "insert into public.learning_tasks(plan_id,week_id,objective_id,skill_id,type,title,duration_minutes,due_at,status,difficulty,flexible,rationale_code) values ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7,$8::timestamptz,'PLANNED',$9,$10,$11) returning id",
                [
                  planId,
                  weekId,
                  objectiveId,
                  task.skillId,
                  task.type,
                  task.title,
                  task.durationMinutes,
                  dueAt(weekStart, task.day),
                  task.difficulty,
                  task.flexible,
                  task.rationaleCode
                ]
              ));
              const taskId = String(taskRows[0].id);

              if (task.resourceTag) {
                const ranked = resourceRows
                  .map(resource => ({
                    resource,
                    score: resourceScore(resource, task, constraints.preferredSessionMinutes)
                  }))
                  .filter(item => item.score >= 0)
                  .sort((a,b) => b.score - a.score || String(a.resource.title).localeCompare(String(b.resource.title)));

                const chosen = ranked[0];
                if (chosen) {
                  await tx.unsafe(
                    "insert into public.task_resource_assignments(task_id,resource_id,rank_score,ranker_version,explanation) values ($1::uuid,$2::uuid,$3,'resource-ranker-d1',$4)",
                    [
                      taskId,
                      String(chosen.resource.id),
                      chosen.score,
                      "Verified resource matched canonical skill tag, quality, and session-duration fit."
                    ]
                  );
                }
              }
            }
          }
        }

        await tx.unsafe(
          "insert into public.agent_events(user_id,event_type,trigger_type,trigger_ref,summary,entity_refs,metadata) values ($1::uuid,'plan.created','GAP_SNAPSHOT',$2,$3,$4::jsonb,$5::jsonb)",
          [
            userId,
            String(snapshot.id),
            "Created LearningPlan v1 with " + generated.weeks.length + " weeks while reserving " + generated.adaptationBufferMinutes + " minutes/week for adaptation.",
            JSON.stringify([{type:"learning_plan",id:planId},{type:"gap_snapshot",id:String(snapshot.id)}]),
            JSON.stringify({
              plannerVersion: PLANNER_VERSION,
              plannedMinutes: generated.weeks.reduce((sum, week) => sum + week.plannedMinutes, 0),
              adaptationBufferMinutes: generated.adaptationBufferMinutes
            })
          ]
        );
      });

      await sql.unsafe(
        "update public.plan_generation_runs set status='COMPLETE',result_plan_id=$1::uuid,completed_at=now() where id=$2::uuid",
        [planId, generationRunId]
      );

      return {
        planId,
        version: 1,
        reused: false,
        warnings: generated.warnings,
        weeks: generated.weeks.length
      };
    } catch (error) {
      await sql.unsafe(
        "update public.plan_generation_runs set status='FAILED',error_code='PLAN_GENERATION_FAILED',error_message=$1,completed_at=now() where id=$2::uuid",
        [error instanceof Error ? error.message.slice(0,1200) : String(error).slice(0,1200), generationRunId]
      );
      throw error;
    }
  }
}

let service: InitialPlanService | null = null;

export function getInitialPlanService() {
  if (!service) service = new InitialPlanService();
  return service;
}
