import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {FREE_ENHANCED_REPLIES,FREE_RESUME_ANALYSES,WEEKLY_REFILL_SPARKS,
  WEEKLY_REFILL_THRESHOLD,SPARKS_PRICES,enhancedReadIsMetered} from "../lib/domain/sparks.ts";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("core features are free, Enhanced AI is explicitly opted in",()=>{
  assert.equal(enhancedReadIsMetered(false,false),false);
  assert.equal(enhancedReadIsMetered(true,true),false);
  assert.equal(enhancedReadIsMetered(true,false),true);
  assert.equal(FREE_ENHANCED_REPLIES,3);
  assert.equal(FREE_RESUME_ANALYSES,1);
  assert.equal(SPARKS_PRICES.ENHANCED_CHAT,5);
  assert.equal(SPARKS_PRICES.RESUME_REANALYSIS,15);
  assert.equal(WEEKLY_REFILL_SPARKS,20);
  assert.equal(WEEKLY_REFILL_THRESHOLD,30);
});
test("all usage quota and wallet changes are server-only and transactional",()=>{
  const sql=read("supabase/migrations/0030_sparks_consumption.sql");
  const svc=read("lib/services/sparks/sparks-consumption.ts");
  assert.match(sql,/unique \(user_id, operation_key\)/);
  assert.match(sql,/sparks_usage_resume_single_active/);
  assert.match(sql,/force row level security/);
  assert.match(sql,/revoke all on public.sparks_usage/);
  assert.match(svc,/if\(!isSparksChargingEnabled\(\)\) return/);
  assert.match(svc,/select balance from public.sparks_wallets where user_id=\$1::uuid for update/);
  assert.match(svc,/status in \('RESERVED','COMPLETED'\)/);
  assert.match(svc,/status='complete'/);
  assert.match(svc,/sql.begin\(async tx=>/);
  assert.match(svc,/WEEKLY_REFILL/);
  assert.match(svc,/7\*86400000/);
});
test("enhanced chat is opt-in, charged before AI and refunded on deterministic fallback",()=>{
  const route=read("app/api/chat/route.ts");
  const agent=read("lib/services/chat/journey-chat-service.ts");
  const view=read("components/journey/journey-chat.tsx");
  assert.match(route,/enhanced: z.boolean\(\).default\(false\)/);
  assert.match(route,/reserveSparksUsage\(/);
  assert.match(route,/agentMode==="gemini-read-plan-v1"/);
  assert.match(route,/finishSparksUsage\(reserved.userId,reserved.key,false\)/);
  assert.match(agent,/input.enhanced && !isMutatingJourneyIntent/);
  assert.match(view,/Standard · Free/);
  assert.match(view,/Enhanced AI/);
  assert.match(view,/operationId: crypto.randomUUID\(\)/);
});
test("resume cache isn't recharged, failures refund, first successful analysis free",()=>{
  const route=read("app/api/profile/documents/[documentId]/analyze/route.ts");
  assert.match(route,/cached.length/);
  assert.match(route,/document_type='resume'/);
  assert.match(route,/reserveSparksUsage\(/);
  assert.match(route,/finishSparksUsage\(reserved.userId,reserved.key,false\)/);
});
test("weekly earn is authenticated, only server may mint, and cannot be triggered through wallet GET",()=>{
  const refill=read("app/api/sparks/refill/route.ts");
  const wallet=read("app/api/sparks/route.ts");
  assert.match(refill,/requireUser\(\)/);
  assert.match(refill,/claimWeeklySparks\(user.id\)/);
  assert.doesNotMatch(wallet,/claimWeeklySparks/);
  assert.doesNotMatch(refill,/request.json\(/);
});

test("project defense refunds a graceful unavailable response, retries use fresh operation IDs",()=>{
  const route=read("app/api/project-defense/evaluate/route.ts");
  const view=read("components/projects/project-defense-workbench.tsx");
  assert.match(route,/result.status==="AI_UNAVAILABLE"/);
  assert.match(route,/refundSparks\(user.id,"PROJECT_DEFENSE",operationKey\)/);
  assert.match(route,/operationId:z.string\(\).uuid\(\).optional\(\)/);
  assert.match(view,/operationId:crypto.randomUUID\(\)/);
});

test("existing charges remain refundable after charging is disabled",()=>{
  const legacy=read("lib/services/sparks/sparks-service.ts");
  const refund=legacy.slice(legacy.indexOf("export async function refundSparks("),legacy.indexOf("export async function activateSparksReferral("));
  assert.doesNotMatch(refund,/if \(!isSparksChargingEnabled\(\)\) return/);
  assert.match(refund,/REFUND:/);
  assert.match(refund,/on conflict do nothing returning id/);
});
test("orphaned usage reservations are refunded exactly once on the wallet lock",()=>{
  const consumption=read("lib/services/sparks/sparks-consumption.ts");
  const wallet=read("lib/services/sparks/sparks-service.ts");
  assert.match(consumption,/export async function recoverStaleSparksUsage/);
  assert.match(consumption,/interval '15 minutes'/);
  assert.match(consumption,/status='RESERVED'/);
  assert.match(consumption,/on conflict do nothing returning id/);
  assert.match(consumption,/recoverStaleSparksUsage\(input.userId\)/);
  assert.match(wallet,/await recoverStaleSparksUsage\(userId\)/);
});
