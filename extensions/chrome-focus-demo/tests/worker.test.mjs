import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,RULE_ID} from '../core.mjs';
const now=Date.now();
const store={focusPolicy:{enabled:true,sites:['youtube'],allowanceSeconds:60,rewardSeconds:60},focusState:{...initialState(now),usedMs:60_000}};
let rules=[];
let tab={id:7,url:'https://www.youtube.com/watch?v=abc'};
const listeners={};
const event=name=>({addListener(fn){listeners[name]=fn;}});
globalThis.chrome={
 storage:{local:{get:async keys=>Object.fromEntries(keys.filter(k=>k in store).map(k=>[k,store[k]])),set:async obj=>Object.assign(store,obj)}},
 idle:{queryState:async()=> 'active',onStateChanged:event('idle')},
 windows:{getLastFocused:async()=>({id:1,focused:true}),onFocusChanged:event('window')},
 tabs:{query:async()=>[tab],update:async(id,obj)=>{assert.equal(id,7);tab={...tab,...obj};return tab;},onActivated:event('activated'),onUpdated:event('updated'),onRemoved:event('removed')},
 alarms:{create:async()=>{},onAlarm:event('alarm')},
 declarativeNetRequest:{getDynamicRules:async()=>rules,updateDynamicRules:async({removeRuleIds,addRules})=>{rules=rules.filter(r=>!removeRuleIds.includes(r.id)).concat(addRules);}},
 runtime:{onMessage:event('message'),onInstalled:event('installed'),onStartup:event('startup'),getURL:path=>'chrome-extension://demo/'+path}
};
await import('../background.js');
const send=message=>new Promise((resolve,reject)=>{
  const accepted=listeners.message(message,{},response=>{if(response?.ok)resolve(response.data);else reject(new Error(response?.error));});
  assert.equal(accepted,true);
});
test('extension background installs domain redirect, serves challenge, grants exactly one unlock',async()=>{
  let status=await send({type:'STATUS'});
  assert.equal(status.blocked,true);
  assert.equal(rules.length,1);
  assert.equal(rules[0].id,RULE_ID);
  assert.equal(tab.url,'chrome-extension://demo/blocked.html');
  for(let i=0;i<3;i++){
    const next=await send({type:'QUIZ'});
    assert.equal(next.blocked,true);
    assert.equal(next.question.number,i+1);
    const response=await send({type:'ANSWER',questionId:next.question.id,choice:0});
    assert.equal(response.completed,i===2);
    if(i===2)assert.equal(response.awarded,true);
  }
  assert.equal(rules.length,0);
  status=await send({type:'STATUS'});
  assert.equal(status.blocked,false);
  assert.equal(status.state.unlocksToday,1);
  assert.equal(status.state.bonusSeconds,60);
  await assert.rejects(()=>send({type:'ANSWER',questionId:'sql-1',choice:0}),/CHALLENGE_NOT_AVAILABLE/);
});
test('emergency bypass is available without successful quiz completion',async()=>{
  const bypass=await send({type:'BYPASS'});
  assert.equal(bypass.blocked,false);
  assert.ok(bypass.state.bypassUntil>Date.now());
});
