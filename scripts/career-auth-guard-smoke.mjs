/**
 * Anonymous route-access regression for new authenticated features.
 * Boots a built Next.js server with intentionally fake public Supabase
 * credentials. No real service keys, learner data, or network login needed.
 */
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const port = 31876;
const base = "http://127.0.0.1:" + port;
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], {
  env: {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: "https://example.invalid",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-publishable-placeholder"
  },
  stdio: ["ignore", "pipe", "pipe"]
});
let output = "";
for (const stream of [child.stdout, child.stderr]) {
  stream.on("data", chunk => {
    output = (output + chunk.toString()).slice(-5000);
  });
}
async function get(path) {
  return fetch(base + path, { redirect: "manual", signal: AbortSignal.timeout(4000) });
}

try {
  let ready = false;
  for (let attempt = 0; attempt < 35; attempt++) {
    if (child.exitCode !== null) throw new Error("Next exited unexpectedly. " + output);
    try {
      const response = await get("/login");
      if (response.status === 200) {
        ready = true;
        break;
      }
    } catch {}
    await delay(500);
  }
  if (!ready) throw new Error("Next did not become ready. " + output);
  // The agent's stored chats and mutating confirmation paths must remain
  // invisible to anonymous visitors, even after thread-history additions.
  const unknownId="00000000-0000-0000-0000-000000000001";
  const privateApi=[
    {method:"GET",path:"/api/chat"},
    {method:"GET",path:"/api/arena/state"},
    {method:"POST",path:"/api/arena/match",body:JSON.stringify({action:"find",topic:"python"})},
    {method:"POST",path:"/api/arena/answer",body:JSON.stringify({matchId:unknownId,questionNumber:1,optionIndex:0})},
    {method:"GET",path:"/api/certifications"},
    {method:"GET",path:"/api/certifications/journey"},
    {method:"POST",path:"/api/certifications/journey",body:JSON.stringify({certificationId:"github-foundations"})},
    {method:"PATCH",path:"/api/certifications/journey/"+unknownId,body:JSON.stringify({action:"START_PREPARATION",expectedVersion:1})},
    {method:"DELETE",path:"/api/certifications/journey/"+unknownId,body:JSON.stringify({expectedVersion:1})},
    {method:"GET",path:"/api/chat?threadId="+unknownId},
    {method:"POST",path:"/api/chat",body:JSON.stringify({message:"Hello"})},
    {method:"POST",path:"/api/chat/actions/"+unknownId+"/confirm"},
    {method:"POST",path:"/api/chat/actions/"+unknownId+"/reject"}
  ];
  for (const endpoint of privateApi) {
    const response=await fetch(base+endpoint.path,{
      method:endpoint.method,
      headers:endpoint.body?{"Content-Type":"application/json"}:{},
      body:endpoint.body,
      redirect:"manual",signal:AbortSignal.timeout(6000)
    });
    if(response.status!==401)
      throw new Error(endpoint.method+" "+endpoint.path+
        " must reject anonymous agent access with 401, got "+response.status);
    console.log("ANONYMOUS_AGENT_API_GUARD=PASS "+endpoint.method+" "+endpoint.path);
  }
  const journey=await get("/journey");
  const location=journey.headers.get("location")??"";
  if(![301,302,303,307,308].includes(journey.status)||!location.includes("/login"))
    throw new Error("Journey page must redirect anonymous users to login.");

  for (const route of ["/passport", "/challenge-my-twin", "/project-defense", "/discover", "/certifications", "/certifications/journey", "/arena", "/occupations", "/occupations/mappings", "/occupations/models"]) {
    const response = await get(route);
    const location = response.headers.get("location") ?? "";
    if (![301, 302, 303, 307, 308].includes(response.status) ||
      !location.includes("/login") || !location.includes("next=")) {
      throw new Error(route + " must redirect anonymous visitors to login, got " + response.status + " " + location);
    }
    console.log("ANONYMOUS_ROUTE_GUARD=PASS " + route);
  }
} finally {
  child.kill("SIGTERM");
}
