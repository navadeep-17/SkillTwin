import "server-only";
import { createHash } from "node:crypto";
import { getSql } from "@/lib/db/postgres";

export const REPLANNER_VERSION = "adaptive-replanner-f1";
export const REPLAN_VALIDATOR_VERSION = "replan-validator-f1";

type Row = Record<string, unknown>;

function rows(value: unknown): Row[] {
  return value as Row[];
}

function parseJsonValue(value: unknown): unknown {
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

function arrayOfStrings(value: unknown): string[] {
  const parsed = parseJsonValue(value);
  return Array.isArray(parsed) ? parsed.map(String) : [];
}

function jsonValue(value: unknown, fallback: unknown) {
  const parsed = parseJsonValue(value);
  return parsed == null ? fallback : parsed;
}

function dateOnly(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value ?? "").trim();
  const match = text.match(/^\d{4}-\d{2}-\d{2}/);
  if (match) return match[0];
  const parsed = new Date(text);
  if (!Number.isFinite(parsed.getTime())) throw new Error("INVALID_PLAN_DATE");
  return parsed.toISOString().slice(0, 10);
}

function reinforcementTitle(weaknesses: string[], skillName?: string) {
  const updateSemantics = weaknesses.includes("put-vs-patch");
  const idempotency = weaknesses.includes("idempotency");
  if ((skillName ?? "").toLowerCase().includes("rest")) {
    if (updateSemantics && idempotency) return "HTTP update semantics + idempotency reinforcement";
    if (updateSemantics) return "PUT vs PATCH semantics reinforcement";
    if (idempotency) return "HTTP idempotency reinforcement";
  }
  return "Targeted " + (skillName || "skill") + " concept reinforcement";
}

