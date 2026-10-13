import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {ARENA_TOPICS,ARENA_LABELS,parseArenaState,arenaApiError} from "../dist/lib/domain/arena.js";

const read=file=>readFileSync(new URL("../"+file,import.meta.url),"utf8");

test("only three supported real-learner challenge topics",()=>{
  assert.deepEqual(ARENA_TOPICS,["python","sql","javascript"]);
  for(const topic of ARENA_TOPICS)assert.ok(ARENA_LABELS[topic]);
});
test("client shape strips hidden quiz answer keys from any unexpected response",()=>{
  const state=parseArenaState({
    status:"PLAYING",matchId:"00000000-0000-0000-0000-000000000001",
    topic:"python",questionNumber:1,totalQuestions:5,
    question:"What is a list?",options:["A","B","C","D"],
    correct_option:2,answered:false,rivalAnswered:true,secondsRemaining:21
  });
  assert.equal(state.status,"PLAYING");
  assert.equal("correct_option" in state,false);
  assert.throws(()=>parseArenaState({status:"PLAYING",topic:"sql"}));
  assert.throws(()=>parseArenaState({status:"FINISHED",topic:"sql",myScore:9}));
  assert.deepEqual(parseArenaState({status:"IDLE",user_id:"secret"}),{status:"IDLE"});
});
test("valid completed scores, no invented results",()=>{
  const base={status:"FINISHED",matchId:"00000000-0000-0000-0000-000000000001",
    topic:"javascript",totalQuestions:5,myScore:3,rivalScore:4,outcome:"LOSS"};
  assert.deepEqual(parseArenaState(base),base);
  assert.throws(()=>parseArenaState({...base,outcome:"BOT_WIN"}));
});
test("sensitive database exception details are not returned",()=>{
  const result=arenaApiError({message:"unexpected internal table or credential data"});
  assert.equal(result.status,503);
  assert.doesNotMatch(result.message,/credential|internal table/);
  assert.equal(arenaApiError({message:"ARENA_QUESTION_CLOSED"}).status,409);
  assert.equal(arenaApiError({message:"ARENA_MATCH_NOT_FOUND"}).status,404);
});
test("database match pairing is atomic and avoids stale or duplicate players",()=>{
  const schema=read("supabase/migrations/0027_arena_random_duel.sql");
  assert.match(schema,/pg_advisory_xact_lock\(74351/);
  assert.match(schema,/pg_advisory_xact_lock\(74352/);
  assert.match(schema,/for update skip locked limit 1/);
  assert.match(schema,/user_id<>v_user/);
  assert.match(schema,/v_rival is null/);
  assert.match(schema,/on conflict \(user_id\) do update/);
  assert.match(schema,/status='WAITING'/);
  assert.match(schema,/updated_at>clock_timestamp\(\)-interval '25 seconds'/);
  assert.match(schema,/started_at \+ interval '150 seconds'/);
  assert.match(schema,/constraint arena_distinct_players check \(player_a <> player_b\)/);
});
test("database answer keys and results are server-owned, not user-editable",()=>{
  const ddl=read("supabase/migrations/0027_arena_random_duel.sql");
  for(const name of ["arena_questions","arena_matches","arena_lobby","arena_answers"]){
    assert.match(ddl,new RegExp("alter table public\\."+name+" enable row level security;"));
    assert.match(ddl,new RegExp("alter table public\\."+name+" force row level security;"));
  }
  assert.match(ddl,/revoke all on public\.arena_questions,public\.arena_matches,public\.arena_lobby,public\.arena_answers from public,anon,authenticated/);
  assert.match(ddl,/grant execute on function public\.arena_submit_answer\(uuid,integer,integer\) to authenticated/);
  assert.match(ddl,/where id=p_match_id and \(player_a=v_user or player_b=v_user\)/);
  assert.match(ddl,/on conflict do nothing returning 1 into v_saved/);
  assert.match(ddl,/v_current<>p_question_no/);
  assert.match(ddl,/a\.option_index=q\.correct_option/);
  assert.match(ddl,/select prompt,options into v_prompt,v_options/);
  assert.doesNotMatch(ddl,/grant select on public\.arena_questions/);
  assert.doesNotMatch(ddl,/\bupdate public\.user_skills\b|\binsert into public\.skill_evidence\b/i);
  assert.equal((ddl.match(/\('python',[1-5],/g)||[]).length,5);
  assert.equal((ddl.match(/\('sql',[1-5],/g)||[]).length,5);
  assert.equal((ddl.match(/\('javascript',[1-5],/g)||[]).length,5);
});
test("all endpoints authenticate and use only server-owned RPCs",()=>{
  const match=read("app/api/arena/match/route.ts");
  const state=read("app/api/arena/state/route.ts");
  const answer=read("app/api/arena/answer/route.ts");
  for(const route of [match,state,answer]){
    assert.match(route,/requireUser\(\)/);
    assert.match(route,/UnauthenticatedError/);
    assert.match(route,/401,"UNAUTHENTICATED"/);
    assert.doesNotMatch(route,/supabase\.from\("arena_questions"\)/);
  }
  assert.match(match,/arena_find_match/);
  assert.match(match,/arena_cancel_wait/);
  assert.match(state,/arena_get_state/);
  assert.match(answer,/arena_submit_answer/);
  assert.match(answer,/optionIndex:z\.number\(\)\.int\(\)\.min\(0\)\.max\(3\)/);
  const page=read("app/arena/page.tsx");
  const nav=read("components/shell/app-nav-links.tsx");
  const middleware=read("middleware.ts");
  const ui=read("components/arena/arena-duel.tsx");
  assert.match(page,/redirect\("\/login"\)/);
  assert.ok(nav.includes('href: "/arena"'));
  assert.ok(middleware.includes('"/arena"'));
  assert.match(ui,/window\.setInterval\(\(\)=>void refresh\(\),1500\)/);
  assert.match(ui,/No chat or answers are shared during live questions/);
  assert.match(ui,/practice match/);
  assert.doesNotMatch(ui,/setTimeout.*setArena/);
});
