import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";
import { getAdaptiveReplannerService } from "@/lib/services/replanner/adaptive-replanner-service";
import { getAssessmentService } from "@/lib/services/assessment/assessment-service";
import { getInitialPlanService } from "@/lib/services/planner/initial-plan-service";
import { getSql } from "@/lib/db/postgres";
import {
  authorizeAgentAction, decodeAgentAction, validActionUuid,
  type CurrentActionState, type GuardAction
} from "@/lib/domain/agent-action-guard";

type Row = Record<string, unknown>;
const rows = (value: unknown) => value as Row[];

function parseJsonObject(value: unknown): Record<string, unknown> {
  let current=value;
  for(let i=0;i<2 && typeof current==="string";i+=1) {
    try { current=JSON.parse(current); } catch { break; }
  }
  return current && typeof current==="object" && !Array.isArray(current)
    ? current as Record<string,unknown> : {};
}

/** Only learner-owned current data may authorize a previously suggested action. */
async function currentActionState(userId:string,action:GuardAction):Promise<CurrentActionState> {
  const sql=getSql();
  const [gapRows,planRows,eligibleRows,diffRows]=await Promise.all([
    sql.unsafe(
      "select gs.id from public.gap_snapshots gs join public.career_goals g on g.id=gs.goal_id where gs.user_id=$1::uuid and g.user_id=$1::uuid and g.status='ACTIVE' order by gs.created_at desc limit 1",
      [userId]
    ),
    sql.unsafe(
      "select id,version from public.learning_plans where user_id=$1::uuid and status='ACTIVE' order by version desc limit 1",
      [userId]
    ),
    action.type==="START_ASSESSMENT" ? sql.unsafe(
      "select exists (select 1 from public.skill_gap_results sgr join public.gap_snapshots gs on gs.id=sgr.snapshot_id where gs.user_id=$1::uuid and sgr.snapshot_id=$2::uuid and sgr.skill_id=$3::uuid and (select count(*) from public.assessment_question_bank qb where qb.skill_id=sgr.skill_id and qb.is_active=true and qb.type in ('MCQ','SHORT_TEXT','SCENARIO'))>=4) as eligible",
      [userId,action.gapSnapshotId,action.targetSkillId]
    ) : Promise.resolve([]),
    action.type==="UNDO_PLAN_DIFF" ? sql.unsafe(
      "select id,status,can_undo,to_plan_id,to_version from public.plan_diffs where user_id=$1::uuid and id=$2::uuid limit 1",
      [userId,action.diffId]
    ) : Promise.resolve([])
  ]);
  const gap=rows(gapRows)[0],plan=rows(planRows)[0],diff=rows(diffRows)[0];
  return {
    gapSnapshotId:gap ? String(gap.id) : null,
    activePlanId:plan ? String(plan.id) : null,
    activePlanVersion:plan ? Number(plan.version) : null,
    eligibleSkill:rows(eligibleRows)[0]?.eligible===true,
    diff:diff ? {
      id:String(diff.id),status:String(diff.status),canUndo:diff.can_undo===true,
      toPlanId:diff.to_plan_id==null ? null : String(diff.to_plan_id),
      toVersion:diff.to_version==null ? null : Number(diff.to_version)
    } : null
  };
}

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function POST(
  _request:Request,context:{params:Promise<{id:string}>}
) {
  const requestId=await getRequestId();
  try {
    const {id}=await context.params;
    const {user}=await requireUser();
    if(!validActionUuid(id)) {
      return fail(requestId,400,"INVALID_ACTION_ID","Invalid action identifier.");
    }
    const sql=getSql();
    const proposalRows=rows(await sql.unsafe(
      "select * from public.chat_action_proposals where id=$1::uuid and user_id=$2::uuid limit 1",
      [id,user.id]
    ));
    const proposal=proposalRows[0];
    if(!proposal) return fail(requestId,404,"NOT_FOUND","Action proposal not found.");
    if(String(proposal.status)!=="PROPOSED") {
      return fail(requestId,409,"ACTION_NOT_PROPOSED",
        "This action was already handled or is still processing. Ask SkillTwin for a new proposal if needed.");
    }
    if(new Date(String(proposal.expires_at)).getTime()<=Date.now()) {
      const expired=rows(await sql.unsafe(
        "update public.chat_action_proposals set status='EXPIRED' where id=$1::uuid and user_id=$2::uuid and status='PROPOSED' and expires_at<=now() returning id",
        [id,user.id]
      ));
      return fail(requestId,409,expired[0] ? "ACTION_EXPIRED" : "ACTION_ALREADY_CLAIMED",
        "This action expired or was already handled. Ask SkillTwin again.");
    }

    const decoded=decodeAgentAction(
      proposal.action_type,parseJsonObject(proposal.payload),parseJsonObject(proposal.baseline_ref)
    );
    if(!decoded.ok) {
      const rejected=rows(await sql.unsafe(
        "update public.chat_action_proposals set status='REJECTED' where id=$1::uuid and user_id=$2::uuid and status='PROPOSED' returning id",
        [id,user.id]
      ));
      return fail(requestId,409,rejected[0]?decoded.code:"ACTION_ALREADY_CLAIMED",
        "This action is invalid or has already been handled. Ask SkillTwin for a fresh proposal.");
    }

    const snapshot=await currentActionState(user.id,decoded.action);
    const approval=authorizeAgentAction(decoded.action,snapshot);
    if(!approval.ok) {
      const rejected=rows(await sql.unsafe(
        "update public.chat_action_proposals set status='REJECTED' where id=$1::uuid and user_id=$2::uuid and status='PROPOSED' returning id",
        [id,user.id]
      ));
      return fail(requestId,409,rejected[0]?approval.code:"ACTION_ALREADY_CLAIMED",
        approval.code==="INELIGIBLE_SKILL"
          ? "This skill no longer has a supported challenge. Ask SkillTwin again."
          : "Your plan or skill context has changed. Ask SkillTwin for an updated action.");
    }

    // Compare-and-swap: concurrent confirmations cannot dispatch twice.
    const claimed=rows(await sql.unsafe(
      "update public.chat_action_proposals set status='CONFIRMED' where id=$1::uuid and user_id=$2::uuid and status='PROPOSED' and expires_at>now() returning id",
      [id,user.id]
    ));
    if(!claimed[0]) {
      return fail(requestId,409,"ACTION_ALREADY_CLAIMED",
        "This action was already confirmed, changed or expired.");
    }

    let result:unknown;
    try {
      if(approval.action.type==="UNDO_PLAN_DIFF") {
        result=await getAdaptiveReplannerService().undo(user.id,approval.action.diffId);
      } else if(approval.action.type==="START_ASSESSMENT") {
        result=await getAssessmentService().create({
          userId:user.id,targetSkillId:approval.action.targetSkillId,mode:"CHALLENGE_ME"
        });
      } else {
        result=await getInitialPlanService().generate(user.id);
      }
    } catch(dispatchError) {
      // Never dispatch this proposal again, even if the domain operation
      // reported an error after partially completing.
      await sql.unsafe(
        "update public.chat_action_proposals set status='FAILED' where id=$1::uuid and user_id=$2::uuid and status='CONFIRMED'",
        [id,user.id]
      );
      throw dispatchError;
    }

    const actionType=approval.action.type;
    try {
      // The status and visible agent audit event either commit together or
      // neither commits. If recording fails after the domain action, keep
      // CONFIRMED for manual reconciliation; never execute a second time.
      await sql.begin(async tx=>{
        const executed=rows(await tx.unsafe(
          "update public.chat_action_proposals set status='EXECUTED',executed_at=now() where id=$1::uuid and user_id=$2::uuid and status='CONFIRMED' returning id",
          [id,user.id]
        ));
        if(!executed[0]) throw new Error("ACTION_STATUS_CHANGED_DURING_DISPATCH");
        await tx.unsafe(
          "insert into public.agent_events(user_id,event_type,trigger_type,trigger_ref,summary,metadata) values ($1::uuid,'chat.action.executed','CHAT_ACTION',$2,$3,$4::jsonb)",
          [user.id,id,"Learner confirmed and executed "+actionType+".",
            JSON.stringify({actionType,proposalId:id})]
        );
      });
    } catch(recordError) {
      console.error("chat.action.result.persist.failed",{
        requestId,actionType,error:recordError instanceof Error ? recordError.message : "Unknown error"
      });
      return fail(requestId,503,"ACTION_RESULT_NOT_RECORDED",
        "The action may have succeeded but its confirmation record was interrupted. Check your current plan or practice before requesting a new action.");
    }
    return ok(requestId,{actionType,result},{
      notifications:[{
        title:"Action completed",
        message:actionType==="UNDO_PLAN_DIFF"
          ? "The validated roadmap undo was applied."
          : actionType==="START_ASSESSMENT"
            ? "Your confirmed challenge is ready."
            : "Your confirmed roadmap action completed.",
        tone:"success"
      }],
      next_action:actionType==="START_ASSESSMENT" && result
        && typeof result==="object" && "assessment" in result
        ? {
          type:"OPEN_ASSESSMENT",label:"Open challenge",
          href:"/practice/"+String((result as {assessment:{id:unknown}}).assessment.id)
        }
        : {type:"OPEN_ROADMAP",label:"View roadmap",href:"/roadmap"}
    });
  } catch(error) {
    if(error instanceof UnauthenticatedError) {
      return fail(requestId,401,"UNAUTHENTICATED","Sign in to confirm this action.");
    }
    console.error("chat.action.confirm.failed",{
      requestId,error:error instanceof Error ? error.message : String(error)
    });
    return fail(requestId,409,"CHAT_ACTION_FAILED",
      "The action could not be safely executed. Check your current state before trying a new proposal.");
  }
}
