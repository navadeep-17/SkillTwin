import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";
import { getSql } from "@/lib/db/postgres";

type Row=Record<string,unknown>;
const rows=(value:unknown)=>value as Row[];

export async function POST(_request:Request,context:{params:Promise<{id:string}>}){
  const requestId=await getRequestId();
  try{
    const {id}=await context.params;
    const {user}=await requireUser();
    const sql=getSql();
    const proposal=rows(await sql.unsafe(
      "update public.chat_action_proposals set status='REJECTED' where id=$1::uuid and user_id=$2::uuid and status='PROPOSED' returning *",
      [id,user.id]
    ))[0];
    if(!proposal) return fail(requestId,409,"ACTION_NOT_PROPOSED","This action proposal is no longer pending.");
    await sql.unsafe(
      "insert into public.agent_events(user_id,event_type,trigger_type,trigger_ref,summary,entity_refs,metadata) values ($1::uuid,'chat.action.rejected','JOURNEY_CHAT',$2,$3,$4::jsonb,$5::jsonb)",
      [
        user.id,id,
        "Learner kept the current state and rejected a Journey Chat action proposal.",
        JSON.stringify([{type:"chat_action_proposal",id}]),
        JSON.stringify({actionType:String(proposal.action_type)})
      ]
    );
    return ok(requestId,{id,status:"REJECTED"},{notifications:[{title:"Current state kept",message:"The proposed action was rejected and nothing was changed.",tone:"info"}]});
  }catch(error){
    if(error instanceof UnauthenticatedError) return fail(requestId,401,"UNAUTHENTICATED","Sign in to reject this action.");
    return fail(requestId,500,"CHAT_ACTION_REJECT_FAILED","Could not reject this action proposal.");
  }
}
