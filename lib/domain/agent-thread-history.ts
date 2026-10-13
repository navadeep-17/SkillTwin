import { AGENT_READ_TOOLS } from "./agent-read-plan.js";

export type ChatHistoryRef={type:string;id:string;label:string};
export type ChatHistoryMessage={
  id:string;role:"USER"|"ASSISTANT";content:string;
  refs:ChatHistoryRef[];agentMode:string|null;readTools:string[];
};
export type PendingChatAction={
  id:string;actionType:"UNDO_PLAN_DIFF"|"START_ASSESSMENT"|"GENERATE_PLAN";
  label:string;payload:Record<string,unknown>;expiresAt:string;
};
function parseJson(raw:unknown):unknown {
  let data=raw;
  for(let i=0;i<2&&typeof data==="string";i++) {
    try { data=JSON.parse(data); } catch { break; }
  }
  return data;
}
function object(raw:unknown):Record<string,unknown> {
  const parsed=parseJson(raw);
  return parsed&&typeof parsed==="object"&&!Array.isArray(parsed)
    ?parsed as Record<string,unknown>:{};
}
function uuid(raw:unknown):raw is string {
  return typeof raw==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw);
}
const proposalLabels:Record<PendingChatAction["actionType"],string>={
  START_ASSESSMENT:"Start the proposed skill challenge",
  GENERATE_PLAN:"Generate the proposed learning roadmap",
  UNDO_PLAN_DIFF:"Undo the proposed roadmap change"
};

/** Hydration never trusts stored model metadata or leaks internal tool args. */
export function hydrateChatMessages(rawRows:Record<string,unknown>[]):ChatHistoryMessage[] {
  return rawRows.flatMap(row=>{
    if(!uuid(row.id)||!["USER","ASSISTANT"].includes(String(row.role))
      ||typeof row.content!=="string")return [];
    const metadata=object(row.metadata);
    const parsedRefs=parseJson(row.entity_refs);
    const refs:ChatHistoryRef[]=Array.isArray(parsedRefs)?parsedRefs.slice(0,20)
      .filter((ref):ref is Record<string,unknown>=>ref&&typeof ref==="object"&&!Array.isArray(ref))
      .filter(ref=>typeof ref.type==="string"&&uuid(ref.id)&&typeof ref.label==="string")
      .map(ref=>({type:String(ref.type),id:String(ref.id),label:String(ref.label).slice(0,100)})):[];
    const tools=Array.isArray(metadata.readTools)
      ?metadata.readTools.filter((name):name is string=>
          typeof name==="string"&&AGENT_READ_TOOLS.includes(name as typeof AGENT_READ_TOOLS[number]))
          .slice(0,3):[];
    const mode=["gemini-read-plan-v1","deterministic-read-fallback-v1","deterministic-grounded-i1","confirmed-action-event-v1"]
      .includes(String(metadata.generator))?String(metadata.generator):null;
    return [{
      id:row.id,
      role:row.role as ChatHistoryMessage["role"],
      content:row.content,
      refs:row.role==="ASSISTANT"?refs:[],
      agentMode:row.role==="ASSISTANT"?mode:null,
      readTools:row.role==="ASSISTANT"?tools:[]
    }];
  });
}

/** Only live and still-approvable proposals may reappear on session restore. */
export function pendingChatAction(
  rawRows:Record<string,unknown>[],nowMs:number
):PendingChatAction|null {
  const rows=[...rawRows].reverse();
  for(const row of rows) {
    if(row.status!=="PROPOSED" || !uuid(row.id))continue;
    const actionType=String(row.action_type) as PendingChatAction["actionType"];
    if(!Object.hasOwn(proposalLabels,actionType))continue;
    const expiresAt=new Date(String(row.expires_at??""));
    if(!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime()<=nowMs)continue;
    return {
      id:row.id,
      actionType,
      label:proposalLabels[actionType],
      payload:object(row.payload),
      expiresAt:expiresAt.toISOString()
    };
  }
  return null;
}

/** Thread titles avoid duplicating long or whitespace-heavy learner prompts. */
export function firstChatTitle(message:string):string {
  const compact=message.replace(/\s+/g," ").trim();
  return compact.length>60?compact.slice(0,57)+"...":compact||"SkillTwin journey";
}
