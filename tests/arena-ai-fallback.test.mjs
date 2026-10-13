import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseArenaState} from "../dist/lib/domain/arena.js";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const matchId="00000000-0000-0000-0000-000000000001";
const question={topic:"python",matchId,questionNumber:2,totalQuestions:5,
  question:"What is 1+1?",options:["1","2","3","4"],
  answered:false,secondsRemaining:18};

test("WAITING shows an authoritative AI wait countdown without fabricating an opponent",()=>{
  assert.deepEqual(parseArenaState({status:"WAITING",topic:"python",aiAvailableInSeconds:13}),
    {status:"WAITING",topic:"python",aiAvailableInSeconds:13});
  assert.throws(()=>parseArenaState({status:"WAITING",topic:"python",aiAvailableInSeconds:-1}));
  assert.deepEqual(parseArenaState({status:"AI_PREPARING",topic:"python"}),{
    status:"AI_PREPARING",topic:"python"
  });
});

test("AI, human and solo are visibly distinct types and do not leak picks",()=>{
  const ai=parseArenaState({...question,status:"AI_PLAYING",rivalAnswered:true,correct_option:1});
  assert.equal(ai.status,"AI_PLAYING");
  assert.equal("correct_option" in ai,false);
  assert.equal("picks" in ai,false);
  const solo=parseArenaState({...question,status:"SOLO_PLAYING",picks:[1,1,1,1,1]});
  assert.equal(solo.status,"SOLO_PLAYING");
  assert.equal("picks" in solo,false);
  assert.equal("rivalAnswered" in solo,false);
  assert.equal(parseArenaState({status:"SOLO_FINISHED",topic:"python",matchId,
    totalQuestions:5,myScore:4}).status,"SOLO_FINISHED");
  assert.equal(parseArenaState({status:"AI_FINISHED",topic:"sql",matchId,
    totalQuestions:5,myScore:4,rivalScore:2,outcome:"WIN"}).status,"AI_FINISHED");
});

test("20-second queue age is immutable under heartbeats; simultaneous real match wins safely",()=>{
  const ddl=read("supabase/migrations/0028_arena_ai_fallback.sql");
  const service=read("lib/services/arena/arena-ai-service.ts");
  assert.match(ddl,/add column if not exists queued_at timestamptz/);
  assert.match(ddl,/arena_lobby_queue_reset/);
  assert.match(service,/queued_at\+interval '20 seconds'/);
  assert.match(service,/pg_advisory_xact_lock\(74351/);
  assert.match(service,/pg_advisory_xact_lock\(74352/);
  assert.match(service,/for update/);
  assert.match(service,/if\(lobby\?\.status!=="WAITING"\)return null/);
  assert.match(service,/delete from public\.arena_lobby where user_id=/);
  assert.match(ddl,/arena_guard_human_lobby/);
  assert.match(ddl,/ARENA_AI_ACTIVE/);
});

test("model gets curated question text but never official keys; failures become solo, not fake AI",()=>{
  const service=read("lib/services/arena/arena-ai-service.ts");
  assert.match(service,/select question_no,prompt,options from public\.arena_questions/);
  assert.match(service,/getGeminiStructuredClient\(\)\.generateJson/);
  assert.match(service,/response\?\.answers\?\?null/);
  assert.match(service,/mode=\$\{aiPicks\?"AI":"SOLO"\}/);
  assert.match(service,/mode='SOLO',started_at=clock_timestamp\(\)/);
  assert.match(service,/select count\(\*\)::integer as score/);
  assert.doesNotMatch(service,/select question_no,prompt,options,correct_option/);
  assert.doesNotMatch(service,/random\(\)|Math\.random/);
});

test("AI answer table has no client read or write privileges and its picks cannot be posted",()=>{
  const ddl=read("supabase/migrations/0028_arena_ai_fallback.sql");
  const service=read("lib/services/arena/arena-ai-service.ts");
  const route=read("app/api/arena/ai/route.ts");
  const answer=read("app/api/arena/answer/route.ts");
  const state=read("app/api/arena/state/route.ts");
  assert.match(ddl,/revoke all on public\.arena_ai_sessions,public\.arena_ai_answers from public,anon,authenticated/);
  assert.match(ddl,/alter table public\.arena_ai_answers enable row level security/);
  assert.match(ddl,/check\(mode in \('PREPARING','AI','SOLO'\)\)/);
  assert.match(route,/requireUser\(\)/);
  assert.match(route,/startAiAfterWait\(user\.id\)/);
  assert.match(answer,/submitAiAnswer\(user\.id,parsed\.data\)/);
  assert.match(state,/getArenaState\(user\.id\)/);
  assert.match(service,/on conflict do nothing returning 1 as accepted/);
  assert.match(service,/clock_timestamp\(\)-started_at/);
  assert.match(service,/and user_id=\$\{userId\}::uuid/);
  assert.doesNotMatch(ddl,/grant .* on public\.arena_ai_sessions to authenticated/);
});

test("Arena UI defaults AI auto-fallback enabled but users may continue human queue",()=>{
  const ui=read("components/arena/arena-duel.tsx");
  assert.match(ui,/useState\(true\)/);
  assert.match(ui,/aiAvailableInSeconds===0/);
  assert.match(ui,/onChange=\{event=>setAutoAi\(event\.target\.checked\)\}/);
  assert.match(ui,/Automatically switch to AI if no one joins/);
  assert.match(ui,/Play against AI now/);
  assert.match(ui,/AI Opponent/);
  assert.match(ui,/Solo practice complete/);
  assert.match(ui,/AI_PREPARING/);
  assert.match(ui,/\/api\/arena\/ai/);
});
