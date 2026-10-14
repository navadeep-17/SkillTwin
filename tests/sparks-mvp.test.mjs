import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { WELCOME_SPARKS, REFERRAL_SPARKS, SPARKS_PRICES, isReferralCode } from "../lib/domain/sparks.ts";
const read = p => readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("Sparks prices and referral codes have conservative defaults",()=>{
  assert.equal(WELCOME_SPARKS,100);
  assert.equal(REFERRAL_SPARKS,50);
  assert.equal(SPARKS_PRICES.CUSTOM_ROLE,25);
  assert.equal(SPARKS_PRICES.PROJECT_DEFENSE,15);
  assert.equal(isReferralCode("ABCDEF012345"),true);
  assert.equal(isReferralCode("abcdef012345"),false);
  assert.equal(isReferralCode("DROP TABLE"),false);
});
test("Sparks ledger uses atomic server-only ownership and distinct operation keys",()=>{
  const sql=read("supabase/migrations/0029_sparks_wallet_referrals.sql");
  const service=read("lib/services/sparks/sparks-service.ts");
  assert.match(sql,/unique\(user_id, operation_key\)/);
  assert.match(sql,/check \(balance >= 0\)/);
  assert.match(sql,/revoke all on public\.sparks_wallets/);
  assert.match(sql,/force row level security/);
  assert.match(service,/for update/);
  assert.match(service,/sql\.begin\(async tx =>/);
  assert.match(service,/on conflict do nothing returning id/);
  assert.match(service,/MONTHLY_REWARDED_REFERRAL_LIMIT/);
  assert.match(service,/email_confirmed_at/);
  assert.match(sql,/capture_sparks_signup_referral/);
  assert.match(service,/sparks_referral_claims/);
  assert.doesNotMatch(service,/raw_user_meta_data/);
  assert.match(service,/SKILLTWIN_SPARKS_CHARGING_ENABLED/);
  assert.match(service,/public\.career_goals/);
});
test("Sparks APIs require auth and never expose credit mutation",()=>{
  const api=read("app/api/sparks/route.ts");
  assert.match(api,/requireUser\(\)/);
  assert.match(api,/getSparksWallet\(user\.id\)/);
  assert.doesNotMatch(api,/export async function POST/);
  assert.match(read("middleware.ts"),/\/sparks/);
});
test("Advanced actions charge on server and refund unsuccessful AI calls",()=>{
  for(const route of ["app/api/project-defense/evaluate/route.ts","app/api/roles/generate/route.ts"]) {
    const text=read(route);
    assert.match(text,/spendSparks\(/);
    assert.match(text,/refundSparks\(/);
    assert.match(text,/INSUFFICIENT_SPARKS/);
  }
});
test("Referral captured only through signup metadata",()=>{
  const auth=read("components/auth/auth-form.tsx");
  assert.match(auth,/sparks_referral: referralCode/);
  assert.match(read("app/login/page.tsx"),/\^\[A-F0-9\]\{12\}\$/);
});
