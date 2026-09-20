import { createServerClient } from "@supabase/ssr";

const baseUrl = process.env.BASE_URL ?? "https://skilltwin-production.up.railway.app";
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const smokeEmail = process.env.SMOKE_EMAIL;
const smokePassword = process.env.SMOKE_PASSWORD;
const destructive = process.env.SMOKE_DESTRUCTIVE === "true";
const demoResetSecret = process.env.DEMO_RESET_SECRET;

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

  async function authRequest(path, init = {}) {
    const headers = new Headers(init.headers ?? {});
    headers.set("Cookie", cookie);
    if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    const response = await fetch(baseUrl + path, {
      redirect: "manual",
      ...init,
      headers
    });
    const text = await response.text();
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch {}
    return { response, payload, text };
  }

  for (const path of ["/api/roles", "/api/goals", "/api/skills", "/api/gaps", "/api/roadmap", "/api/agent-events"]) {
    const { response, payload } = await authRequest(path);
    assert(response.status === 200, path + " authenticated check returned " + response.status);
    assert(payload?.ok === true, path + " authenticated response was not an ok API envelope");
  }

  console.log("AUTH_SMOKE=PASS");

  if (!destructive) {
    console.log("CAUSAL_E2E=SKIPPED (set SMOKE_DESTRUCTIVE=true for the dedicated smoke account)");
    return;
  }

  assert(Boolean(demoResetSecret), "DEMO_RESET_SECRET is required for destructive smoke");

  const reset = await authRequest("/api/demo/reset", {
    method: "POST",
    headers: { "x-skilltwin-demo-secret": demoResetSecret }
  });
  assert(reset.response.status === 200 && reset.payload?.ok === true, "demo reset failed");

  const roles = await authRequest("/api/roles");
  const availableRoles = roles.payload?.data?.roles ?? [];
  const role = availableRoles.find(item => item.name === "Backend Engineer") ?? availableRoles[0];
  assert(Boolean(role?.roleVersionId), "no target role available for smoke");

  const goal = await authRequest("/api/goals", {
    method: "POST",
    body: JSON.stringify({
      roleVersionId: role.roleVersionId,
      targetDate: null,
      hoursPerWeek: 8,
      preferredSessionMinutes: 60,
      minSessionMinutes: 20,
      learningDays: ["Mon","Tue","Wed","Thu","Fri","Sat"],
      preferredFormats: ["projects","practice","documentation"],
      adaptationMode: "AUTOMATIC"
    })
  });
  assert(goal.response.status === 200 && goal.payload?.ok === true, "career goal creation failed");

  const project = await authRequest("/api/profile/projects", {
    method: "POST",
    body: JSON.stringify({
      title: "SkillTwin release smoke API project",
      description: "Built and tested a REST API using JavaScript and SQL, implemented HTTP request handling, containerized the service with Docker, and documented failure handling.",
      technologies: ["JavaScript","REST API","HTTP","SQL","Docker"],
      artifactUrl: null
    })
  });
  assert(project.response.status === 201 && project.payload?.ok === true, "project evidence ingestion failed");

  const gaps = await authRequest("/api/gaps");
  assert(gaps.response.status === 200 && gaps.payload?.ok === true, "gap analysis missing after evidence");

  const generatedPlan = await authRequest("/api/plans/generate", { method: "POST" });
  assert(generatedPlan.response.status === 200 && generatedPlan.payload?.ok === true, "initial plan generation failed");

  const roadmapBefore = await authRequest("/api/roadmap");
  assert(roadmapBefore.response.status === 200 && roadmapBefore.payload?.data?.plan, "active roadmap missing");
  const versionBefore = Number(roadmapBefore.payload.data.plan.version);

  const challenge = await authRequest("/api/assessments", {
    method: "POST",
    body: JSON.stringify({ mode: "CHALLENGE_ME" })
  });
  assert(challenge.response.status === 201 && challenge.payload?.ok === true, "challenge creation failed");

  const assessmentId = challenge.payload.data.assessment.id;
  let question = challenge.payload.data.question;
  let completed = false;
  let completionPayload = null;
  let guard = 0;

  while (question && !completed && guard < 10) {
    guard += 1;
    const constructed = question.type === "SHORT_TEXT" || question.type === "SCENARIO";
    const answerBody = constructed
      ? {
          questionId: question.id,
          answerText: "I would validate the requested behavior against the protocol or authorization rules, verify the resource state, and handle the failure explicitly."
        }
      : {
          questionId: question.id,
          optionId: question.options?.[0]?.id ?? "a"
        };

    const answered = await authRequest("/api/assessments/" + assessmentId + "/answers", {
      method: "POST",
      body: JSON.stringify(answerBody)
    });
    assert(answered.response.status === 200 && answered.payload?.ok === true, "assessment answer failed");
    completed = answered.payload.data.completed === true;
    completionPayload = answered.payload;
    question = answered.payload.data.question ?? null;
  }

  assert(completed, "assessment did not complete");
  assert(Boolean(completionPayload?.data?.outcome), "assessment outcome missing");

  const skillsAfter = await authRequest("/api/skills");
  assert(skillsAfter.response.status === 200 && (skillsAfter.payload?.data?.skills?.length ?? 0) > 0, "SkillTwin state missing");

  const roadmapAfter = await authRequest("/api/roadmap");
  assert(roadmapAfter.response.status === 200 && roadmapAfter.payload?.data?.plan, "roadmap missing after assessment");
  const versionAfter = Number(roadmapAfter.payload.data.plan.version);
  assert(versionAfter >= versionBefore, "roadmap version regressed");

  const activity = await authRequest("/api/agent-events?limit=50");
  const eventTypes = new Set((activity.payload?.data?.events ?? []).map(event => event.event_type));
  for (const required of ["career.goal.updated","project.evidence.processed","assessment.started","assessment.completed"]) {
    assert(eventTypes.has(required), "missing audit event " + required);
  }

  console.log("CAUSAL_E2E=PASS");
}

await publicChecks();
await authenticatedChecks();
console.log("RELEASE_SMOKE=PASS");
