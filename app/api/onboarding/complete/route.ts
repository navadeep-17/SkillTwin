import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";
import { getSql } from "@/lib/db/postgres";

export async function POST() {
  const requestId=await getRequestId();
  try {
    const {user}=await requireUser();
    const sql=getSql();
    await sql.unsafe(
      "update public.users set onboarding_step=4,onboarding_completed_at=coalesce(onboarding_completed_at,now()) where id=$1::uuid",
      [user.id]
    );
    return ok(requestId,{completed:true},{
      next_action:{type:"OPEN_OVERVIEW",label:"Open SkillTwin",href:"/overview"}
    });
  } catch (error) {
    if (error instanceof UnauthenticatedError) return fail(requestId,401,"UNAUTHENTICATED","Sign in to complete onboarding.");
    return fail(requestId,500,"ONBOARDING_COMPLETE_FAILED","Could not complete onboarding.");
  }
}
