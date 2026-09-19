import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";
import { getAdaptiveReplannerService } from "@/lib/services/replanner/adaptive-replanner-service";
import { getAssessmentService } from "@/lib/services/assessment/assessment-service";
import { getInitialPlanService } from "@/lib/services/planner/initial-plan-service";
import { getSql } from "@/lib/db/postgres";

type Row=Record<string,unknown>;
const rows=(value:unknown)=>value as Row[];

export const runtime="nodejs";
export const dynamic="force-dynamic";

function objectValue(value:unknown){
  return value && typeof value==="object" && !Array.isArray(value) ? value as Record<string,unknown> : {};
}

async function assertFreshBaseline(userId:string,actionType:string,baseline:Record<string,unknown>){
  const sql=getSql();

  if(actionType==="UNDO_PLAN_DIFF"){
    const expectedPlanId=baseline.toPlanId ? String(baseline.toPlanId) : null;
    const expectedVersion=baseline.toVersion == null ? null : Number(baseline.toVersion);
    const active=rows(await sql.unsafe(
      "select id,version from public.learning_plans where user_id=$1::uuid and status='ACTIVE' order by version desc limit 1",
      [userId]
    ))[0];
    if(!active || !expectedPlanId || String(active.id)!==expectedPlanId || Number(active.version)!==expectedVersion) {
      throw new Error("CHAT_ACTION_STALE_BASELINE");
    }
    return;
  }

  if(actionType==="START_ASSESSMENT" || actionType==="GENERATE_PLAN"){
    const expectedGap=baseline.gapSnapshotId ? String(baseline.gapSnapshotId) : null;
    if(expectedGap){
      const latest=rows(await sql.unsafe(
        "select id from public.gap_snapshots where user_id=$1::uuid order by created_at desc limit 1",
        [userId]
      ))[0];
      if(!latest || String(latest.id)!==expectedGap) throw new Error("CHAT_ACTION_STALE_BASELINE");
    }
  }

  if(actionType==="GENERATE_PLAN"){
    const active=rows(await sql.unsafe(
      "select id from public.learning_plans where user_id=$1::uuid and status='ACTIVE' limit 1",
      [userId]
    ))[0];
    if(active) throw new Error("CHAT_ACTION_STALE_BASELINE");
  }
}

export async function POST(_request:Request,context:{params:Promise<{id:string}>}){
  const requestId=await getRequestId();
  try{
    const {id}=await context.params;
    const {user}=await requireUser();
    const sql=getSql();

    const proposal=rows(await sql.unsafe(
      "select * from public.chat_action_proposals where id=$1::uuid and user_id=$2::uuid limit 1",
      [id,user.id]
    ))[0];
    if(!proposal) return fail(requestId,404,"NOT_FOUND","Action proposal not found.");
    if(String(proposal.status)!=="PROPOSED") return fail(requestId,409,"ACTION_NOT_PROPOSED","This action proposal is no longer pending.");
    if(new Date(String(proposal.expires_at)).getTime()<=Date.now()){
      await sql.unsafe("update public.chat_action_proposals set status='EXPIRED' where id=$1::uuid and user_id=$2::uuid",[id,user.id]);
      return fail(requestId,409,"ACTION_EXPIRED","This action proposal expired. Ask Journey Chat again.");
    }

    const payload=objectValue(proposal.payload);
    const baseline=objectValue(proposal.baseline_ref);
    await assertFreshBaseline(user.id,String(proposal.action_type),baseline);

    const confirmed=rows(await sql.unsafe(
      "update public.chat_action_proposals set status='CONFIRMED' where id=$1::uuid and user_id=$2::uuid and status='PROPOSED' returning id",
      [id,user.id]
    ));
    if(!confirmed[0]) return fail(requestId,409,"ACTION_NOT_PROPOSED","This action proposal is no longer pending.");

    let result:unknown;
    try{
      if(String(proposal.action_type)==="UNDO_PLAN_DIFF"){
        const diffId=String(payload.diffId ?? "");
        if(!diffId) throw new Error("MISSING_DIFF_ID");
        result=await getAdaptiveReplannerService().undo(user.id,diffId);
      }else if(String(proposal.action_type)==="START_ASSESSMENT"){
        result=await getAssessmentService().create({
          userId:user.id,
          targetSkillId:payload.targetSkillId ? String(payload.targetSkillId) : undefined,
          mode:"CHALLENGE_ME"
        });
      }else if(String(proposal.action_type)==="GENERATE_PLAN"){
        result=await getInitialPlanService().generate(user.id);
      }else{
        throw new Error("UNSUPPORTED_CHAT_ACTION");
      }

      await sql.unsafe(
        "update public.chat_action_proposals set status='EXECUTED',executed_at=now() where id=$1::uuid and user_id=$2::uuid",
        [id,user.id]
      );
      await sql.unsafe(
        "insert into public.agent_events(user_id,event_type,trigger_type,trigger_ref,summary,entity_refs,metadata) values ($1::uuid,'chat.action.executed','JOURNEY_CHAT',$2,$3,$4::jsonb,$5::jsonb)",
        [
          user.id,id,
          "Executed confirmed Journey Chat action: "+String(proposal.action_type)+".",
          JSON.stringify([{type:"chat_action_proposal",id}]),
          JSON.stringify({actionType:String(proposal.action_type),baselineRef:baseline})
        ]
      );
    }catch(dispatchError){
      await sql.unsafe(
        "update public.chat_action_proposals set status='FAILED' where id=$1::uuid and user_id=$2::uuid",
        [id,user.id]
      );
      throw dispatchError;
    }

    const actionType=String(proposal.action_type);
    return ok(requestId,{actionType,result},{
      notifications:[{
        title:"Action completed",
        message:actionType==="UNDO_PLAN_DIFF"
          ? "The confirmed roadmap undo was validated and applied."
          : actionType==="START_ASSESSMENT"
            ? "Your confirmed challenge is ready."
            : "Your confirmed roadmap action completed.",
        tone:"success"
      }],
      next_action:actionType==="START_ASSESSMENT" && result && typeof result==="object" && "assessment" in result
        ? {type:"OPEN_ASSESSMENT",label:"Open challenge",href:"/practice/"+String((result as {assessment:{id:unknown}}).assessment.id)}
        : {type:"OPEN_ROADMAP",label:"View roadmap",href:"/roadmap"}
    });
  }catch(error){
    if(error instanceof UnauthenticatedError) return fail(requestId,401,"UNAUTHENTICATED","Sign in to confirm this action.");
    const message=error instanceof Error?error.message:String(error);
    if(message==="CHAT_ACTION_STALE_BASELINE") return fail(requestId,409,"CHAT_ACTION_STALE_BASELINE","Your SkillTwin changed after this proposal was created. Ask Journey Chat again before executing it.");
    console.error("chat.action.confirm.failed",{requestId,error:message});
    return fail(requestId,409,"CHAT_ACTION_FAILED","The action could not be safely executed from the current state.");
  }
}
