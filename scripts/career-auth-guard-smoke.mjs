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
  for (const route of ["/passport", "/challenge-my-twin", "/discover", "/occupations", "/occupations/mappings", "/occupations/models"]) {
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
