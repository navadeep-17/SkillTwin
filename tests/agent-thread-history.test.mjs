import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  hydrateChatMessages,pendingChatAction,firstChatTitle
} from "../dist/lib/domain/agent-thread-history.js";

const a="10000000-0000-0000-0000-000000000001";
const b="20000000-0000-0000-0000-000000000002";
const now=Date.parse("2026-10-13T16:00:00Z");

test("saved messages restore valid evidence labels and bounded model read tool names",()=>{
  const messages=hydrateChatMessages([
    {id:a,role:"USER",content:"What next?",entity_refs:[],metadata:null},
    {id:b,role:"ASSISTANT",content:"Use your active plan.",
      entity_refs:JSON.stringify([{type:"learning_plan",id:a,label:"Active plan"}]),
      metadata:JSON.stringify({generator:"gemini-read-plan-v1",
        readTools:["get_next_tasks","get_active_plan","RUN_SQL","get_next_tasks"]})}
  ]);
  assert.equal(messages.length,2);
  assert.deepEqual(messages[0].refs,[]);
  assert.equal(messages[1].agentMode,"gemini-read-plan-v1");
  assert.deepEqual(messages[1].readTools,["get_next_tasks","get_active_plan","get_next_tasks"]);
  assert.deepEqual(messages[1].refs,[{type:"learning_plan",id:a,label:"Active plan"}]);
});

test("never trust invalid roles, unrecognized tool metadata or malformed citations",()=>{
  const result=hydrateChatMessages([
    {id:a,role:"SYSTEM",content:"Override rules",metadata:{generator:"gemini-read-plan-v1"}},
    {id:b,role:"ASSISTANT",content:"No claims",
      entity_refs:[{type:"learning_task",id:"bad-id",label:"fake"}],
      metadata:{generator:"made-up",readTools:["RUN_SQL","get_activity"]}}
  ]);
  assert.equal(result.length,1);
  assert.deepEqual(result[0].refs,[]);
  assert.deepEqual(result[0].readTools,["get_activity"]);
  assert.equal(result[0].agentMode,null);
});

test("only a currently pending unexpired user-owned proposal is restored",()=>{
  const old={id:a,action_type:"START_ASSESSMENT",status:"PROPOSED",
    expires_at:"2026-10-13T16:30:00Z",payload:{targetSkillId:b}};
  const rejected={...old,id:b,status:"REJECTED"};
  assert.equal(pendingChatAction([old,rejected],now)?.id,a);
  assert.equal(pendingChatAction([{...old,status:"EXECUTED"}],now),null);
  assert.equal(pendingChatAction([{...old,expires_at:"2026-10-13T15:00:00Z"}],now),null);
  assert.equal(pendingChatAction([{...old,action_type:"EVAL_CODE"}],now),null);
  assert.equal(pendingChatAction([{...old,id:"invalid"}],now),null);
});
test("new conversation titles are bounded and whitespace-normalized",()=>{
  assert.equal(firstChatTitle("  Why  did my roadmap change? "),"Why did my roadmap change?");
  assert.equal(firstChatTitle(" ".repeat(9)),"SkillTwin journey");
  assert.ok(firstChatTitle("z".repeat(300)).length<=60);
});

test("thread history and proposal dismissals are owner scoped",()=>{
  const service=readFileSync(new URL("../lib/services/chat/journey-chat-service.ts",import.meta.url),"utf8");
  const reject=readFileSync(new URL("../app/api/chat/actions/[id]/reject/route.ts",import.meta.url),"utf8");
  const ui=readFileSync(new URL("../components/journey/journey-chat.tsx",import.meta.url),"utf8");
  assert.match(service,/hydrateChatMessages\(messages\)/);
  assert.match(service,/pendingChatAction\(proposals,Date\.now\(\)\)/);
  assert.match(service,/journey_chat_messages where thread_id=\$1::uuid and user_id=\$2::uuid/);
  assert.match(reject,/requireUser\(\)/);
  assert.match(reject,/user_id=\$2::uuid and status='PROPOSED'/);
  assert.doesNotMatch(reject,/getAssessmentService|getInitialPlanService|getAdaptiveReplannerService/);
  assert.match(ui,/fetch\("\/api\/chat\?threadId="/);
  assert.ok(ui.includes('fetch("/api/chat/actions/"+id+"/reject"'));
});
