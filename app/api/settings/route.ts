import { z } from "zod";
import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";

const schema = z.object({
  notificationsEnabled: z.boolean(),
  weeklyReportEnabled: z.boolean(),
  reducedMotion: z.boolean(),
  compactDensity: z.boolean()
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = await getRequestId();

  try {
    const { user, supabase } = await requireUser();
    const { data, error } = await supabase
      .from("user_learning_settings")
      .select("notifications_enabled,weekly_report_enabled,reduced_motion,compact_density,updated_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;

    return ok(requestId, {
      settings: data ?? {
        notifications_enabled: true,
        weekly_report_enabled: true,
        reduced_motion: false,
        compact_density: false,
        updated_at: null
      }
    });
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return fail(requestId, 401, "UNAUTHENTICATED", "Sign in to view learning settings.");
    }

    console.error("settings.read.failed", {
      requestId,
      error: error instanceof Error ? error.message : String(error)
    });
    return fail(requestId, 500, "SETTINGS_READ_FAILED", "Could not load learning settings.");
  }
}

export async function PUT(request: Request) {
  const requestId = await getRequestId();

  try {
    const { user, supabase } = await requireUser();
    const parsed = schema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return fail(requestId, 400, "VALIDATION_ERROR", "Invalid settings.", parsed.error.flatten().fieldErrors);
    }

    const { data, error } = await supabase
      .from("user_learning_settings")
      .upsert({
        user_id: user.id,
        notifications_enabled: parsed.data.notificationsEnabled,
        weekly_report_enabled: parsed.data.weeklyReportEnabled,
        reduced_motion: parsed.data.reducedMotion,
        compact_density: parsed.data.compactDensity,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id" })
      .select("notifications_enabled,weekly_report_enabled,reduced_motion,compact_density,updated_at")
      .single();

    if (error) throw error;

    return ok(requestId, { settings: data }, {
      notifications: [{
        title: "Settings saved",
        message: "Your SkillTwin preferences were updated.",
        tone: "success"
      }]
    });
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return fail(requestId, 401, "UNAUTHENTICATED", "Sign in to update learning settings.");
    }

    console.error("settings.save.failed", {
      requestId,
      error: error instanceof Error ? error.message : String(error)
    });
    return fail(requestId, 500, "SETTINGS_SAVE_FAILED", "Could not save learning settings.");
  }
}
