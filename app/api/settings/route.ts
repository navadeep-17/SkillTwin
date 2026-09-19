import { z } from "zod";
import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";

const patchSchema=z.object({
  notificationsEnabled:z.boolean().optional(),
  weeklyReportEnabled:z.boolean().optional(),
  reducedMotion:z.boolean().optional(),
  compactDensity:z.boolean().optional()
});

export const dynamic="force-dynamic";

export async function GET() {
  const requestId=await getRequestId();
  try {
    const {user,supabase}=await requireUser();
    const [{data:settings,error:settingsError},{data:goal,error:goalError}] = await Promise.all([
      supabase.from("user_learning_settings").select("*").eq("user_id",user.id).maybeSingle(),
      supabase.from("career_goals").select("*").eq("user_id",user.id).eq("status","ACTIVE").limit(1).maybeSingle()
    ]);
    if (settingsError) throw settingsError;
    if (goalError) throw goalError;
    return ok(requestId,{settings:settings ?? {
      user_id:user.id,notifications_enabled:true,weekly_report_enabled:true,reduced_motion:false,compact_density:false
    },goal});
  } catch (error) {
    if (error instanceof UnauthenticatedError) return fail(requestId,401,"UNAUTHENTICATED","Sign in to view settings.");
    return fail(requestId,500,"SETTINGS_READ_FAILED","Could not load settings.");
  }
}

export async function PATCH(request:Request) {
  const requestId=await getRequestId();
  try {
    const {user,supabase}=await requireUser();
    const parsed=patchSchema.safeParse(await request.json());
    if (!parsed.success) return fail(requestId,400,"VALIDATION_ERROR","Invalid settings.",parsed.error.flatten().fieldErrors);
    const payload={
      user_id:user.id,
      notifications_enabled:parsed.data.notificationsEnabled ?? true,
      weekly_report_enabled:parsed.data.weeklyReportEnabled ?? true,
      reduced_motion:parsed.data.reducedMotion ?? false,
      compact_density:parsed.data.compactDensity ?? false
    };
    const {data,error}=await supabase.from("user_learning_settings").upsert(payload,{onConflict:"user_id"}).select().single();
    if (error) throw error;
    return ok(requestId,{settings:data});
  } catch (error) {
    if (error instanceof UnauthenticatedError) return fail(requestId,401,"UNAUTHENTICATED","Sign in to update settings.");
    return fail(requestId,500,"SETTINGS_UPDATE_FAILED","Could not update settings.");
  }
}
