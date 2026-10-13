/** Agent action approval rules. Pure; never executes domain mutations. */
export type GuardAction =
  | { type:"START_ASSESSMENT"; targetSkillId:string; gapSnapshotId:string }
  | { type:"GENERATE_PLAN"; gapSnapshotId:string }
  | { type:"UNDO_PLAN_DIFF"; diffId:string; toPlanId:string; toVersion:number };

export type CurrentActionState = {
  gapSnapshotId:string|null;
  activePlanId:string|null;
  activePlanVersion:number|null;
  eligibleSkill:boolean;
  diff:null|{ id:string; status:string; canUndo:boolean; toPlanId:string|null; toVersion:number|null };
};

export type GuardResult =
  | { ok:true; action:GuardAction }
  | { ok:false; code:"INVALID_PROPOSAL"|"STALE_PROPOSAL"|"INELIGIBLE_SKILL" };

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const validActionUuid=(value:unknown):value is string =>
  typeof value==="string" && uuid.test(value);
function record(value:unknown):value is Record<string,unknown> {
  return Boolean(value) && typeof value==="object" && !Array.isArray(value);
}
function exactKeys(value:Record<string,unknown>, keys:string[]):boolean {
  return Object.keys(value).length===keys.length && keys.every(k=>Object.hasOwn(value,k));
}

/** A proposal is data, never instructions. Accept only existing supported operations. */
export function decodeAgentAction(
  type:unknown, payload:unknown, baseline:unknown
):GuardResult {
  if(!record(payload)||!record(baseline))return {ok:false,code:"INVALID_PROPOSAL"};
  if(type==="START_ASSESSMENT") {
    if(!exactKeys(payload,["targetSkillId"]) || !exactKeys(baseline,["gapSnapshotId"])
      || !validActionUuid(payload.targetSkillId) || !validActionUuid(baseline.gapSnapshotId))
      return {ok:false,code:"INVALID_PROPOSAL"};
    return {ok:true,action:{type,targetSkillId:payload.targetSkillId,gapSnapshotId:baseline.gapSnapshotId}};
  }
  if(type==="GENERATE_PLAN") {
    if(!exactKeys(payload,[]) || !exactKeys(baseline,["gapSnapshotId"])
      || !validActionUuid(baseline.gapSnapshotId))
      return {ok:false,code:"INVALID_PROPOSAL"};
    return {ok:true,action:{type,gapSnapshotId:baseline.gapSnapshotId}};
  }
  if(type==="UNDO_PLAN_DIFF") {
    if(!exactKeys(payload,["diffId"])
      || !exactKeys(baseline,["diffId","toPlanId","toVersion"])
      || !validActionUuid(payload.diffId) || !validActionUuid(baseline.diffId)
      || !validActionUuid(baseline.toPlanId)
      || payload.diffId!==baseline.diffId
      || typeof baseline.toVersion!=="number" || !Number.isSafeInteger(baseline.toVersion)
      || baseline.toVersion<1)
      return {ok:false,code:"INVALID_PROPOSAL"};
    return {ok:true,action:{
      type,diffId:payload.diffId,toPlanId:baseline.toPlanId,toVersion:baseline.toVersion
    }};
  }
  return {ok:false,code:"INVALID_PROPOSAL"};
}

/** Recheck CURRENT learner-owned state before the atomic claim and dispatch. */
export function authorizeAgentAction(action:GuardAction,state:CurrentActionState):GuardResult {
  if(action.type==="START_ASSESSMENT") {
    if(state.gapSnapshotId!==action.gapSnapshotId)return {ok:false,code:"STALE_PROPOSAL"};
    if(!state.eligibleSkill)return {ok:false,code:"INELIGIBLE_SKILL"};
  } else if(action.type==="GENERATE_PLAN") {
    if(state.gapSnapshotId!==action.gapSnapshotId || state.activePlanId!==null)
      return {ok:false,code:"STALE_PROPOSAL"};
  } else {
    const diff=state.diff;
    if(!diff || diff.id!==action.diffId || diff.status!=="APPLIED" || !diff.canUndo
      || diff.toPlanId!==action.toPlanId || diff.toVersion!==action.toVersion
      || state.activePlanId!==action.toPlanId || state.activePlanVersion!==action.toVersion)
      return {ok:false,code:"STALE_PROPOSAL"};
  }
  return {ok:true,action};
}
