import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL(path,import.meta.url),"utf8");

test("Challenge My Twin uses server-owned aggregate counts, not browser bank reads",()=>{
  const page=read("../app/challenge-my-twin/page.tsx");
  assert.match(page,/getSql\(\)\.unsafe\(/);
  assert.match(page,/count\(\*\)::integer as question_count/);
  assert.doesNotMatch(page,/\.from\(["']assessment_question_bank["']\)/);
  assert.doesNotMatch(page,/select\(["'][^"']*(answer_key|rubric)/);
  assert.match(page,/\.eq\(["']user_id["'],userId\)/);
});

test("migration withdraws authenticated answer bank SELECT and no assessment records mutate",()=>{
  const migration=read("../supabase/migrations/0025_protect_assessment_answer_bank.sql");
  const sql=migration.replace(/--[^\n]*/g,"").toLowerCase();
  assert.match(sql,/revoke select on table public\.assessment_question_bank, public\.skill_assessment_questions\s+from public, anon, authenticated/);
  assert.match(sql,/drop policy if exists assessment_bank_read/);
  assert.match(sql,/drop policy if exists skill_questions_select_own/);
  assert.match(sql,/has_table_privilege\('authenticated'/);
  assert.match(sql,/has_table_privilege\('anon'/);
  assert.doesNotMatch(sql,/\b(insert into|update|delete from|truncate|drop table)\s+public\./);
});
test("readiness explicitly detects bank privilege regression",()=>{
  const check=read("../lib/qa/database-security.ts");
  assert.match(check,/assessmentAnswerKeys: ready\(answerBankProtected\)/);
  assert.match(check,/authenticated_can_read === false/);
  assert.match(check,/anonymous_can_read === false/);
  assert.match(check,/staged_authenticated_can_read === false/);
  assert.match(check,/staged_anonymous_can_read === false/);
});
