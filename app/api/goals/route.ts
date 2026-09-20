import { z } from "zod";
import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";
import { getGapAnalysisService } from "@/lib/services/gaps/gap-analysis-service";

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

    const { data: existing, error: existingError } = await supabase
      .from("career_goals")
      .select("id,role_version_id")
      .eq("user_id", user.id)
      .eq("status", "ACTIVE")
      .limit(1)
      .maybeSingle();
    if (existingError) throw existingError;

    const payload = {
      role_version_id: input.roleVersionId,
      target_date: input.targetDate ?? null,
      hours_per_week: input.hoursPerWeek,
      preferred_session_minutes: input.preferredSessionMinutes,
      min_session_minutes: input.minSessionMinutes,
      learning_days: input.learningDays,
      preferred_formats: input.preferredFormats,
      adaptation_mode: input.adaptationMode
    };

    let saved;
    if (existing) {
      const { data, error } = await supabase
        .from("career_goals")
        .update(payload)
        .eq("id", existing.id)
        .eq("user_id", user.id)
        .select("*")
        .single();
      if (error) throw error;
      saved = data;
    } else {
      const { data, error } = await supabase
        .from("career_goals")
        .insert({ user_id: user.id, ...payload })
        .select("*")
        .single();
      if (error) throw error;
      saved = data;
    }

    const { count, error: skillCountError } = await supabase
      .from("user_skills")
      .select("skill_id", { count: "exact", head: true })
      .eq("user_id", user.id);
    if (skillCountError) throw skillCountError;

    let gapAnalysis: unknown = null;
    if ((count ?? 0) > 0) {
      gapAnalysis = await getGapAnalysisService().recompute(user.id, {
        type: "GOAL_CHANGE",
        ref: String(saved.id)
      });
    }

    const roleMeta = Array.isArray(role.target_roles) ? role.target_roles[0] : role.target_roles;
    return ok(requestId, {
      goal: saved,
      role: roleMeta,
      gapAnalysis
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
