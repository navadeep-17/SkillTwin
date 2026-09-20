import crypto from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { getPublicEnv } from "../lib/config/env";

const BASE = process.env.BASE_URL ?? "https://skilltwin-production.up.railway.app";
const publicEnv = getPublicEnv();
const jar = new Map<string, string>();

function print(label: string, value: unknown) {
  console.log("\n### " + label);
  console.log(typeof value === "string" ? value : JSON.stringify(value, null, 2));
}

function cookieHeader() {
  return [...jar.entries()].map(([name, value]) => name + "=" + value).join("; ");
}

async function app(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers ?? {});
  const cookie = cookieHeader();
  if (cookie) headers.set("Cookie", cookie);
  const response = await fetch(BASE + path, { ...init, headers });
  const text = await response.text();
  let body: any;
  try {
    body = JSON.parse(text);
  } catch {
    body = { text: text.slice(0, 600) };
  }
  print(path + " -> " + response.status, body);
  return { response, body };
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function makePdf(lines: string[]) {
  const content = [
    "BT",
    "/F1 12 Tf",
    "72 740 Td",
    ...lines.flatMap((line, index) =>
      index === 0
        ? ["(" + escapePdfText(line) + ") Tj"]
        : ["0 -18 Td", "(" + escapePdfText(line) + ") Tj"]
    ),
    "ET"
  ].join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Length " + Buffer.byteLength(content) + " >>\nstream\n" + content + "\nendstream"
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += (i + 1) + " 0 obj\n" + objects[i] + "\nendobj\n";
  }
  const xref = Buffer.byteLength(pdf);
  pdf += "xref\n0 " + (objects.length + 1) + "\n";
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i++) {
    pdf += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  }
  pdf += "trailer\n<< /Size " + (objects.length + 1) + " /Root 1 0 R >>\n";
  pdf += "startxref\n" + xref + "\n%%EOF\n";
  return Buffer.from(pdf);
}

async function main() {
  const health = await app("/api/health");
  if (!health.response.ok) throw new Error("health endpoint failed");

  const readiness = await app("/api/readiness");
  if (!readiness.response.ok) throw new Error("readiness endpoint failed");

  const vertical = await app("/api/demo/vertical-slice");
  if (!vertical.response.ok) throw new Error("vertical slice endpoint failed");

  const email = "skilltwin-smoke-" + Date.now() + "@gmail.com";
  const password = "S!" + crypto.randomBytes(18).toString("base64url");

  const supabase = createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return [...jar.entries()].map(([name, value]) => ({ name, value }));
        },
        setAll(cookies) {
          for (const { name, value } of cookies) jar.set(name, value);
        }
      }
    }
  );

  const { data: signup, error: signupError } = await supabase.auth.signUp({ email, password });
  if (signupError) throw signupError;

  print("auth signup", {
    userCreated: Boolean(signup.user),
    sessionCreated: Boolean(signup.session),
    userId: signup.user?.id ?? null,
    email
  });

  if (!signup.session || !signup.user) {
    console.log("SMOKE_BLOCKED=email_confirmation_required");
    process.exit(2);
  }

  const pdf = makePdf([
    "SkillTwin Production Smoke Learner",
    "Backend engineering student with hands-on Node.js and REST API work.",
    "Built Express APIs with authentication, SQL databases, Git workflows and Docker.",
    "Implemented HTTP status codes, CRUD endpoints, testing and Linux deployment.",
    "Projects include an interview experience platform using Node.js, Express, MongoDB and React."
  ]);

  const form = new FormData();
  form.set("file", new Blob([pdf], { type: "application/pdf" }), "skilltwin-smoke-resume.pdf");

  const upload = await app("/api/profile/documents", { method: "POST", body: form });
  if (!upload.response.ok || !upload.body?.ok) throw new Error("resume upload failed");

  const documentId = upload.body.data.document.id as string;
  const analyze = await app("/api/profile/documents/" + documentId + "/analyze", { method: "POST" });
  if (!analyze.response.ok || !analyze.body?.ok) throw new Error("resume analysis failed");

  for (const path of ["/api/skills", "/api/gaps"]) {
    const res = await app(path);
    if (!res.response.ok) throw new Error(path + " failed");
  }

  const planGenerate = await app("/api/plans/generate", { method: "POST" });
  if (!planGenerate.response.ok) throw new Error("plan generation failed");

  const roadmap = await app("/api/roadmap");
  if (!roadmap.response.ok) throw new Error("roadmap read failed");

  const assessmentCreate = await app("/api/assessments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "CHALLENGE_ME" })
  });
  if (!assessmentCreate.response.ok || !assessmentCreate.body?.ok) {
    throw new Error("assessment creation failed");
  }

  const assessmentId = assessmentCreate.body.data.assessment.id as string;
  let state = assessmentCreate.body.data;
  let completed = false;

  for (let i = 0; i < 10 && state?.question && !completed; i++) {
    const q = state.question;
    const options = Array.isArray(q.options) ? q.options : [];
    if (!options.length) throw new Error("assessment question has no options");
    const first = options[0];
    const optionId = String(first?.id ?? first?.value ?? first);

    const answer = await app("/api/assessments/" + assessmentId + "/answers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionId: q.id,
        optionId,
        idempotencyKey: "smoke-" + assessmentId + "-" + q.id
      })
    });

    if (!answer.response.ok || !answer.body?.ok) throw new Error("assessment answer failed");
    state = answer.body.data;
    completed = state?.completed === true;
  }

  if (!completed) throw new Error("assessment did not complete");

  for (const path of [
    "/api/assessments/" + assessmentId,
    "/api/roadmap/versions",
    "/api/agent-events"
  ]) {
    const res = await app(path);
    if (!res.response.ok) throw new Error(path + " failed");
  }

  const { data: docs } = await supabase
    .from("profile_documents")
    .select("storage_path")
    .eq("id", documentId)
    .limit(1);

  const storagePath = docs?.[0]?.storage_path;
  if (storagePath) {
    const { error } = await supabase.storage.from("profile-documents").remove([storagePath]);
    print("storage cleanup", { removed: !error });
  }

  console.log("\nSMOKE_RESULT=PASS");
  console.log("SMOKE_TEST_USER_ID=" + signup.user.id);
  console.log("SMOKE_TEST_EMAIL=" + email);
}

main().catch(error => {
  console.error("SMOKE_RESULT=FAIL");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