function dueInsideWeek(endDate: unknown) {
  const now = new Date();
  const proposed = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const normalizedEnd = dateOnly(endDate);
  const end = new Date(normalizedEnd + "T12:00:00.000Z");
  if (!Number.isFinite(end.getTime())) throw new Error("INVALID_PLAN_DATE");
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
      "select o.id objective_id,o.logical_objective_id,o.week_id,w.week_index,w.start_date,w.end_date,w.capacity_minutes,w.planned_minutes,s.canonical_name skill_name from public.learning_objectives o join public.plan_weeks w on w.id=o.week_id join public.skills s on s.id=o.skill_id where o.plan_id=$1::uuid and o.skill_id=$2::uuid and o.status in ('PLANNED','IN_PROGRESS') and w.end_date>=current_date order by w.week_index limit 1",
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
        title: reinforcementTitle(input.weaknesses, String(affected.skill_name ?? "skill")),
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
          dateOnly(active.start_date),
          dateOnly(active.end_date),
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
            dateOnly(week.start_date),
            dateOnly(week.end_date),
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
          reinforcementTitle(input.weaknesses, String(affected.skill_name ?? "skill")),
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

  async applyProposed(userId: string, diffId: string) {
    const sql = getSql();

    const diffRows = rows(await sql.unsafe(
      "select * from public.plan_diffs where id=$1::uuid and user_id=$2::uuid limit 1",
      [diffId, userId]
    ));
    const diff = diffRows[0];
    if (!diff) throw new Error("PLAN_DIFF_NOT_FOUND");
    if (String(diff.status) === "APPLIED") return this.diffDto(diff, true);
    if (String(diff.status) !== "PROPOSED") throw new Error("PLAN_DIFF_NOT_APPLICABLE");

    const operationsValue = parseJsonValue(diff.operations);
    const operations = Array.isArray(operationsValue)
      ? operationsValue as Array<Record<string, unknown>>
      : [];
    if (operations.length !== 1 || String(operations[0].type) !== "ADD_TASK") {
      throw new Error("PLAN_DIFF_UNSUPPORTED_PATCH_SHAPE");
    }

    const operation = operations[0];
    const taskValue = operation.task;
    const task = taskValue && typeof taskValue === "object" && !Array.isArray(taskValue)
      ? taskValue as Record<string, unknown>
      : {};
    const objectiveLogicalId = String(task.objectiveLogicalId ?? "");
    const skillId = String(task.skillId ?? "");
    const duration = Number(task.durationMinutes ?? 0);
    const title = String(task.title ?? "");
    const dueAt = task.dueAt == null ? null : String(task.dueAt);
    const taskType = String(task.taskType ?? "PRACTICE");
    const difficulty = String(task.difficulty ?? "BASIC");
    const rationaleCode = String(task.rationaleCode ?? "ASSESSMENT_CONCEPT_WEAKNESS");

    if (!objectiveLogicalId || !skillId || !title || !Number.isFinite(duration) || duration <= 0) {
      throw new Error("PLAN_DIFF_INVALID_OPERATION");
    }
    if (!["LEARN","PRACTICE","BUILD","VALIDATE"].includes(taskType)) throw new Error("PLAN_DIFF_INVALID_OPERATION");
    if (!["BASIC","STANDARD","ADVANCED"].includes(difficulty)) throw new Error("PLAN_DIFF_INVALID_OPERATION");

    const activeRows = rows(await sql.unsafe(
      "select * from public.learning_plans where id=$1::uuid and user_id=$2::uuid and status='ACTIVE' limit 1",
      [String(diff.from_plan_id), userId]
    ));
    const active = activeRows[0];
    if (!active || Number(active.version) !== Number(diff.from_version)) {
      throw new Error("PLAN_DIFF_STALE_BASELINE");
    }

    const affectedRows = rows(await sql.unsafe(
      "select o.id objective_id,o.logical_objective_id,o.week_id,w.week_index,w.capacity_minutes,w.planned_minutes from public.learning_objectives o join public.plan_weeks w on w.id=o.week_id where o.plan_id=$1::uuid and o.logical_objective_id=$2::uuid limit 1",
      [String(active.id), objectiveLogicalId]
    ));
    const affected = affectedRows[0];
    if (!affected) throw new Error("PLAN_DIFF_REFERENCE_ERROR");
    if (Number(affected.planned_minutes) + duration > Number(affected.capacity_minutes)) {
      throw new Error("PLAN_DIFF_CAPACITY_EXCEEDED");
    }

    let applied: Row | null = null;

    await sql.begin(async tx => {
      const locked = rows(await tx.unsafe(
        "select * from public.learning_plans where id=$1::uuid and user_id=$2::uuid for update",
        [String(active.id), userId]
      ))[0];
      if (!locked || String(locked.status) !== "ACTIVE" || Number(locked.version) !== Number(active.version)) {
        throw new Error("PLAN_DIFF_STALE_BASELINE");
      }

      const latestDiff = rows(await tx.unsafe(
        "select * from public.plan_diffs where id=$1::uuid and user_id=$2::uuid for update",
        [diffId, userId]
      ))[0];
      if (!latestDiff) throw new Error("PLAN_DIFF_NOT_FOUND");
      if (String(latestDiff.status) === "APPLIED") {
        applied = latestDiff;
        return;
      }
      if (String(latestDiff.status) !== "PROPOSED") throw new Error("PLAN_DIFF_NOT_APPLICABLE");

      const nextVersion = Number(active.version) + 1;

      await tx.unsafe(
        "update public.learning_plans set status='SUPERSEDED' where id=$1::uuid and status='ACTIVE'",
        [String(active.id)]
      );

      const nextPlan = rows(await tx.unsafe(
        "insert into public.learning_plans(user_id,goal_id,version,status,start_date,end_date,gap_snapshot_id,constraint_fingerprint,planner_version,generation_key,planned_minutes,adaptation_buffer_minutes,rationale,warnings,parent_plan_id) values ($1::uuid,$2::uuid,$3,'ACTIVE',$4::date,$5::date,$6::uuid,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14::uuid) returning *",
        [
          userId,
          String(active.goal_id),
          nextVersion,
          dateOnly(active.start_date),
          dateOnly(active.end_date),
          String(active.gap_snapshot_id),
          String(active.constraint_fingerprint),
          String(active.planner_version),
          "apply-diff:" + diffId,
          Number(active.planned_minutes) + duration,
          Number(active.adaptation_buffer_minutes),
          JSON.stringify(jsonValue(active.rationale, {})),
          JSON.stringify(jsonValue(active.warnings, [])),
          String(active.id)
        ]
      ))[0];
      const nextPlanId = String(nextPlan.id);

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
            dateOnly(week.start_date),
            dateOnly(week.end_date),
            Number(week.capacity_minutes),
            Number(week.planned_minutes) + (isAffected ? duration : 0),
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
      for (const oldTask of oldTasks) {
        const inserted = rows(await tx.unsafe(
          "insert into public.learning_tasks(plan_id,week_id,objective_id,skill_id,type,title,duration_minutes,due_at,status,difficulty,flexible,rationale_code,inserted_by_plan_diff_id,completed_at,logical_task_id,started_at,skipped_at,actual_minutes,reschedule_count) values ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7,$8::timestamptz,$9,$10,$11,$12,$13::uuid,$14::timestamptz,$15::uuid,$16::timestamptz,$17::timestamptz,$18,$19) returning id",
          [
            nextPlanId,
            weekMap.get(String(oldTask.week_id)) ?? null,
            objectiveMap.get(String(oldTask.objective_id)) ?? null,
            String(oldTask.skill_id),
            String(oldTask.type),
            String(oldTask.title),
            Number(oldTask.duration_minutes),
            oldTask.due_at == null ? null : String(oldTask.due_at),
            String(oldTask.status),
            String(oldTask.difficulty),
            Boolean(oldTask.flexible),
            String(oldTask.rationale_code),
            oldTask.inserted_by_plan_diff_id == null ? null : String(oldTask.inserted_by_plan_diff_id),
            oldTask.completed_at == null ? null : String(oldTask.completed_at),
            String(oldTask.logical_task_id),
            oldTask.started_at == null ? null : String(oldTask.started_at),
            oldTask.skipped_at == null ? null : String(oldTask.skipped_at),
            oldTask.actual_minutes == null ? null : Number(oldTask.actual_minutes),
            Number(oldTask.reschedule_count ?? 0)
          ]
        ));
        taskMap.set(String(oldTask.id), String(inserted[0].id));
      }

      const assignments = rows(await tx.unsafe(
        "select a.* from public.task_resource_assignments a join public.learning_tasks t on t.id=a.task_id where t.plan_id=$1::uuid",
        [String(active.id)]
      ));
      for (const assignment of assignments) {
        const newTaskId = taskMap.get(String(assignment.task_id));
        if (!newTaskId) continue;
        await tx.unsafe(
          "insert into public.task_resource_assignments(task_id,resource_id,rank_score,ranker_version,explanation) values ($1::uuid,$2::uuid,$3,$4,$5)",
          [newTaskId,String(assignment.resource_id),Number(assignment.rank_score),String(assignment.ranker_version),String(assignment.explanation)]
        );
      }

      const newWeekId = weekMap.get(String(affected.week_id));
      const oldAffectedObjective = oldObjectives.find(item => String(item.logical_objective_id) === objectiveLogicalId);
      const newObjectiveId = oldAffectedObjective ? objectiveMap.get(String(oldAffectedObjective.id)) : null;
      if (!newWeekId || !newObjectiveId) throw new Error("PLAN_DIFF_REFERENCE_ERROR");

      const newTaskRows = rows(await tx.unsafe(
        "insert into public.learning_tasks(plan_id,week_id,objective_id,skill_id,type,title,duration_minutes,due_at,status,difficulty,flexible,rationale_code,inserted_by_plan_diff_id) values ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7,$8::timestamptz,'PLANNED',$9,false,$10,$11::uuid) returning id,logical_task_id",
        [nextPlanId,newWeekId,newObjectiveId,skillId,taskType,title,duration,dueAt,difficulty,rationaleCode,diffId]
      ));

      const appliedOperation = {
        ...operation,
        task: {
          ...task,
          taskId: String(newTaskRows[0].id),
          logicalTaskId: String(newTaskRows[0].logical_task_id)
        }
      };

      applied = rows(await tx.unsafe(
        "update public.plan_diffs set to_plan_id=$1::uuid,to_version=$2,status='APPLIED',operations=$3::jsonb,applied_at=now() where id=$4::uuid and user_id=$5::uuid returning *",
        [nextPlanId,nextVersion,JSON.stringify([appliedOperation]),diffId,userId]
      ))[0];

      await tx.unsafe(
        "update public.replan_decisions set decision='APPLY',reason=reason || ' User confirmed the proposed roadmap change.' where user_id=$1::uuid and input_fingerprint=$2",
        [userId,String(diff.input_fingerprint)]
      );

      await tx.unsafe(
        "insert into public.agent_events(user_id,event_type,trigger_type,trigger_ref,summary,entity_refs,evidence_refs,metadata) values ($1::uuid,'plan.adapted','USER_CONFIRMATION',$2,$3,$4::jsonb,$5::jsonb,$6::jsonb)",
        [
          userId,
          diffId,
          "Applied confirmed roadmap change and created Plan v" + nextVersion + ".",
          JSON.stringify([{ type: "plan_diff", id: diffId },{ type: "learning_plan", id: nextPlanId }]),
          JSON.stringify(jsonValue(diff.evidence_refs, [])),
          JSON.stringify({ confirmed: true, operationCount: 1 })
        ]
      );
    });

    return this.diffDto(applied!, false);
  }

  async rejectProposed(userId: string, diffId: string) {
    const sql = getSql();
    const updated = rows(await sql.unsafe(
      "update public.plan_diffs set status='REJECTED',can_undo=false where id=$1::uuid and user_id=$2::uuid and status='PROPOSED' returning *",
      [diffId,userId]
    ))[0];
    if (!updated) {
      const current = rows(await sql.unsafe(
        "select * from public.plan_diffs where id=$1::uuid and user_id=$2::uuid limit 1",
        [diffId,userId]
      ))[0];
      if (!current) throw new Error("PLAN_DIFF_NOT_FOUND");
      if (String(current.status) === "REJECTED") return this.diffDto(current, true);
      throw new Error("PLAN_DIFF_NOT_REJECTABLE");
    }

    await sql.unsafe(
      "insert into public.agent_events(user_id,event_type,trigger_type,trigger_ref,summary,entity_refs,evidence_refs,metadata) values ($1::uuid,'plan.change.rejected','USER_CONFIRMATION',$2,$3,$4::jsonb,$5::jsonb,$6::jsonb)",
      [
        userId,
        diffId,
        "Kept the current roadmap and rejected the proposed change.",
        JSON.stringify([{ type: "plan_diff", id: diffId }]),
        JSON.stringify(jsonValue(updated.evidence_refs, [])),
        JSON.stringify({ confirmed: false })
      ]
    );

    return this.diffDto(updated, false);
  }

  async undo(userId: string, diffId: string) {
    const sql = getSql();

    const originalRows = rows(await sql.unsafe(
      "select * from public.plan_diffs where id=$1::uuid and user_id=$2::uuid limit 1",
      [diffId, userId]
    ));
    const original = originalRows[0];
    if (!original) throw new Error("PLAN_DIFF_NOT_FOUND");
    if (String(original.status) !== "APPLIED" || !original.to_plan_id) {
      throw new Error("PLAN_DIFF_NOT_UNDOABLE");
    }

    const activeRows = rows(await sql.unsafe(
      "select * from public.learning_plans where id=$1::uuid and user_id=$2::uuid and status='ACTIVE' limit 1",
      [String(original.to_plan_id), userId]
    ));
    const active = activeRows[0];
    if (!active || Number(active.version) !== Number(original.to_version)) {
      throw new Error("UNDO_STALE_BASELINE");
    }

    const insertedTasks = rows(await sql.unsafe(
      "select t.*,w.week_index,w.planned_minutes week_planned_minutes from public.learning_tasks t join public.plan_weeks w on w.id=t.week_id where t.plan_id=$1::uuid and t.inserted_by_plan_diff_id=$2::uuid order by t.created_at",
      [String(active.id), diffId]
    ));
    if (insertedTasks.length !== 1) throw new Error("UNDO_UNSUPPORTED_PATCH_SHAPE");

    const task = insertedTasks[0];
    if (String(task.status) !== "PLANNED") throw new Error("UNDO_UNSAFE_TASK_PROGRESS");

    const duration = Number(task.duration_minutes);
    const fingerprint = createHash("sha256")
      .update(JSON.stringify({
        originalDiffId: diffId,
        fromPlanId: String(active.id),
        fromVersion: Number(active.version),
        logicalTaskId: String(task.logical_task_id),
        operation: "UNDO_ADD_TASK",
        replannerVersion: REPLANNER_VERSION
      }))
      .digest("hex");

    const existingRows = rows(await sql.unsafe(
      "select * from public.plan_diffs where user_id=$1::uuid and input_fingerprint=$2 limit 1",
      [userId, fingerprint]
    ));
    if (existingRows[0]) return this.diffDto(existingRows[0], true);

    let undoDiff: Row | null = null;

    await sql.begin(async tx => {
      const lockedRows = rows(await tx.unsafe(
        "select * from public.learning_plans where id=$1::uuid and user_id=$2::uuid for update",
        [String(active.id), userId]
      ));
      const locked = lockedRows[0];
      if (!locked || String(locked.status) !== "ACTIVE") throw new Error("UNDO_STALE_BASELINE");

      const nextVersion = Number(active.version) + 1;
      const diffRows = rows(await tx.unsafe(
        "insert into public.plan_diffs(user_id,goal_id,from_plan_id,from_version,status,trigger_type,trigger_refs,evidence_refs,summary,reason,operations,weekly_impact,timeline_impact,total_minute_delta,touch_count,complexity,can_undo,generator_version,validator_version,input_fingerprint) values ($1::uuid,$2::uuid,$3::uuid,$4,'PROPOSED','UNDO',$5::jsonb,$6::jsonb,$7,$8,$9::jsonb,$10::jsonb,'NONE',$11,1,'MINOR',false,$12,$13,$14) returning *",
        [
          userId,
          String(active.goal_id),
          String(active.id),
          Number(active.version),
          JSON.stringify([diffId]),
          JSON.stringify(jsonValue(original.evidence_refs, [])),
          "Undo previous roadmap reinforcement",
          "The inserted reinforcement has not started, so SkillTwin can safely restore the prior remaining workload without deleting history.",
          JSON.stringify([{
            type: "REMOVE_TASK",
            taskId: String(task.id),
            logicalTaskId: String(task.logical_task_id),
            title: String(task.title),
            before: {
              durationMinutes: duration,
              dueAt: task.due_at == null ? null : String(task.due_at),
              status: String(task.status)
            },
            after: null,
            reasonRefs: [diffId]
          }]),
          JSON.stringify([{
            weekIndex: Number(task.week_index),
            beforeMinutes: Number(task.week_planned_minutes),
            afterMinutes: Number(task.week_planned_minutes) - duration
          }]),
          -duration,
          REPLANNER_VERSION,
          REPLAN_VALIDATOR_VERSION,
          fingerprint
        ]
      ));
      const newDiffId = String(diffRows[0].id);

      await tx.unsafe(
        "update public.learning_plans set status='SUPERSEDED' where id=$1::uuid and status='ACTIVE'",
        [String(active.id)]
      );

      const planRows = rows(await tx.unsafe(
        "insert into public.learning_plans(user_id,goal_id,version,status,start_date,end_date,gap_snapshot_id,constraint_fingerprint,planner_version,generation_key,planned_minutes,adaptation_buffer_minutes,rationale,warnings,parent_plan_id) values ($1::uuid,$2::uuid,$3,'ACTIVE',$4::date,$5::date,$6::uuid,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14::uuid) returning id",
        [
          userId,
          String(active.goal_id),
          nextVersion,
          dateOnly(active.start_date),
          dateOnly(active.end_date),
          String(active.gap_snapshot_id),
          String(active.constraint_fingerprint),
          String(active.planner_version),
          "undo:" + diffId + ":v" + nextVersion,
          Math.max(0, Number(active.planned_minutes) - duration),
          Number(active.adaptation_buffer_minutes),
          JSON.stringify(jsonValue(active.rationale, {})),
          JSON.stringify(jsonValue(active.warnings, [])),
          String(active.id)
        ]
      ));
      const nextPlanId = String(planRows[0].id);

      await tx.unsafe(
        "insert into public.plan_weeks(plan_id,week_index,start_date,end_date,capacity_minutes,planned_minutes,focus_skill_ids,rationale) select $1::uuid,w.week_index,w.start_date,w.end_date,w.capacity_minutes,case when w.id=$2::uuid then greatest(0,w.planned_minutes-$3) else w.planned_minutes end,w.focus_skill_ids,w.rationale from public.plan_weeks w where w.plan_id=$4::uuid order by w.week_index",
        [nextPlanId, String(task.week_id), duration, String(active.id)]
      );

      await tx.unsafe(
        "insert into public.learning_objectives(plan_id,week_id,skill_id,requirement_id,type,start_score,target_score,success_criteria,priority_at_creation,status,logical_objective_id) select $1::uuid,nw.id,o.skill_id,o.requirement_id,o.type,o.start_score,o.target_score,o.success_criteria,o.priority_at_creation,o.status,o.logical_objective_id from public.learning_objectives o join public.plan_weeks ow on ow.id=o.week_id join public.plan_weeks nw on nw.plan_id=$1::uuid and nw.week_index=ow.week_index where o.plan_id=$2::uuid order by o.created_at,o.id",
        [nextPlanId, String(active.id)]
      );

      await tx.unsafe(
        "insert into public.learning_tasks(plan_id,week_id,objective_id,skill_id,type,title,duration_minutes,due_at,status,difficulty,flexible,rationale_code,inserted_by_plan_diff_id,completed_at,logical_task_id) select $1::uuid,no.week_id,no.id,t.skill_id,t.type,t.title,t.duration_minutes,t.due_at,t.status,t.difficulty,t.flexible,t.rationale_code,t.inserted_by_plan_diff_id,t.completed_at,t.logical_task_id from public.learning_tasks t join public.learning_objectives oo on oo.id=t.objective_id join public.learning_objectives no on no.plan_id=$1::uuid and no.logical_objective_id=oo.logical_objective_id where t.plan_id=$2::uuid and t.logical_task_id<>$3::uuid order by t.created_at,t.id",
        [nextPlanId, String(active.id), String(task.logical_task_id)]
      );

      await tx.unsafe(
        "insert into public.task_resource_assignments(task_id,resource_id,rank_score,ranker_version,explanation) select nt.id,a.resource_id,a.rank_score,a.ranker_version,a.explanation from public.task_resource_assignments a join public.learning_tasks ot on ot.id=a.task_id join public.learning_tasks nt on nt.plan_id=$1::uuid and nt.logical_task_id=ot.logical_task_id where ot.plan_id=$2::uuid",
        [nextPlanId, String(active.id)]
      );

      const appliedRows = rows(await tx.unsafe(
        "update public.plan_diffs set to_plan_id=$1::uuid,to_version=$2,status='APPLIED',applied_at=now() where id=$3::uuid returning *",
        [nextPlanId, nextVersion, newDiffId]
      ));
      undoDiff = appliedRows[0];

      await tx.unsafe(
        "update public.plan_diffs set status='UNDONE',can_undo=false where id=$1::uuid and user_id=$2::uuid",
        [diffId, userId]
      );

      await tx.unsafe(
        "insert into public.agent_events(user_id,event_type,trigger_type,trigger_ref,summary,entity_refs,evidence_refs,metadata) values ($1::uuid,'plan.undo.applied','UNDO',$2,$3,$4::jsonb,$5::jsonb,$6::jsonb)",
        [
          userId,
          diffId,
          "Created Plan v" + nextVersion + " by safely undoing the unstarted reinforcement task.",
          JSON.stringify([
            { type: "plan_diff", id: newDiffId },
            { type: "plan_diff", id: diffId },
            { type: "learning_plan", id: nextPlanId }
          ]),
          JSON.stringify(jsonValue(original.evidence_refs, [])),
          JSON.stringify({
            removedLogicalTaskId: String(task.logical_task_id),
            minuteDelta: -duration
          })
        ]
      );
    });

    return this.diffDto(undoDiff!, false);
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
        whatChanged: Array.isArray(parseJsonValue(diff.operations)) ? parseJsonValue(diff.operations) as unknown[] : [],
        weeklyImpact: Array.isArray(parseJsonValue(diff.weekly_impact)) ? parseJsonValue(diff.weekly_impact) as unknown[] : [],
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
