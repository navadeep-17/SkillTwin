import { createServerClient } from "@supabase/ssr";

const baseUrl = process.env.BASE_URL ?? "https://skilltwin-production.up.railway.app";
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const smokeEmail = process.env.SMOKE_EMAIL;
const smokePassword = process.env.SMOKE_PASSWORD;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, init = {}) {
  const response = await fetch(baseUrl + path, {
    redirect: "manual",
    ...init
  });
  const body = await response.text();
  return { response, body };
}

async function publicChecks() {
  const health = await request("/api/health");
  assert(health.response.status === 200, "health endpoint is not 200");

  const readiness = await request("/api/readiness");
  assert(readiness.response.status === 200, "readiness endpoint is not 200");

  const protectedPage = await request("/overview");
  assert(
    [301,302,303,307,308].includes(protectedPage.response.status)
      && String(protectedPage.response.headers.get("location") ?? "").includes("/login"),
    "anonymous overview request did not redirect to login"
  );

  for (const path of ["/api/roles", "/api/goals", "/api/skills", "/api/gaps", "/api/roadmap", "/api/agent-events"]) {
    const result = await request(path);
    assert(result.response.status === 401, path + " did not reject an anonymous request");
  }

  console.log("PUBLIC_SMOKE=PASS");
}

async function authenticatedChecks() {
  if (!supabaseUrl || !supabaseAnonKey || !smokeEmail || !smokePassword) {
    console.log("AUTH_SMOKE=SKIPPED (configure SUPABASE_URL, SUPABASE_ANON_KEY, SMOKE_EMAIL, SMOKE_PASSWORD)");
    return;
  }

  const jar = new Map();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return [...jar.entries()].map(([name, value]) => ({ name, value }));
      },
      setAll(cookies) {
        for (const { name, value } of cookies) jar.set(name, value);
      }
    }
  });

  const { data, error } = await supabase.auth.signInWithPassword({
    email: smokeEmail,
    password: smokePassword
  });
  if (error) throw error;
  assert(Boolean(data.session), "authenticated smoke user did not receive a session");

  const cookie = [...jar.entries()].map(([name, value]) => name + "=" + value).join("; ");

  for (const path of ["/api/roles", "/api/goals", "/api/skills", "/api/gaps", "/api/roadmap", "/api/agent-events"]) {
    const response = await fetch(baseUrl + path, {
      headers: { Cookie: cookie },
      redirect: "manual"
    });
    assert(response.status === 200, path + " authenticated check returned " + response.status);
    const payload = await response.json();
    assert(payload?.ok === true, path + " authenticated response was not an ok API envelope");
  }

  console.log("AUTH_SMOKE=PASS");
}

await publicChecks();
await authenticatedChecks();
console.log("RELEASE_SMOKE=PASS");
