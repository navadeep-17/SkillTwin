const base=(process.env.SKILLTWIN_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/,"");
if(!base) throw new Error("Set SKILLTWIN_BASE_URL or NEXT_PUBLIC_APP_URL.");

async function json(path,init){
  const response=await fetch(base+path,{...init,redirect:"manual"});
  let body=null;
  try{body=await response.json();}catch{}
  return {response,body};
}

const health=await json("/api/health");
if(!health.response.ok || !health.body?.ok) throw new Error("Health endpoint failed.");

const readiness=await json("/api/readiness");
if(!readiness.response.ok || !readiness.body?.ok || readiness.body.data?.status!=="ready"){
  throw new Error("Readiness endpoint is not ready: "+JSON.stringify(readiness.body?.data ?? readiness.body));
}

for(const path of ["/api/dashboard","/api/skills","/api/agent-events"]){
  const probe=await json(path);
  if(probe.response.status!==401 || probe.body?.error?.code!=="UNAUTHENTICATED"){
    throw new Error("Unauthenticated route did not fail closed: "+path+" status="+probe.response.status);
  }
}

const serialized=JSON.stringify({health:health.body,readiness:readiness.body});
for(const forbidden of ["SUPABASE_DB_URL","SUPABASE_SERVICE_ROLE_KEY","GEMINI_API_KEY","OPENAI_API_KEY","DEMO_RESET_SECRET","postgresql://"]){
  if(serialized.includes(forbidden)) throw new Error("Operational endpoint exposed forbidden token: "+forbidden);
}

console.log(JSON.stringify({
  ok:true,
  base,
  appVersion:readiness.body.data?.appVersion,
  status:readiness.body.data?.status,
  checks:readiness.body.data?.checks
},null,2));
