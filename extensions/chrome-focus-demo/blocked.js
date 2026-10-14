import {homeForSite} from './core.mjs';
const el=id=>document.getElementById(id);
const send=async payload=>{const result=await chrome.runtime.sendMessage(payload);if(!result?.ok)throw new Error(result?.error||'Extension background is unavailable');return result.data;};
let current=null,selected=null,returnSite='youtube';
const msg=e=>{el('error').textContent=e instanceof Error?e.message:String(e)};
const section=id=>['quiz','complete','maxed','paused'].forEach(key=>el(key).hidden=key!==id);
function returnToSite(){window.location.href=homeForSite(returnSite);}
function renderQuestion(q){
  current=q;selected=null;
  section('quiz');el('prompt').textContent=q.prompt;el('topic').textContent=q.topic;
  el('step').textContent=String(q.number)+' / '+String(q.total);el('progress').style.width=String(q.number/q.total*100)+'%';
  el('feedback').hidden=true;el('next').hidden=true;el('submit').hidden=false;el('submit').disabled=true;
  el('choices').replaceChildren(...q.choices.map((choice,index)=>{
    const b=document.createElement('button');b.className='choice';b.textContent=choice;
    b.addEventListener('click',()=>{selected=index;el('submit').disabled=false;document.querySelectorAll('.choice').forEach(node=>node.classList.toggle('selected',node===b));});
    return b;
  }));
}
async function refresh(){
  const data=await send({type:'QUIZ'});
  if(data.returnSite)returnSite=data.returnSite;
  if(!data.blocked){section('paused');return;}
  if(data.limitReached){section('maxed');return;}
  renderQuestion(data.question);
}
el('submit').addEventListener('click',async()=>{
  if(selected===null||!current)return;
  el('submit').disabled=true;
  try {
    const res=await send({type:'ANSWER',questionId:current.id,choice:selected});
    if(res.returnSite)returnSite=res.returnSite;
    if(res.completed){section('complete');el('reward').textContent='You have earned '+Math.round(res.rewardSeconds/60)+' more minute(s) of selected-site browsing.';return;}
    el('feedback').hidden=false;
    el('feedback').className='feedback'+(res.correct?'':' wrong');
    el('feedback').textContent=(res.correct?'Correct. ':'Review: ')+res.explanation;
    el('next').hidden=false;
    el('submit').hidden=true;
  } catch(e){msg(e);el('submit').disabled=false;}
});
el('next').addEventListener('click',()=>{el('submit').hidden=false;refresh().catch(msg);});
el('continue').addEventListener('click',returnToSite);
el('return').addEventListener('click',returnToSite);
el('bypass').addEventListener('click',async()=>{try{await send({type:'BYPASS'});returnToSite();}catch(e){msg(e);}});
el('disable').addEventListener('click',async()=>{try{const s=await send({type:'STATUS'});await send({type:'SET_POLICY',policy:{...s.policy,enabled:false}});returnToSite();}catch(e){msg(e);}});
refresh().catch(msg);
