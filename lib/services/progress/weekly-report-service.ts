import "server-only";
import { getSql } from "@/lib/db/postgres";

export const WEEKLY_REPORT_VERSION = "weekly-report-g1";

type Row = Record<string, unknown>;
const rows = (value: unknown) => value as Row[];

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function startOfUtcWeek(now = new Date()) {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = date.getUTCDay();
  const delta = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + delta);
  return date;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

function score(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export class WeeklyReportService {
  async latest(userId: string) {
    const sql = getSql();
    return rows(await sql.unsafe(
      "select * from public.weekly_reports where user_id=$1::uuid order by week_start desc,created_at desc limit 1",
      [userId]
    ))[0] ?? null;
  }

  async generate(userId: string, now = new Date()) {
    const sql = getSql();
    const weekStartDate = startOfUtcWeek(now);
    const weekEndDate = addDays(weekStartDate, 6);
    const weekStart = dateOnly(weekStartDate);
    const weekEnd = dateOnly(weekEndDate);
    const startTs = weekStart + "T00:00:00.000Z";
    const endExclusive = addDays(weekEndDate, 1).toISOString();

    const goal = rows(await sql.unsafe(
      "select id from public.career_goals where user_id=$1::uuid and status='ACTIVE' limit 1",
      [userId]
    ))[0];

    const snapshots = rows(await sql.unsafe(
      "select id,readiness,evidence_coverage,created_at from public.gap_snapshots where user_id=$1::uuid and created_at < $2::timestamptz order by created_at asc",
      [userId,endExclusive]
    ));
    const duringWeek = snapshots.filter(row => String(row.created_at) >= startTs);
    const beforeWeek = snapshots.filter(row => String(row.created_at) < startTs);
    const readinessStartRow = beforeWeek.at(-1) ?? duringWeek[0] ?? null;
    const readinessEndRow = duringWeek.at(-1) ?? readinessStartRow;
    const readinessStart = readinessStartRow ? Number(readinessStartRow.readiness) : null;
    const readinessEnd = readinessEndRow ? Number(readinessEndRow.readiness) : null;

    const taskStats = rows(await sql.unsafe(
      `select
         count(*)::int tasks_completed,
         coalesce(sum(coalesce(actual_minutes,duration_minutes)),0)::int learning_minutes
       from public.learning_tasks t
       join public.learning_plans p on p.id=t.plan_id
       where p.user_id=$1::uuid
         and t.status='COMPLETED'
         and t.completed_at >= $2::timestamptz
         and t.completed_at < $3::timestamptz`,
      [userId,startTs,endExclusive]
    ))[0] ?? {};

    const assessmentStats = rows(await sql.unsafe(
      "select count(*)::int assessments_completed from public.skill_assessment_outcomes where user_id=$1::uuid and created_at >= $2::timestamptz and created_at < $3::timestamptz",
      [userId,startTs,endExclusive]
    ))[0] ?? {};

    const skillChanges = rows(await sql.unsafe(
      `select sh.skill_id,sh.before_state,sh.after_state,s.canonical_name
       from public.skill_history sh
       join public.skills s on s.id=sh.skill_id
       where sh.user_id=$1::uuid
         and sh.created_at >= $2::timestamptz
         and sh.created_at < $3::timestamptz
       order by sh.created_at desc`,
      [userId,startTs,endExclusive]
    ));

    const improving = new Map<string,{ id: string; name: string; delta: number }>();
    for (const row of skillChanges) {
      const before = asObject(row.before_state);
      const after = asObject(row.after_state);
      const beforeScore = score(before.capabilityScore ?? before.capability_score);
      const afterScore = score(after.capabilityScore ?? after.capability_score);
      if (beforeScore == null || afterScore == null || afterScore <= beforeScore) continue;
      const delta = afterScore - beforeScore;
      const id = String(row.skill_id);
      const current = improving.get(id);
      if (!current || delta > current.delta) {
        improving.set(id,{ id,name:String(row.canonical_name),delta });
      }
    }
    const improvingRows = [...improving.values()].sort((a,b)=>b.delta-a.delta).slice(0,3);

    const latestSnapshotId = readinessEndRow?.id ? String(readinessEndRow.id) : null;
    const attention = latestSnapshotId
      ? rows(await sql.unsafe(
          `select sgr.skill_id,s.canonical_name,sgr.priority_score,sgr.gap_severity
           from public.skill_gap_results sgr
           join public.skills s on s.id=sgr.skill_id
           where sgr.snapshot_id=$1::uuid and sgr.status<>'STRONG'
           order by sgr.priority_score desc,sgr.gap_severity desc
           limit 3`,
          [latestSnapshotId]
        ))
      : [];

    const roadmapChanges = rows(await sql.unsafe(
      "select count(*)::int count from public.plan_diffs where user_id=$1::uuid and status in ('APPLIED','UNDONE') and created_at >= $2::timestamptz and created_at < $3::timestamptz",
      [userId,startTs,endExclusive]
    ))[0] ?? {};

    const tasksCompleted = Number(taskStats.tasks_completed ?? 0);
    const learningMinutes = Number(taskStats.learning_minutes ?? 0);
    const assessmentsCompleted = Number(assessmentStats.assessments_completed ?? 0);
    const skillsChanged = new Set(skillChanges.map(row => String(row.skill_id))).size;
    const roadmapChangeCount = Number(roadmapChanges.count ?? 0);
    const readinessDelta = readinessStart != null && readinessEnd != null
      ? readinessEnd - readinessStart
      : null;

    const summaryParts = [
      tasksCompleted ? tasksCompleted + " roadmap task" + (tasksCompleted === 1 ? "" : "s") + " completed" : "No roadmap tasks completed",
      assessmentsCompleted ? assessmentsCompleted + " validation" + (assessmentsCompleted === 1 ? "" : "s") + " completed" : "no completed validations",
      skillsChanged ? skillsChanged + " skill" + (skillsChanged === 1 ? "" : "s") + " changed from accepted evidence" : "no validated skill changes"
    ];

    if (readinessDelta != null) {
      summaryParts.push("role readiness moved " + (readinessDelta >= 0 ? "+" : "") + readinessDelta + " points");
    }

    const recommendedNextStep = attention.length
      ? "Focus next on " + String(attention[0].canonical_name) + "; it is currently the highest-priority remaining role gap."
      : "Keep validating recent learning so SkillTwin can distinguish activity from proven capability.";

    const result = rows(await sql.unsafe(
      `insert into public.weekly_reports(
         user_id,goal_id,week_start,week_end,readiness_start,readiness_end,
         tasks_completed,learning_minutes,assessments_completed,skills_changed,
         roadmap_changes,improving_skill_ids,attention_skill_ids,summary,
         recommended_next_step,report_version
       ) values (
         $1::uuid,$2::uuid,$3::date,$4::date,$5,$6,$7,$8,$9,$10,$11,
         $12::jsonb,$13::jsonb,$14,$15,$16
       )
       on conflict(user_id,week_start,report_version)
       do update set
         goal_id=excluded.goal_id,
         week_end=excluded.week_end,
         readiness_start=excluded.readiness_start,
         readiness_end=excluded.readiness_end,
         tasks_completed=excluded.tasks_completed,
         learning_minutes=excluded.learning_minutes,
         assessments_completed=excluded.assessments_completed,
         skills_changed=excluded.skills_changed,
         roadmap_changes=excluded.roadmap_changes,
         improving_skill_ids=excluded.improving_skill_ids,
         attention_skill_ids=excluded.attention_skill_ids,
         summary=excluded.summary,
         recommended_next_step=excluded.recommended_next_step,
         created_at=now()
       returning *`,
      [
        userId,
        goal?.id ? String(goal.id) : null,
        weekStart,
        weekEnd,
        readinessStart,
        readinessEnd,
        tasksCompleted,
        learningMinutes,
        assessmentsCompleted,
        skillsChanged,
        roadmapChangeCount,
        JSON.stringify(improvingRows.map(row => row.id)),
        JSON.stringify(attention.map(row => String(row.skill_id))),
        summaryParts.join("; ") + ".",
        recommendedNextStep,
        WEEKLY_REPORT_VERSION
      ]
    ))[0];

    await sql.unsafe(
      "insert into public.agent_events(user_id,event_type,trigger_type,trigger_ref,summary,entity_refs,metadata) values ($1::uuid,'progress.weekly_report.generated','WEEKLY_REPORT',$2,$3,$4::jsonb,$5::jsonb)",
      [
        userId,
        String(result.id),
        "Generated weekly progress report for " + weekStart + " through " + weekEnd + ".",
        JSON.stringify([{ type: "weekly_report", id: String(result.id) }]),
        JSON.stringify({
          reportVersion: WEEKLY_REPORT_VERSION,
          tasksCompleted,
          assessmentsCompleted,
          skillsChanged,
          roadmapChanges: roadmapChangeCount
        })
      ]
    );

    return {
      ...result,
      improvingSkills: improvingRows,
      attentionSkills: attention.map(row => ({
        id: String(row.skill_id),
        name: String(row.canonical_name),
        priority: Number(row.priority_score),
        gapSeverity: Number(row.gap_severity)
      }))
    };
  }
}

let service: WeeklyReportService | null = null;

export function getWeeklyReportService() {
  if (!service) service = new WeeklyReportService();
  return service;
}
