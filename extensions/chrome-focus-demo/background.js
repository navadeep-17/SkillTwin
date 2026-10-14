import {DEFAULT_POLICY, RULE_ID, MAX_UNLOCKS, initialState, sanitizePolicy,
  sampleUsage, shouldBlock, remainingSeconds, siteForUrl, dynamicRule, awardQuiz} from './core.mjs';
import {questionAt,grade} from './questions.mjs';

const ALARM = 'skilltwin-focus-checkpoint';
const QUIZ_SIZE = 3;
const BYPASS_MS = 5 * 60_000;
// All mutations are serialized because Chrome service-worker events can overlap.
let operations = Promise.resolve();
function serial(fn) {
  const next = operations.then(fn);
  operations = next.catch(error => console.error('SkillTwin Focus operation failed', String(error)));
  return next;
}
async function load() {
  const data = await chrome.storage.local.get(['focusPolicy','focusState']);
  const now = Date.now();
  return {policy:sanitizePolicy(data.focusPolicy || DEFAULT_POLICY),state:data.focusState || initialState(now)};
}
async function save(policy,state) { await chrome.storage.local.set({focusPolicy:policy,focusState:state}); }
async function activeTab() {
  try {
    const idle = await chrome.idle.queryState(60);
    if (idle !== 'active') return {site:null,tabId:null};
    const window = await chrome.windows.getLastFocused();
    if (!window?.focused) return {site:null,tabId:null};
    const tabs = await chrome.tabs.query({active:true,windowId:window.id});
    const tab = tabs[0];
    return {tabId:tab?.id ?? null,url:tab?.url ?? null};
  } catch { return {site:null,tabId:null}; }
}
async function applyRule(blocked,policy) {
  const current = await chrome.declarativeNetRequest.getDynamicRules();
  const present = current.some(rule=>rule.id===RULE_ID);
  const domainKey = policy.sites.flatMap(site=>({youtube:['youtube.com','youtu.be'],instagram:['instagram.com'],reddit:['reddit.com'],x:['x.com','twitter.com']}[site]||[])).sort().join(',');
  const existingKey = current.find(rule=>rule.id===RULE_ID)?.condition?.requestDomains?.slice().sort().join(',');
  if (present && blocked && domainKey === existingKey) return;
  if (!present && !blocked) return;
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds:[RULE_ID],
    addRules: blocked ? [dynamicRule(policy)] : []
  });
}
async function reconcile() {
  let {policy,state} = await load();
  const now = Date.now();
  const observed = await activeTab();
  observed.site = siteForUrl(observed.url,policy.sites);
  state = sampleUsage(state,policy,now,observed.site);
  const blocked = shouldBlock(state,policy,now);
  state.wasBlocked = blocked;
  if (blocked && observed.site) state.lastBlockedSite = observed.site;
  await save(policy,state);
  await applyRule(blocked,policy);
  // Catch previously open tabs when they become foreground while blocked.
  if (blocked && observed.site && Number.isInteger(observed.tabId)) {
    try { await chrome.tabs.update(observed.tabId,{url:chrome.runtime.getURL('blocked.html')}); } catch { /* tab closed during update */ }
  }
  return {policy,state,blocked,remaining:remainingSeconds(state,policy)};
}
async function initialize() {
  await chrome.alarms.create(ALARM,{periodInMinutes:0.5});
  const {policy,state} = await load();
  await save(policy,state);
  await reconcile();
}
chrome.runtime.onInstalled.addListener(()=>{void serial(initialize);});
chrome.runtime.onStartup.addListener(()=>{void serial(initialize);});
chrome.alarms.onAlarm.addListener(alarm=>{if(alarm.name===ALARM) void serial(reconcile);});
chrome.tabs.onActivated.addListener(()=>{void serial(reconcile);});
chrome.tabs.onUpdated.addListener((_tabId,changes)=>{if(changes.url || changes.status==='complete') void serial(reconcile);});
chrome.tabs.onRemoved.addListener(()=>{void serial(reconcile);});
chrome.windows.onFocusChanged.addListener(()=>{void serial(reconcile);});
chrome.idle.onStateChanged.addListener(()=>{void serial(reconcile);});

async function handle(message) {
  if (!message || typeof message.type !== 'string') throw new Error('INVALID_MESSAGE');
  if (message.type==='STATUS') return { ...(await reconcile()), maxUnlocks:MAX_UNLOCKS };
  if (message.type==='SET_POLICY') {
    const {state} = await reconcile();
    const policy = sanitizePolicy(message.policy);
    const next = {...state,activeSite:null,lastSampleAt:Date.now()};
    await save(policy,next);
    return {...(await reconcile()),maxUnlocks:MAX_UNLOCKS};
  }
  if (message.type==='RESET_TODAY') {
    const {policy} = await reconcile();
    await save(policy,initialState(Date.now()));
    return {...(await reconcile()),maxUnlocks:MAX_UNLOCKS};
  }
  if (message.type==='BYPASS') {
    const {policy,state} = await reconcile();
    state.bypassUntil=Date.now()+BYPASS_MS;
    state.quizIndex=0;
    await save(policy,state);
    return {...(await reconcile()),bypassMinutes:5};
  }
  if (message.type==='QUIZ') {
    const {policy,state,blocked} = await reconcile();
    if (!blocked) return {blocked:false,returnSite:state.lastBlockedSite};
    if (state.unlocksToday>=MAX_UNLOCKS) return {blocked:true,limitReached:true};
    return {blocked:true,question:questionAt(state.unlocksToday,state.quizIndex),rewardSeconds:policy.rewardSeconds};
  }
  if (message.type==='ANSWER') {
    const {policy,state,blocked} = await reconcile();
    if (!blocked || state.unlocksToday>=MAX_UNLOCKS) throw new Error('CHALLENGE_NOT_AVAILABLE');
    const expected = questionAt(state.unlocksToday,state.quizIndex);
    if (message.questionId!==expected.id) throw new Error('STALE_QUESTION');
    const result = grade(state.unlocksToday,state.quizIndex,message.choice);
    state.quizIndex += 1;
    const completed = state.quizIndex===QUIZ_SIZE;
    let awarded=false;
    if (completed) {
      const grant=awardQuiz(state,policy);
      awarded=grant.awarded;
      Object.assign(state,grant.state);
    }
    await save(policy,state);
    await reconcile();
    return {...result,completed,awarded,returnSite:state.lastBlockedSite,rewardSeconds:policy.rewardSeconds};
  }
  throw new Error('UNKNOWN_MESSAGE');
}
chrome.runtime.onMessage.addListener((message,_sender,respond)=>{
  void serial(()=>handle(message)).then(data=>respond({ok:true,data})).catch(error=>respond({ok:false,error:String(error.message || error)}));
  return true;
});
