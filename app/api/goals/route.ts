import { z } from "zod";
import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";
import { getSql } from "@/lib/db/postgres";
import { getGapAnalysisService } from "@/lib/services/gaps/gap-analysis-service";
import { getInitialPlanService } from "@/lib/services/planner/initial-plan-service";

type Row = Record<string, unknown>;
const rows = (value: unknown) => value as Row[];

const day = z.enum(["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]);
const schema = z.object({
  roleVersionId: z.string().uuid(),
  targetDate: z.string().date().nullable().optional(),
  hoursPerWeek: z.number().min(1).max(80).default(10),
  preferredSessionMinutes: z.number().int().min(15).max(240).default(60),
  minSessionMinutes: z.number().int().min(10).max(120).default(20),
  learningDays: z.array(day).min(1).max(7).default(["Mon","Tue","Wed","Thu","Fri","Sat"]),
  preferredFormats: z.array(z.string().trim().min(1).max(40)).min(1).max(8).default(["projects","practice","documentation"]),
  adaptationMode: z.enum(["AUTOMATIC","ASK_FIRST"]).default("AUTOMATIC")
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = await getRequestId();
  try {
    const { user, supabase } = await requireUser();
    const { data, error } = await supabase
      .from("career_goals")
      .select("id,role_version_id,target_date,hours_per_week,preferred_session_minutes,min_session_minutes,learning_days,preferred_formats,adaptation_mode,role_versions!inner(version,target_roles!inner(name,slug,family))")
      .eq("user_id", user.id)
      .eq("status", "ACTIVE")
      .limit(1)
      .maybeSingle();
    if (error) throw error;

    return ok(requestId, { goal: data });
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return fail(requestId, 401, "UNAUTHENTICATED", "Sign in to view your career goal.");
    }
    console.error("goal.read.failed", { requestId, error: error instanceof Error ? error.message : String(error) });
    return fail(requestId, 500, "GOAL_READ_FAILED", "Could not load your career goal.");
  }
}

export async function POST(request: Request) {
  const requestId = await getRequestId();
  try {
    const { user, supabase } = await requireUser();
    const parsed = schema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return fail(requestId, 400, "VALIDATION_ERROR", "Invalid career goal.", parsed.error.flatten().fieldErrors);
    }
    const input = parsed.data;

    const { data: role, error: roleError } = await supabase
      .from("role_versions")
      .select("id,version,target_roles!inner(id,name,slug,family)")
      .eq("id", input.roleVersionId)
      .eq("status", "ACTIVE")
      .maybeSingle();

    if (roleError) throw roleError;
    if (!role) return fail(requestId, 404, "ROLE_NOT_FOUND", "That target role is not available.");

    const roleMeta = Array.isArray(role.target_roles) ? role.target_roles[0] : role.target_roles;
    const sql = getSql();

    const saved = await sql.begin(async tx => {
      const active = rows(await tx.unsafe(
        "select id,role_version_id from public.career_goals where user_id=$1::uuid and status='ACTIVE' limit 1 for update",
        [user.id]
      ))[0];

      let savedRows: Row[];

      if (active && String(active.role_version_id) === input.roleVersionId) {
        savedRows = rows(await tx.unsafe(
          "update public.career_goals set target_date=$1::date,hours_per_week=$2,preferred_session_minutes=$3,min_session_minutes=$4,learning_days=$5::jsonb,preferred_formats=$6::jsonb,adaptation_mode=$7 where id=$8::uuid and user_id=$9::uuid returning *",
          [
            input.targetDate ?? null,
            input.hoursPerWeek,
            input.preferredSessionMinutes,
            input.minSessionMinutes,
            JSON.stringify(input.learningDays),
            JSON.stringify(input.preferredFormats),
            input.adaptationMode,
            String(active.id),
            user.id
          ]
        ));
      } else {
        if (active) {
          await tx.unsafe(
            "update public.learning_plans set status='ARCHIVED' where goal_id=$1::uuid and user_id=$2::uuid and status='ACTIVE'",
            [String(active.id), user.id]
          );
          await tx.unsafe(
            "update public.career_goals set status='ARCHIVED' where id=$1::uuid and user_id=$2::uuid",
            [String(active.id), user.id]
          );
        }

        savedRows = rows(await tx.unsafe(
          "insert into public.career_goals(user_id,role_version_id,target_date,hours_per_week,preferred_session_minutes,min_session_minutes,learning_days,preferred_formats,adaptation_mode) values ($1::uuid,$2::uuid,$3::date,$4,$5,$6,$7::jsonb,$8::jsonb,$9) returning *",
          [
            user.id,
            input.roleVersionId,
            input.targetDate ?? null,
            input.hoursPerWeek,
            input.preferredSessionMinutes,
            input.minSessionMinutes,
            JSON.stringify(input.learningDays),
            JSON.stringify(input.preferredFormats),
            input.adaptationMode
          ]
        ));
      }

      const goal = savedRows[0];
      await tx.unsafe(
        "insert into public.agent_events(user_id,event_type,trigger_type,trigger_ref,summary,entity_refs,metadata) values ($1::uuid,'career.goal.updated','USER_ACTION',$2,$3,$4::jsonb,$5::jsonb)",
        [
          user.id,
          String(goal.id),
          "Target role set to " + String(roleMeta?.name ?? "target role") + ".",
          JSON.stringify([
            { type: "career_goal", id: String(goal.id) },
            { type: "role_version", id: input.roleVersionId }
          ]),
          JSON.stringify({
            roleName: String(roleMeta?.name ?? "Target role"),
            hoursPerWeek: input.hoursPerWeek,
            preferredSessionMinutes: input.preferredSessionMinutes,
            adaptationMode: input.adaptationMode
          })
        ]
      );

      return goal;
    });

    const skillCount = rows(await sql.unsafe(
      "select count(*)::int as count from public.user_skills where user_id=$1::uuid",
      [user.id]
    ));

    let gapAnalysis: unknown = null;
    let plan: unknown = null;
    if (Number(skillCount[0]?.count ?? 0) > 0) {
      gapAnalysis = await getGapAnalysisService().recompute(user.id, {
        type: "GOAL_CHANGE",
        ref: String(saved.id)
      });
      plan = await getInitialPlanService().generate(user.id);
    }

    return ok(requestId, {
      goal: saved,
      role: roleMeta,
      gapAnalysis,
      plan
    }, {
      notifications: [{
        title: "Target role saved",
        message: "SkillTwin will compare your evidence against " + String(roleMeta?.name ?? "your target role") + ".",
        tone: "success"
      }],
      next_action: { type: "UPLOAD_RESUME", label: "Add profile evidence", href: "/onboarding" }
    });
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return fail(requestId, 401, "UNAUTHENTICATED", "Sign in to save your career goal.");
    }
    console.error("goal.save.failed", { requestId, error: error instanceof Error ? error.message : String(error) });
    return fail(requestId, 500, "GOAL_SAVE_FAILED", "Could not save your career goal.");
  }
}
