/** Bounded, pure allowlist for model-selected learner-state reads. */
export const AGENT_READ_TOOLS = [
  "get_skill_state",
  "get_assessment_proof",
  "get_role_gap",
  "get_active_plan",
  "get_next_tasks",
  "get_replan_reason",
  "get_activity"
] as const;
export type AgentReadTool = typeof AGENT_READ_TOOLS[number];

export type AgentReadIntent =
  | "EXPLAIN_ASSESSMENT"
  | "WHY_ROADMAP_CHANGED"
  | "WHAT_NEXT"
  | "READINESS"
  | "SKILL_STATUS"
  | "JOURNEY_SUMMARY";

export function fallbackReadTools(intent: AgentReadIntent): AgentReadTool[] {
  switch (intent) {
    case "EXPLAIN_ASSESSMENT": return ["get_assessment_proof"];
    case "WHY_ROADMAP_CHANGED": return ["get_replan_reason"];
    case "WHAT_NEXT": return ["get_next_tasks","get_active_plan"];
    case "READINESS": return ["get_role_gap"];
    case "SKILL_STATUS": return ["get_skill_state","get_role_gap"];
    default: return ["get_role_gap","get_next_tasks"];
  }
}

/** Refuse invalid/unknown/duplicate/excess model tool requests: never silently dispatch. */
export function validateReadPlan(raw: unknown): AgentReadTool[] | null {
  if(!raw || typeof raw!=="object" || Array.isArray(raw)) return null;
  const obj=raw as Record<string,unknown>;
  if(Object.keys(obj).some(k=>k!=="tools") || !Array.isArray(obj.tools)
    || obj.tools.length<1 || obj.tools.length>3) return null;
  const requested=obj.tools as unknown[];
  if(requested.some(t=>typeof t!=="string" || !AGENT_READ_TOOLS.includes(t as AgentReadTool)))
    return null;
  if(new Set(requested).size!==requested.length) return null;
  return requested as AgentReadTool[];
}

export function isMutatingJourneyIntent(intent:string):boolean {
  return intent==="UNDO_ROADMAP_CHANGE" || intent==="START_ASSESSMENT" || intent==="GENERATE_PLAN";
}
