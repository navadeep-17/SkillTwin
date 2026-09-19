import { z } from "zod";
import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";
import { getSql } from "@/lib/db/postgres";
import { getGapAnalysisService } from "@/lib/services/gaps/gap-analysis-service";

const schema=z.object({
  careerObjective:z.string().trim().max(240).nullable().optional(),
  goalDescription:z.string().trim().max(1500).nullable().optional(),
  experienceLevel:z.enum(["BEGINNER","SOME_EXPERIENCE","INTERMEDIATE","ADVANCED"]).nullable().optional(),
  targetDate:z.string().date().nullable().optional(),
  hoursPerWeek:z.number().min(1).max(80).optional(),
  preferredSessionMinutes:z.number().int().min(15).max(240).optional(),
  minSessionMinutes:z.number().int().min(10).max(120).optional(),
  learningDays:z.array(z.enum(["Mon","Tue","Wed","Thu","Fri","Sat","Sun"])).min(1).max(7).optional(),
  preferredFormats:z.array(z.enum(["projects","practice","documentation","video","articles"])).min(1).max(5).optional(),
  adaptationMode:z.enum(["AUTOMATIC","ASK_FIRST"]).optional(),
  preferredAlternatives:z.record(z.string().uuid(),z.string().uuid()).optional()
});

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function PATCH(request:Request,context:{params:Promise<{id:string}>}) {
  const requestId=await getRequestId();
  try {
    const {id}=await context.params;
    const {user}=await requireUser();
    const parsed=schema.safeParse(await request.json());
    if (!parsed.success) return fail(requestId,400,"VALIDATION_ERROR","Invalid goal update.",parsed.error.flatten().fieldErrors);

    const sql=getSql();
    const existing=await sql.unsafe("select * from public.career_goals where id=$1::uuid and user_id=$2::uuid limit 1",[id,user.id]) as Array<Record<string,unknown>>;
    if (!existing[0]) return fail(requestId,404,"NOT_FOUND","Career goal not found.");
    const current=existing[0];
    const value=(key:string,dbKey:string)=>Object.prototype.hasOwnProperty.call(parsed.data,key) ? (parsed.data as Record<string,unknown>)[key] : current[dbKey];

    const updated=await sql.unsafe(
      "update public.career_goals set target_date=$1::date,hours_per_week=$2,preferred_session_minutes=$3,min_session_minutes=$4,learning_days=$5::jsonb,preferred_formats=$6::jsonb,adaptation_mode=$7,preferred_alternatives=$8::jsonb,career_objective=$9,goal_description=$10,experience_level=$11 where id=$12::uuid and user_id=$13::uuid returning *",
      [
        value("targetDate","target_date") ?? null,
        Number(value("hoursPerWeek","hours_per_week")),
        Number(value("preferredSessionMinutes","preferred_session_minutes")),
        Number(value("minSessionMinutes","min_session_minutes")),
        JSON.stringify(value("learningDays","learning_days")),
        JSON.stringify(value("preferredFormats","preferred_formats")),
        String(value("adaptationMode","adaptation_mode")),
        JSON.stringify(value("preferredAlternatives","preferred_alternatives")),
        value("careerObjective","career_objective") ?? null,
        value("goalDescription","goal_description") ?? null,
        value("experienceLevel","experience_level") ?? null,
        id,user.id
      ]
    ) as Array<Record<string,unknown>>;

    const gap=String(current.status)==="ACTIVE"
      ? await getGapAnalysisService().recompute(user.id,{type:"GOAL_UPDATED",ref:id})
      : null;

    return ok(requestId,{goal:updated[0],gapSnapshotId:gap?.snapshotId ?? null},{
      notifications:[{title:"Learning preferences updated",message:"SkillTwin recomputed target-role priorities while preserving capability evidence.",tone:"success"}]
    });
  } catch (error) {
    if (error instanceof UnauthenticatedError) return fail(requestId,401,"UNAUTHENTICATED","Sign in to update your goal.");
    console.error("goal.update.failed",{requestId,error:error instanceof Error?error.message:String(error)});
    return fail(requestId,500,"GOAL_UPDATE_FAILED","Could not update the career goal.");
  }
}
