// Pure policy and accounting functions shared by the service worker and Node tests.
export const DOMAINS = Object.freeze({
  youtube: ['youtube.com', 'youtu.be'],
  instagram: ['instagram.com'],
  reddit: ['reddit.com'],
  x: ['x.com', 'twitter.com']
});
export const SITE_LABELS = Object.freeze({youtube:'YouTube',instagram:'Instagram',reddit:'Reddit',x:'X / Twitter'});
export const RULE_ID = 990001;
export const MAX_UNLOCKS = 2;
export const SAMPLE_CAP_MS = 35_000;
export const DEFAULT_POLICY = Object.freeze({ enabled: false, sites: ['youtube'], allowanceSeconds: 60, rewardSeconds: 60 });

const validInteger = (value, fallback, min, max) => Number.isSafeInteger(value) && value >= min && value <= max ? value : fallback;
export function sanitizePolicy(input = {}) {
  const sites = Array.isArray(input.sites) ? [...new Set(input.sites)].filter(s => Object.hasOwn(DOMAINS,s)) : [...DEFAULT_POLICY.sites];
  return {
    enabled: input.enabled === true,
    sites,
    allowanceSeconds: validInteger(input.allowanceSeconds, 60, 30, 3_600),
    rewardSeconds: validInteger(input.rewardSeconds, 60, 30, 1_800)
  };
}
export function localDayKey(now) {
  const d = new Date(now);
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
}
export function initialState(now) {
  return { dayKey: localDayKey(now), usedMs: 0, bonusSeconds: 0, unlocksToday: 0,
    activeSite: null, lastSampleAt: now, quizIndex: 0, bypassUntil: 0, lastBlockedSite: 'youtube', wasBlocked: false };
}
export function siteForUrl(url, selectedSites) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    const host = u.hostname.toLowerCase();
    for (const site of selectedSites) {
      if ((DOMAINS[site] || []).some(domain => host === domain || host.endsWith('.'+domain))) return site;
    }
  } catch { /* unsupported page, not a monitored website */ }
  return null;
}
export function allowedSeconds(state, policy) { return policy.allowanceSeconds + state.bonusSeconds; }
export function remainingSeconds(state, policy) { return Math.max(0,Math.ceil((allowedSeconds(state,policy)*1000 - state.usedMs)/1000)); }
export function shouldBlock(state, policy, now) {
  return policy.enabled && policy.sites.length > 0 && now >= state.bypassUntil && remainingSeconds(state,policy) === 0;
}
// Called on browser events and at each 30-second alarm. Idle or unfocused time is excluded.
// Long gaps are capped to avoid charging overnight/sleep time when event delivery stalls.
export function sampleUsage(prior, policy, now, observedSite) {
  const s = { ...prior };
  if (s.dayKey !== localDayKey(now)) return { ...initialState(now), lastBlockedSite: s.lastBlockedSite };
  const elapsed = Math.max(0,Math.min(SAMPLE_CAP_MS,now - (s.lastSampleAt || now)));
  if (policy.enabled && s.activeSite && policy.sites.includes(s.activeSite) && !shouldBlock(s,policy,now)) {
    const capMs = Math.max(0,allowedSeconds(s,policy)*1000 - s.usedMs);
    s.usedMs += Math.min(elapsed,capMs);
  }
  s.activeSite = policy.enabled && policy.sites.includes(observedSite) ? observedSite : null;
  s.lastSampleAt = now;
  return s;
}
export function awardQuiz(state, policy) {
  if (state.quizIndex !== 3 || state.unlocksToday >= MAX_UNLOCKS) return { state, awarded: false };
  return {state: {...state, bonusSeconds: state.bonusSeconds + policy.rewardSeconds, unlocksToday: state.unlocksToday+1, quizIndex:0, bypassUntil:0 }, awarded:true};
}
export function dynamicRule(policy) {
  const domains = [...new Set(policy.sites.flatMap(s => DOMAINS[s] || []))];
  return { id: RULE_ID, priority: 1,
    action: {type:'redirect',redirect:{extensionPath:'/blocked.html'}},
    condition: {requestDomains:domains,resourceTypes:['main_frame']}
  };
}
export function homeForSite(site) {
  const first = DOMAINS[site]?.[0] || 'youtube.com';
  return 'https://' + first + '/';
}
