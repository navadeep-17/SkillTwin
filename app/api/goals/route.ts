import { z } from "zod";
import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";
import { getSql } from "@/lib/db/postgres";
import { getGapAnalysisService } from "@/lib/services/gaps/gap-analysis-service";

const schema=z.object({
  roleVersionId:z.string().uuid(),
  careerObjective:z.string().trim().max(240).nullable().optional(),
  goalDescription:z.string().trim().max(1500).nullable().optional(),
  experienceLevel:z.enum(["BEGINNER","SOME_EXPERIENCE","INTERMEDIATE","ADVANCED"]).nullable().optional(),
  targetDate:z.string().date().nullable().optional(),
  hoursPerWeek:z.number().min(1).max(80).default(10),
  preferredSessionMinutes:z.number().int().min(15).max(240).default(60),
  minSessionMinutes:z.number().int().min(10).max(120).default(20),
  learningDays:z.array(z.enum(["Mon","Tue","Wed","Thu","Fri","Sat","Sun"])).min(1).max(7).default(["Mon","Tue","Wed","Thu","Fri","Sat"]),
  preferredFormats:z.array(z.enum(["projects","practice","documentation","video","articles"])).min(1).max(5).default(["projects","practice","documentation"]),
  adaptationMode:z.enum(["AUTOMATIC","ASK_FIRST"]).default("AUTOMATIC"),
  preferredAlternatives:z.record(z.string().uuid(),z.string().uuid()).default({})
});

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function POST(request:Request) {
  const requestId=await getRequestId();
  try {
    const {user}=await requireUser();
    const parsed=schema.safeParse(await request.json());
    if (!parsed.success) return fail(requestId,400,"VALIDATION_ERROR","Invalid career goal.",parsed.error.flatten().fieldErrors);

    const sql=getSql();
    const result=await sql.begin(async tx=>{
      const role=await tx.unsafe(
        "select rv.id,tr.name from public.role_versions rv join public.target_roles tr on tr.id=rv.role_id where rv.id=$1::uuid and rv.status='ACTIVE' and (tr.owner_user_id is null or tr.owner_user_id=$2::uuid) limit 1",
        [parsed.data.roleVersionId,user.id]
      ) as Array<Record<string,unknown>>;
      if (!role[0]) throw new Error("ROLE_VERSION_NOT_FOUND");

      const activeGoals=await tx.unsafe(
        "select id from public.career_goals where user_id=$1::uuid and status='ACTIVE' for update",
        [user.id]
      ) as Array<Record<string,unknown>>;
      for (const goal of activeGoals) {
        await tx.unsafe("update public.career_goals set status='ARCHIVED' where id=$1::uuid",[String(goal.id)]);
        await tx.unsafe("update public.learning_plans set status='ARCHIVED' where goal_id=$1::uuid and status='ACTIVE'",[String(goal.id)]);
      }

      const inserted=await tx.unsafe(
        "insert into public.career_goals(user_id,role_version_id,status,target_date,hours_per_week,preferred_session_minutes,min_session_minutes,learning_days,preferred_formats,adaptation_mode,preferred_alternatives,career_objective,goal_description,experience_level) values ($1::uuid,$2::uuid,'ACTIVE',$3::date,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10::jsonb,$11,$12,$13) returning *",
        [
          user.id,parsed.data.roleVersionId,parsed.data.targetDate ?? null,parsed.data.hoursPerWeek,
          parsed.data.preferredSessionMinutes,parsed.data.minSessionMinutes,JSON.stringify(parsed.data.learningDays),
          JSON.stringify(parsed.data.preferredFormats),parsed.data.adaptationMode,JSON.stringify(parsed.data.preferredAlternatives),
          parsed.data.careerObjective ?? null,parsed.data.goalDescription ?? null,parsed.data.experienceLevel ?? null
        ]
      ) as Array<Record<string,unknown>>;
      await tx.unsafe("update public.users set onboarding_step=greatest(onboarding_step,1) where id=$1::uuid",[user.id]);
      return {goal:inserted[0],roleName:String(role[0].name)};
    });

    const gap=await getGapAnalysisService().recompute(user.id,{type:"GOAL_CREATED",ref:String(result.goal.id)});
    return ok(requestId,{goal:result.goal,roleName:result.roleName,gapSnapshotId:gap.snapshotId},{
      notifications:[{title:"Target role selected",message:"SkillTwin created a target-role gap baseline without changing your capability state.",tone:"success"}],
      next_action:{type:"OPEN_ONBOARDING",label:"Continue profile setup",href:"/onboarding"}
    },201);
  } catch (error) {
    if (error instanceof UnauthenticatedError) return fail(requestId,401,"UNAUTHENTICATED","Sign in to create a career goal.");
    const message=error instanceof Error ? error.message : String(error);
    if (message==="ROLE_VERSION_NOT_FOUND") return fail(requestId,404,"ROLE_VERSION_NOT_FOUND","Selected role version is not active.");
    console.error("goal.create.failed",{requestId,error:message});
    return fail(requestId,500,"GOAL_CREATE_FAILED","Could not create the career goal.");
  }
}
