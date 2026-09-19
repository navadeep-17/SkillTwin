import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";
import { getSql } from "@/lib/db/postgres";
import { getGapAnalysisService } from "@/lib/services/gaps/gap-analysis-service";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function POST(_request:Request,context:{params:Promise<{id:string}>}) {
  const requestId=await getRequestId();
  try {
    const {id}=await context.params;
    const {user}=await requireUser();
    const sql=getSql();
    const rows=await sql.unsafe("select id,status from public.career_goals where id=$1::uuid and user_id=$2::uuid limit 1",[id,user.id]) as Array<Record<string,unknown>>;
    if (!rows[0]) return fail(requestId,404,"NOT_FOUND","Career goal not found.");
    if (String(rows[0].status)!=="ACTIVE") return fail(requestId,409,"GOAL_NOT_ACTIVE","Only the active career goal can be recomputed.");
    return ok(requestId,await getGapAnalysisService().recompute(user.id,{type:"EXPLICIT_RECOMPUTE",ref:id}));
  } catch (error) {
    if (error instanceof UnauthenticatedError) return fail(requestId,401,"UNAUTHENTICATED","Sign in to recompute gaps.");
    return fail(requestId,500,"GAP_RECOMPUTE_FAILED","Could not recompute role gaps.");
  }
}
