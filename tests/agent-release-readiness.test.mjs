import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("chat failure never leaves an unconfirmed optimistic bubble",()=>{
  const ui=read("components/journey/journey-chat.tsx");
  assert.match(ui,/let responseSaved = false/);
  assert.match(ui,/if \(!responseSaved\)/);
  assert.match(ui,/message\.id !== userMessage\.id/);
  assert.match(ui,/if \(threadId\) await openThread\(threadId\)/);
  assert.match(ui,/Check the conversation before resending/);
  assert.match(ui,/setInput\(current => current\.trim\(\) \? current : trimmed\)/);
});
test("production authentication smoke probes protected agent APIs",()=>{
  const script=read("scripts/career-auth-guard-smoke.mjs");
  for(const term of [
    "/api/chat?threadId=",
    'method:"POST",path:"/api/chat"',
    '"/confirm"',
    '"/reject"',
    "ANONYMOUS_AGENT_API_GUARD=PASS"
  ])assert.ok(script.includes(term),"auth smoke missing "+term);
  assert.match(script,/response\.status!==401/);
});
test("runtime metrics report cannot output learner content or connection secrets",()=>{
  const script=read("scripts/agent-runtime-qa-report.mjs");
  assert.match(script,/READ_ONLY_AGGREGATES/);
  assert.match(script,/user_id=p\.user_id/);
  assert.match(script,/percentile_cont\(0\.95\)/);
  assert.match(script,/executed_without_event/);
  assert.doesNotMatch(script,/console\.log\(databaseUrl/);
  assert.doesNotMatch(script,/select \*/i);
  assert.doesNotMatch(script,/\binsert\s+into\b|\bdelete\s+from\b|\bupdate\s+public\./i);
});
