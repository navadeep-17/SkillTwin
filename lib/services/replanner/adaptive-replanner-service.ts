import "server-only";
import { createHash } from "node:crypto";
import { getSql } from "@/lib/db/postgres";

export const REPLANNER_VERSION = "adaptive-replanner-f1";
export const REPLAN_VALIDATOR_VERSION = "replan-validator-f1";

type Row = Record<string, unknown>;

function rows(value: unknown): Row[] {
  return value as Row[];
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function jsonValue(value: unknown, fallback: unknown) {
  return value == null ? fallback : value;
}

function reinforcementTitle(weaknesses: string[]) {
  const updateSemantics = weaknesses.includes("put-vs-patch");
  const idempotency = weaknesses.includes("idempotency");
  if (updateSemantics && idempotency) return "HTTP update semantics + idempotency reinforcement";
  if (updateSemantics) return "PUT vs PATCH semantics reinforcement";
  if (idempotency) return "HTTP idempotency reinforcement";
  return "Targeted REST API reinforcement";
}

function dueInsideWeek(endDate: string) {
  const now = new Date();
  const proposed = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const end = new Date(endDate + "T12:00:00.000Z");
  return (proposed < end ? proposed : end).toISOString();
}

export interface AssessmentReplanInput {
  userId: string;
  assessmentId: string;
  skillId: string;
  weaknesses: string[];
  evidenceIds: string[];
  gapSnapshotId?: string | null;
}

export class AdaptiveReplannerService {
  async considerAssessment(input: AssessmentReplanInput) {
    const sql = getSql();

    const activeRows = rows(await sql.unsafe(
      "select p.*,g.adaptation_mode from public.learning_plans p join public.career_goals g on g.id=p.goal_id where p.user_id=$1::uuid and p.status='ACTIVE' order by p.version desc limit 1",
      [input.userId]
    ));
    const active = activeRows[0];

    const triggerMaterial = input.weaknesses.length > 0;

    if (!active) {
      return this.storeNoOp(input, null, "NO_ACTIVE_PLAN", "No active roadmap exists to adapt.");
    }

    const fingerprint = this.fingerprint(input, String(active.id), Number(active.version));
    const existingDiffRows = rows(await sql.unsafe(
      "select * from public.plan_diffs where user_id=$1::uuid and input_fingerprint=$2 limit 1",
      [input.userId, fingerprint]
    ));
    if (existingDiffRows[0]) return this.diffDto(existingDiffRows[0], true);

    const existingDecisionRows = rows(await sql.unsafe(
      "select * from public.replan_decisions where user_id=$1::uuid and input_fingerprint=$2 limit 1",
      [input.userId, fingerprint]
    ));
    if (existingDecisionRows[0] && !Boolean(existingDecisionRows[0].material)) {
      return {
        changed: false,
        reused: true,
        decision: existingDecisionRows[0]
      };
    }

    if (!triggerMaterial) {
      return this.storeNoOp(
        input,
        active,
        "NO_ACTIONABLE_WEAKNESS",
        "The completed assessment did not expose an actionable concept weakness.",
        fingerprint
      );
    }

    const objectiveRows = rows(await sql.unsafe(
      "select o.id objective_id,o.logical_objective_id,o.week_id,w.week_index,w.start_date,w.end_date,w.capacity_minutes,w.planned_minutes from public.learning_objectives o join public.plan_weeks w on w.id=o.week_id where o.plan_id=$1::uuid and o.skill_id=$2::uuid and o.status in ('PLANNED','IN_PROGRESS') and w.end_date>=current_date order by w.week_index limit 1",
      [String(active.id), input.skillId]
    ));
    const affected = objectiveRows[0];

    if (!affected) {
      return this.storeNoOp(
        input,
        active,
        "SKILL_OUTSIDE_ACTIVE_HORIZON",
        "The validated skill has no mutable future objective in the active roadmap.",
        fingerprint
      );
    }

    const reinforcementMinutes = 25;
    const capacityRemaining = Number(affected.capacity_minutes) - Number(affected.planned_minutes);
    if (capacityRemaining < reinforcementMinutes) {
      return this.storeNoOp(
        input,
        active,
        "NO_SAFE_CAPACITY",
        "The affected week has no safe capacity for reinforcement without moving existing work.",
        fingerprint
      );
    }

    if (String(active.adaptation_mode) !== "AUTOMATIC") {
      return this.createProposedDiff(input, active, affected, fingerprint, reinforcementMinutes);
    }

    return this.applyMinorAddTask(input, active, affected, fingerprint, reinforcementMinutes);
  }

  private fingerprint(
    input: AssessmentReplanInput,
    planId: string,
    version: number
  ) {
    return createHash("sha256")
      .update(JSON.stringify({
        assessmentId: input.assessmentId,
        skillId: input.skillId,
        weaknesses: [...input.weaknesses].sort(),
        evidenceIds: [...input.evidenceIds].sort(),
        gapSnapshotId: input.gapSnapshotId ?? null,
        planId,
        version,
        replannerVersion: REPLANNER_VERSION
      }))
      .digest("hex");
  }

  private async storeNoOp(
    input: AssessmentReplanInput,
    active: Row | null,
    reasonCode: string,
    reason: string,
    knownFingerprint?: string
  ) {
    const sql = getSql();
    const goalRows = active
      ? [active]
      : rows(await sql.unsafe(
          "select id goal_id from public.career_goals where user_id=$1::uuid and status='ACTIVE' limit 1",
          [input.userId]
        ));
    const goalId = active ? String(active.goal_id) : String(goalRows[0]?.goal_id ?? goalRows[0]?.id ?? "");
    if (!goalId) {
      return {
        changed: false,
        reused: false,
        decision: { material: false, reasonCode, reason }
      };
    }

    const fingerprint = knownFingerprint ?? createHash("sha256")
      .update(JSON.stringify({
        assessmentId: input.assessmentId,
        skillId: input.skillId,
        weaknesses: [...input.weaknesses].sort(),
        activePlanId: active?.id ?? null,
        activeVersion: active?.version ?? null,
        reasonCode,
        replannerVersion: REPLANNER_VERSION
      }))
      .digest("hex");

    const inserted = rows(await sql.unsafe(
      "insert into public.replan_decisions(user_id,goal_id,from_plan_id,from_version,trigger_type,trigger_ref,material,decision,reason_code,reason,input_fingerprint) values ($1::uuid,$2::uuid,$3::uuid,$4,'ASSESSMENT_COMPLETED',$5,false,'NO_OP',$6,$7,$8) on conflict(user_id,input_fingerprint) do update set input_fingerprint=excluded.input_fingerprint returning *",
      [
        input.userId,
        goalId,
        active?.id == null ? null : String(active.id),
        active?.version == null ? null : Number(active.version),
        input.assessmentId,
        reasonCode,
        reason,
        fingerprint
      ]
    ));

    return {
      changed: false,
      reused: false,
      decision: inserted[0]
    };
  }

  private async createProposedDiff(
    input: AssessmentReplanInput,
    active: Row,
    affected: Row,
    fingerprint: string,
    reinforcementMinutes: number
  ) {
    const sql = getSql();
    const operation = this.addOperation(input, affected, reinforcementMinutes);

    const diffRows = rows(await sql.unsafe(
      "insert into public.plan_diffs(user_id,goal_id,from_plan_id,from_version,status,trigger_type,trigger_refs,evidence_refs,summary,reason,operations,weekly_impact,timeline_impact,total_minute_delta,touch_count,complexity,can_undo,generator_version,validator_version,input_fingerprint) values ($1::uuid,$2::uuid,$3::uuid,$4,'PROPOSED','ASSESSMENT_COMPLETED',$5::jsonb,$6::jsonb,$7,$8,$9::jsonb,$10::jsonb,'NONE',$11,1,'MINOR',true,$12,$13,$14) returning *",
      [
        input.userId,
        String(active.goal_id),
        String(active.id),
        Number(active.version),
        JSON.stringify([input.assessmentId, input.gapSnapshotId].filter(Boolean)),
        JSON.stringify(input.evidenceIds),
        "Add targeted reinforcement after assessment",
        "The completed assessment exposed concept weaknesses that are still relevant to a future objective.",
        JSON.stringify([operation]),
        JSON.stringify([{
          weekIndex: Number(affected.week_index),
          beforeMinutes: Number(affected.planned_minutes),
          afterMinutes: Number(affected.planned_minutes) + reinforcementMinutes
        }]),
        reinforcementMinutes,
        REPLANNER_VERSION,
        REPLAN_VALIDATOR_VERSION,
        fingerprint
      ]
    ));

    await sql.unsafe(
      "insert into public.replan_decisions(user_id,goal_id,from_plan_id,from_version,trigger_type,trigger_ref,material,decision,reason_code,reason,input_fingerprint) values ($1::uuid,$2::uuid,$3::uuid,$4,'ASSESSMENT_COMPLETED',$5,true,'PROPOSE','ASSESSMENT_WEAKNESS_REINFORCEMENT',$6,$7) on conflict(user_id,input_fingerprint) do nothing",
      [
        input.userId,
        String(active.goal_id),
        String(active.id),
        Number(active.version),
        input.assessmentId,
        "Assessment weakness justifies a minimal reinforcement task.",
        fingerprint
      ]
    );

    return this.diffDto(diffRows[0], false);
  }

  private addOperation(input: AssessmentReplanInput, affected: Row, minutes: number) {
    return {
      type: "ADD_TASK",
      task: {
        logicalTaskId: null,
        taskId: null,
        objectiveLogicalId: String(affected.logical_objective_id),
        skillId: input.skillId,
        taskType: "PRACTICE",
        title: reinforcementTitle(input.weaknesses),
        durationMinutes: minutes,
        dueAt: dueInsideWeek(String(affected.end_date)),
        difficulty: "BASIC",
        rationaleCode: "ASSESSMENT_CONCEPT_WEAKNESS"
      },
      reasonRefs: [
        input.assessmentId,
        ...input.weaknesses.map(weakness => "concept:" + weakness)
      ]
    };
  }

  private async applyMinorAddTask(
    input: AssessmentReplanInput,
    active: Row,
    affected: Row,
    fingerprint: string,
    reinforcementMinutes: number
  ) {
    const sql = getSql();
    const operation = this.addOperation(input, affected, reinforcementMinutes);
    let appliedDiff: Row | null = null;

    await sql.begin(async tx => {
      const lockedRows = rows(await tx.unsafe(
        "select * from public.learning_plans where id=$1::uuid and user_id=$2::uuid for update",
        [String(active.id), input.userId]
      ));
      const locked = lockedRows[0];
      if (!locked || String(locked.status) !== "ACTIVE" || Number(locked.version) !== Number(active.version)) {
        throw new Error("STALE_BASELINE");
      }

      const activeCheck = rows(await tx.unsafe(
        "select id,version from public.learning_plans where goal_id=$1::uuid and status='ACTIVE' limit 1 for update",
        [String(active.goal_id)]
      ))[0];
      if (!activeCheck || String(activeCheck.id) !== String(active.id)) throw new Error("STALE_BASELINE");

      const diffRows = rows(await tx.unsafe(
        "insert into public.plan_diffs(user_id,goal_id,from_plan_id,from_version,status,trigger_type,trigger_refs,evidence_refs,summary,reason,operations,weekly_impact,timeline_impact,total_minute_delta,touch_count,complexity,can_undo,generator_version,validator_version,input_fingerprint) values ($1::uuid,$2::uuid,$3::uuid,$4,'PROPOSED','ASSESSMENT_COMPLETED',$5::jsonb,$6::jsonb,$7,$8,$9::jsonb,$10::jsonb,'NONE',$11,1,'MINOR',true,$12,$13,$14) returning *",
        [
          input.userId,
          String(active.goal_id),
          String(active.id),
          Number(active.version),
          JSON.stringify([input.assessmentId, input.gapSnapshotId].filter(Boolean)),
          JSON.stringify(input.evidenceIds),
          "Roadmap adapted after validation",
          "Assessment evidence exposed targeted concept weaknesses. SkillTwin inserted the smallest safe reinforcement patch.",
          JSON.stringify([operation]),
          JSON.stringify([{
            weekIndex: Number(affected.week_index),
            beforeMinutes: Number(affected.planned_minutes),
            afterMinutes: Number(affected.planned_minutes) + reinforcementMinutes
          }]),
          reinforcementMinutes,
          REPLANNER_VERSION,
          REPLAN_VALIDATOR_VERSION,
          fingerprint
        ]
      ));
      const diffId = String(diffRows[0].id);

      await tx.unsafe(
        "insert into public.replan_decisions(user_id,goal_id,from_plan_id,from_version,trigger_type,trigger_ref,material,decision,reason_code,reason,input_fingerprint) values ($1::uuid,$2::uuid,$3::uuid,$4,'ASSESSMENT_COMPLETED',$5,true,'APPLY','ASSESSMENT_WEAKNESS_REINFORCEMENT',$6,$7) on conflict(user_id,input_fingerprint) do nothing",
        [
          input.userId,
          String(active.goal_id),
          String(active.id),
          Number(active.version),
          input.assessmentId,
          "Assessment weakness justifies one targeted reinforcement task.",
          fingerprint
        ]
      );

      const nextVersion = Number(active.version) + 1;
      await tx.unsafe(
        "update public.learning_plans set status='SUPERSEDED' where id=$1::uuid and status='ACTIVE'",
        [String(active.id)]
      );

      const planRows = rows(await tx.unsafe(
        "insert into public.learning_plans(user_id,goal_id,version,status,start_date,end_date,gap_snapshot_id,constraint_fingerprint,planner_version,generation_key,planned_minutes,adaptation_buffer_minutes,rationale,warnings,parent_plan_id) values ($1::uuid,$2::uuid,$3,'ACTIVE',$4::date,$5::date,$6::uuid,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14::uuid) returning *",
        [
          input.userId,
          String(active.goal_id),
          nextVersion,
          String(active.start_date),
          String(active.end_date),
          input.gapSnapshotId ?? String(active.gap_snapshot_id),
          String(active.constraint_fingerprint),
          String(active.planner_version),
          "replan:" + diffId,
          Number(active.planned_minutes) + reinforcementMinutes,
          Number(active.adaptation_buffer_minutes),
          JSON.stringify(jsonValue(active.rationale, {})),
          JSON.stringify(jsonValue(active.warnings, [])),
          String(active.id)
        ]
      ));
      const nextPlanId = String(planRows[0].id);

      const oldWeeks = rows(await tx.unsafe(
        "select * from public.plan_weeks where plan_id=$1::uuid order by week_index",
        [String(active.id)]
      ));
      const weekMap = new Map<string,string>();

      for (const week of oldWeeks) {
        const isAffected = String(week.id) === String(affected.week_id);
        const inserted = rows(await tx.unsafe(
          "insert into public.plan_weeks(plan_id,week_index,start_date,end_date,capacity_minutes,planned_minutes,focus_skill_ids,rationale) values ($1::uuid,$2,$3::date,$4::date,$5,$6,$7::jsonb,$8) returning id",
          [
            nextPlanId,
            Number(week.week_index),
            String(week.start_date),
            String(week.end_date),
            Number(week.capacity_minutes),
            Number(week.planned_minutes) + (isAffected ? reinforcementMinutes : 0),
            JSON.stringify(jsonValue(week.focus_skill_ids, [])),
            week.rationale == null ? null : String(week.rationale)
          ]
        ));
        weekMap.set(String(week.id), String(inserted[0].id));
      }

      const oldObjectives = rows(await tx.unsafe(
        "select * from public.learning_objectives where plan_id=$1::uuid order by created_at,id",
        [String(active.id)]
      ));
      const objectiveMap = new Map<string,string>();

      for (const objective of oldObjectives) {
        const inserted = rows(await tx.unsafe(
          "insert into public.learning_objectives(plan_id,week_id,skill_id,requirement_id,type,start_score,target_score,success_criteria,priority_at_creation,status,logical_objective_id) values ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7,$8,$9,$10,$11::uuid) returning id",
          [
            nextPlanId,
            weekMap.get(String(objective.week_id)) ?? null,
            String(objective.skill_id),
            String(objective.requirement_id),
            String(objective.type),
            objective.start_score == null ? null : Number(objective.start_score),
            Number(objective.target_score),
            String(objective.success_criteria),
            Number(objective.priority_at_creation),
            String(objective.status),
            String(objective.logical_objective_id)
          ]
        ));
        objectiveMap.set(String(objective.id), String(inserted[0].id));
      }

      const oldTasks = rows(await tx.unsafe(
        "select * from public.learning_tasks where plan_id=$1::uuid order by created_at,id",
        [String(active.id)]
      ));
      const taskMap = new Map<string,string>();

      for (const task of oldTasks) {
        const inserted = rows(await tx.unsafe(
          "insert into public.learning_tasks(plan_id,week_id,objective_id,skill_id,type,title,duration_minutes,due_at,status,difficulty,flexible,rationale_code,inserted_by_plan_diff_id,completed_at,logical_task_id) values ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7,$8::timestamptz,$9,$10,$11,$12,$13::uuid,$14::timestamptz,$15::uuid) returning id",
          [
            nextPlanId,
            weekMap.get(String(task.week_id)) ?? null,
            objectiveMap.get(String(task.objective_id)) ?? null,
            String(task.skill_id),
            String(task.type),
            String(task.title),
            Number(task.duration_minutes),
            task.due_at == null ? null : String(task.due_at),
            String(task.status),
            String(task.difficulty),
            Boolean(task.flexible),
            String(task.rationale_code),
            task.inserted_by_plan_diff_id == null ? null : String(task.inserted_by_plan_diff_id),
            task.completed_at == null ? null : String(task.completed_at),
            String(task.logical_task_id)
          ]
        ));
        taskMap.set(String(task.id), String(inserted[0].id));
      }

      const oldAssignments = rows(await tx.unsafe(
        "select tra.* from public.task_resource_assignments tra join public.learning_tasks t on t.id=tra.task_id where t.plan_id=$1::uuid",
        [String(active.id)]
      ));
      for (const assignment of oldAssignments) {
        const newTaskId = taskMap.get(String(assignment.task_id));
        if (!newTaskId) continue;
        await tx.unsafe(
          "insert into public.task_resource_assignments(task_id,resource_id,rank_score,ranker_version,explanation) values ($1::uuid,$2::uuid,$3,$4,$5)",
          [
            newTaskId,
            String(assignment.resource_id),
            Number(assignment.rank_score),
            String(assignment.ranker_version),
            String(assignment.explanation)
          ]
        );
      }

      const newWeekId = weekMap.get(String(affected.week_id));
      const newObjectiveId = objectiveMap.get(String(affected.objective_id));
      if (!newWeekId || !newObjectiveId) throw new Error("REPLAN_REFERENCE_ERROR");

      const newTaskRows = rows(await tx.unsafe(
        "insert into public.learning_tasks(plan_id,week_id,objective_id,skill_id,type,title,duration_minutes,due_at,status,difficulty,flexible,rationale_code,inserted_by_plan_diff_id) values ($1::uuid,$2::uuid,$3::uuid,$4::uuid,'PRACTICE',$5,$6,$7::timestamptz,'PLANNED','BASIC',false,'ASSESSMENT_CONCEPT_WEAKNESS',$8::uuid) returning id,logical_task_id",
        [
          nextPlanId,
          newWeekId,
          newObjectiveId,
          input.skillId,
          reinforcementTitle(input.weaknesses),
          reinforcementMinutes,
          dueInsideWeek(String(affected.end_date)),
          diffId
        ]
      ));

      const operationApplied = {
        ...operation,
        task: {
          ...(operation as {task:Record<string,unknown>}).task,
          taskId: String(newTaskRows[0].id),
          logicalTaskId: String(newTaskRows[0].logical_task_id)
        }
      };

      const updatedDiffRows = rows(await tx.unsafe(
        "update public.plan_diffs set to_plan_id=$1::uuid,to_version=$2,status='APPLIED',operations=$3::jsonb,applied_at=now() where id=$4::uuid returning *",
        [nextPlanId, nextVersion, JSON.stringify([operationApplied]), diffId]
      ));
      appliedDiff = updatedDiffRows[0];

      await tx.unsafe(
        "insert into public.agent_events(user_id,event_type,trigger_type,trigger_ref,summary,entity_refs,evidence_refs,metadata) values ($1::uuid,'plan.adapted','ASSESSMENT_COMPLETED',$2,$3,$4::jsonb,$5::jsonb,$6::jsonb)",
        [
          input.userId,
          input.assessmentId,
          "Roadmap updated from Plan v" + active.version + " to v" + nextVersion + " with one targeted reinforcement task.",
          JSON.stringify([
            { type: "plan_diff", id: diffId },
            { type: "learning_plan", id: nextPlanId },
            { type: "assessment", id: input.assessmentId }
          ]),
          JSON.stringify(input.evidenceIds),
          JSON.stringify({
            operation: "ADD_TASK",
            weaknesses: input.weaknesses,
            minuteDelta: reinforcementMinutes
          })
        ]
      );
    });

    return this.diffDto(appliedDiff!, false);
  }

  private diffDto(diff: Row, reused: boolean) {
    return {
      changed: true,
      reused,
      diff: {
        diffId: String(diff.id),
        status: String(diff.status),
        fromPlanId: String(diff.from_plan_id),
        fromVersion: Number(diff.from_version),
        toPlanId: diff.to_plan_id ? String(diff.to_plan_id) : null,
        toVersion: diff.to_version == null ? null : Number(diff.to_version),
        headline: String(diff.summary),
        triggerLabel: "Completed assessment",
        whatChanged: Array.isArray(diff.operations) ? diff.operations : [],
        weeklyImpact: Array.isArray(diff.weekly_impact) ? diff.weekly_impact : [],
        timelineImpact: String(diff.timeline_impact),
        totalMinuteDelta: Number(diff.total_minute_delta),
        touchCount: Number(diff.touch_count),
        complexity: String(diff.complexity),
        canUndo: Boolean(diff.can_undo),
        reason: String(diff.reason)
      }
    };
  }
}

let service: AdaptiveReplannerService | null = null;

export function getAdaptiveReplannerService() {
  if (!service) service = new AdaptiveReplannerService();
  return service;
}
