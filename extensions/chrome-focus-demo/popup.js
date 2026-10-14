const el=id=>document.getElementById(id);
const send=async payload=>{const result=await chrome.runtime.sendMessage(payload);if(!result?.ok)throw new Error(result?.error||'Background service unavailable');return result.data;};
const fmt=seconds=>String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
let loaded=false;
async function refresh({fill=false}={}) {
  const data=await send({type:'STATUS'});
  const {policy,state,blocked,remaining,maxUnlocks}=data;
  el('remaining').textContent=fmt(remaining);
  el('status').textContent= !policy.enabled?'Paused — enable to start':blocked?'Locked · '+state.unlocksToday+'/'+maxUnlocks+' unlocks used':state.unlocksToday+'/'+maxUnlocks+' extra sessions earned';
  if(fill||!loaded){
    el('enabled').checked=policy.enabled;
    el('allowance').value=String(policy.allowanceSeconds/60);
    el('reward').value=String(policy.rewardSeconds/60);
    document.querySelectorAll('[name="site"]').forEach(e=>e.checked=policy.sites.includes(e.value));
    loaded=true;
  }
}
function showError(error){el('error').textContent=error instanceof Error?error.message:String(error);}
el('save').addEventListener('click',async()=>{
  el('error').textContent='';
  const allowance=Number(el('allowance').value),reward=Number(el('reward').value);
  const sites=[...document.querySelectorAll('[name="site"]:checked')].map(e=>e.value);
  if(!Number.isInteger(allowance)||allowance<1||allowance>60||!Number.isInteger(reward)||reward<1||reward>30){showError('Enter whole minutes: allowance 1–60, reward 1–30.');return;}
  if(el('enabled').checked && sites.length===0){showError('Choose at least one website.');return;}
  try{await send({type:'SET_POLICY',policy:{enabled:el('enabled').checked,sites,allowanceSeconds:allowance*60,rewardSeconds:reward*60}});await refresh({fill:true});el('error').textContent='Settings saved.';}catch(e){showError(e);}
});
el('bypass').addEventListener('click',async()=>{try{await send({type:'BYPASS'});await refresh();el('error').textContent='Bypass active for five minutes. You can also disable Focus Mode.';}catch(e){showError(e);}});
el('reset').addEventListener('click',async()=>{try{await send({type:'RESET_TODAY'});await refresh();el('error').textContent='Demo timer and quiz progress reset.';}catch(e){showError(e);}});
refresh({fill:true}).catch(showError);
