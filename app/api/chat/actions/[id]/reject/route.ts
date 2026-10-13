import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";
import { getSql } from "@/lib/db/postgres";
import { validActionUuid } from "@/lib/domain/agent-action-guard";

export const runtime="nodejs";
export const dynamic="force-dynamic";

/** Dismissal is persisted; it is not equivalent to confirmation/execution. */
export async function POST(
  _request:Request,context:{params:Promise<{id:string}>}
) {
  const requestId=await getRequestId();
  try {
    const {user}=await requireUser();
    const {id}=await context.params;
    if(!validActionUuid(id))return fail(requestId,400,"INVALID_ACTION_ID","Invalid action identifier.");
    const sql=getSql();
    const rejected=await sql.unsafe(
      "update public.chat_action_proposals set status='REJECTED' where id=$1::uuid and user_id=$2::uuid and status='PROPOSED' returning id",
      [id,user.id]
    );
    if(!rejected.length) {
      return fail(requestId,409,"ACTION_NOT_PROPOSED",
        "The proposal is no longer pending or does not belong to this account.");
    }
    return ok(requestId,{id,status:"REJECTED"});
  } catch(error) {
    if(error instanceof UnauthenticatedError)
      return fail(requestId,401,"UNAUTHENTICATED","Sign in to dismiss this action.");
    console.error("chat.action.reject.failed",{
      requestId,error:error instanceof Error?error.name:"Unknown"
    });
    return fail(requestId,500,"CHAT_ACTION_REJECT_FAILED","Could not dismiss this action.");
  }
}
