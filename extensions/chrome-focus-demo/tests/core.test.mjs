import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_POLICY, MAX_UNLOCKS, RULE_ID, sanitizePolicy, initialState, siteForUrl,
  sampleUsage, remainingSeconds, shouldBlock, awardQuiz, dynamicRule, localDayKey } from '../core.mjs';
import {QUESTIONS,questionAt,grade} from '../questions.mjs';
const t0=new Date(2026,9,14,10,0,0).getTime();
const p={enabled:true,sites:['youtube','reddit'],allowanceSeconds:60,rewardSeconds:60};
test('defaults are opt-in and policy clamps unsafe values',()=>{
  assert.equal(DEFAULT_POLICY.enabled,false);
  assert.deepEqual(sanitizePolicy({enabled:true,sites:['youtube','youtube','__proto__'],allowanceSeconds:-8,rewardSeconds:999999}).sites,['youtube']);
  assert.equal(sanitizePolicy({enabled:true,sites:['youtube'],allowanceSeconds:-8}).allowanceSeconds,60);
});
test('domain checks do not count deceptive subdomains',()=>{
  assert.equal(siteForUrl('https://m.youtube.com/watch?v=abc',p.sites),'youtube');
  assert.equal(siteForUrl('https://reddit.com/r/test',p.sites),'reddit');
  assert.equal(siteForUrl('https://youtube.com.evil.test',p.sites),null);
  assert.equal(siteForUrl('https://good.test/?next=youtube.com',p.sites),null);
  assert.equal(siteForUrl('chrome://extensions',p.sites),null);
});
test('tracked seconds pause when the monitored tab loses focus',()=>{
  let s=initialState(t0);
  s=sampleUsage(s,p,t0,'youtube');
  s=sampleUsage(s,p,t0+30_000,'youtube');
  s=sampleUsage(s,p,t0+40_000,null);
  s=sampleUsage(s,p,t0+70_000,null);
  assert.equal(s.usedMs,40_000);
  assert.equal(remainingSeconds(s,p),20);
});
test('blocking begins at daily allowance; quiz reward grants exactly one extension',()=>{
  let s=initialState(t0);
  s=sampleUsage(s,p,t0,'youtube');
  s=sampleUsage(s,p,t0+30_000,'youtube');
  s=sampleUsage(s,p,t0+60_000,'youtube');
  assert.equal(shouldBlock(s,p,t0+60_000),true);
  s.quizIndex=3;
  const first=awardQuiz(s,p);
  assert.equal(first.awarded,true);
  assert.equal(shouldBlock(first.state,p,t0+60_000),false);
  assert.equal(first.state.unlocksToday,1);
  assert.equal(awardQuiz(first.state,p).awarded,false);
  assert.equal(remainingSeconds(first.state,p),60);
});
test('maximum reward count prevents extra grants',()=>{
  let s={...initialState(t0),bonusSeconds:120,unlocksToday:MAX_UNLOCKS,quizIndex:3};
  assert.equal(awardQuiz(s,p).awarded,false);
  assert.equal(s.bonusSeconds,120);
});
test('delayed alarm samples never charge more than 35 seconds',()=>{
  let s=sampleUsage(initialState(t0),p,t0,'reddit');
  s=sampleUsage(s,p,t0+7*60_000,'reddit');
  assert.equal(s.usedMs,35_000);
});
test('bypass and disabling remove blocking state without altering history',()=>{
  const s={...initialState(t0),usedMs:60_000,bypassUntil:t0+300_000};
  assert.equal(shouldBlock(s,p,t0+60_000),false);
  assert.equal(shouldBlock(s,p,t0+300_001),true);
  assert.equal(shouldBlock(s,{...p,enabled:false},t0+300_001),false);
});
test('usage resets on the next local calendar day',()=>{
  const s={...initialState(t0),usedMs:60_000,activeSite:'youtube'};
  const next=new Date(2026,9,15,10).getTime();
  assert.notEqual(localDayKey(t0),localDayKey(next));
  assert.equal(sampleUsage(s,p,next,'youtube').usedMs,0);
});
test('dynamic rule restricts top-level selected domains only',()=>{
  const r=dynamicRule(p);
  assert.equal(r.id,RULE_ID);
  assert.deepEqual(r.condition.resourceTypes,['main_frame']);
  assert.deepEqual(r.condition.requestDomains,['youtube.com','youtu.be','reddit.com']);
  assert.equal(r.action.redirect.extensionPath,'/blocked.html');
});
test('three distinct questions per challenge and correct answer feedback',()=>{
  assert.equal(QUESTIONS.length,9);
  const qs=[0,1,2].map(i=>questionAt(0,i));
  assert.equal(new Set(qs.map(q=>q.id)).size,3);
  assert.equal(grade(0,0,1).correct,true);
  assert.equal(grade(0,0,0).correct,false);
  assert.throws(()=>grade(0,0,99),/INVALID_CHOICE/);
});
