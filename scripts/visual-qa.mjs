import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const baseUrl = process.env.BASE_URL ?? "https://skilltwin-production.up.railway.app";
const email = process.env.SMOKE_EMAIL?.trim() ?? "";
const password = process.env.SMOKE_PASSWORD ?? "";
const requireAuth = process.env.REQUIRE_AUTH_VISUAL === "true";
const outputRoot = path.resolve("artifacts/visual-qa");
const expectedCommitSha = process.env.EXPECTED_COMMIT_SHA?.trim().toLowerCase() ?? "";
const deployWaitMs = Number(process.env.DEPLOY_WAIT_MS ?? 8 * 60 * 1000);

const viewports = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 }
];

const publicPages = [
  { name: "home", path: "/" },
  { name: "login", path: "/login" },
  { name: "forgot-password", path: "/forgot-password" }
];

const authenticatedPages = [
  { name: "overview", path: "/overview" },
  { name: "onboarding", path: "/onboarding" },
  { name: "skills", path: "/skills" },
  { name: "roadmap", path: "/roadmap" },
  { name: "practice", path: "/practice" },
  { name: "projects", path: "/projects" },
  { name: "progress", path: "/progress" },
  { name: "journey", path: "/journey" },
  { name: "activity", path: "/activity" },
  { name: "settings", path: "/settings" }
];

await fs.rm(outputRoot, { recursive: true, force: true });
await fs.mkdir(outputRoot, { recursive: true });

function commitMatches(actual, expected) {
  const normalizedActual = String(actual ?? "").trim().toLowerCase();
  if (!normalizedActual || !expected) return false;
  return normalizedActual === expected
    || normalizedActual.startsWith(expected)
    || expected.startsWith(normalizedActual);
}

async function waitForProductionCommit() {
  if (!expectedCommitSha) return;

  const deadline = Date.now() + deployWaitMs;
  let lastSeen = "unavailable";

  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl + "/api/health", { cache: "no-store" });
      if (response.ok) {
        const payload = await response.json();
        const health = payload?.data ?? {};
        lastSeen = String(health.commitSha ?? health.version ?? "unknown");
        if (health.platform === "railway" && commitMatches(health.commitSha ?? health.version, expectedCommitSha)) {
          console.log("VISUAL_QA_DEPLOYMENT_COMMIT=PASS " + lastSeen);
          return;
        }
      }
    } catch (error) {
      lastSeen = error instanceof Error ? error.message : String(error);
    }

    console.log("VISUAL_QA_WAITING_FOR_DEPLOYMENT expected=" + expectedCommitSha.slice(0, 8) + " seen=" + lastSeen);
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  throw new Error(
    "Production did not serve expected commit " + expectedCommitSha
      + " within " + deployWaitMs + "ms. Last seen: " + lastSeen
  );
}

await waitForProductionCommit();

const browser = await chromium.launch({ headless: true });
const report = {
  baseUrl,
  authenticatedCredentialsConfigured: Boolean(email && password),
  requireAuth,
  startedAt: new Date().toISOString(),
  viewports: [],
  failures: [],
  warnings: []
};

function pushFailure(message) {
  report.failures.push(message);
  console.error("VISUAL_QA_FAIL " + message);
}

function pushWarning(message) {
  report.warnings.push(message);
  console.warn("VISUAL_QA_WARN " + message);
}

async function auditPage(context, viewportName, item) {
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  let status = null;
  let finalUrl = "";
  let navigationError = null;
  let metrics = null;
  let accessibility = null;

  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  try {
    const response = await page.goto(baseUrl + item.path, {
      waitUntil: "networkidle",
      timeout: 30000
    });
    status = response?.status() ?? null;
    finalUrl = page.url();
    await page.waitForTimeout(500);

    metrics = await page.evaluate(() => {
      const html = document.documentElement;
      const body = document.body;
      const viewportWidth = html.clientWidth;
      const viewportHeight = html.clientHeight;
      const scrollWidth = Math.max(html.scrollWidth, body?.scrollWidth ?? 0);
      const scrollHeight = Math.max(html.scrollHeight, body?.scrollHeight ?? 0);
      return {
        viewportWidth,
        viewportHeight,
        scrollWidth,
        scrollHeight,
        horizontalOverflowPx: Math.max(0, scrollWidth - viewportWidth),
        title: document.title,
        bodyTextLength: body?.innerText?.trim().length ?? 0,
        headingCount: document.querySelectorAll("h1,h2,h3").length
      };
    });

    accessibility = await page.evaluate(() => {
      const duplicateIds = [...document.querySelectorAll("[id]")]
        .map(node => node.id)
        .filter(Boolean)
        .filter((id, index, all) => all.indexOf(id) !== index)
        .filter((id, index, all) => all.indexOf(id) === index);

      const missingAltImages = [...document.querySelectorAll("img")]
        .filter(image => !image.hasAttribute("alt"))
        .map(image => image.getAttribute("src") ?? "<unknown>");

      const controls = [...document.querySelectorAll("input,select,textarea,button")];
      const unlabeledControls = controls
        .filter(control => {
          if (control instanceof HTMLInputElement && control.type === "hidden") return false;
          const aria = control.getAttribute("aria-label") || control.getAttribute("aria-labelledby");
          if (aria) return false;
          if (control instanceof HTMLButtonElement && control.textContent?.trim()) return false;
          const id = control.getAttribute("id");
          if (id && document.querySelector('label[for="' + CSS.escape(id) + '"]')) return false;
          if (control.closest("label")) return false;
          const title = control.getAttribute("title");
          return !title;
        })
        .map(control => {
          const element = control;
          return element.tagName.toLowerCase()
            + (element.getAttribute("name") ? "[name=" + element.getAttribute("name") + "]" : "")
            + (element.getAttribute("type") ? "[type=" + element.getAttribute("type") + "]" : "");
        });

      return {
        duplicateIds,
        missingAltImages,
        unlabeledControls
      };
    });

    const dir = path.join(outputRoot, viewportName);
    await fs.mkdir(dir, { recursive: true });
    await page.screenshot({
      path: path.join(dir, item.name + ".png"),
      fullPage: true
    });
  } catch (error) {
    navigationError = error instanceof Error ? error.message : String(error);
  } finally {
    await page.close();
  }

  const prefix = viewportName + "/" + item.name;
  if (navigationError) pushFailure(prefix + ": navigation failed: " + navigationError);
  if (status != null && status >= 400) pushFailure(prefix + ": HTTP " + status);
  if (metrics?.horizontalOverflowPx > 2) pushFailure(prefix + ": horizontal overflow " + metrics.horizontalOverflowPx + "px");
  if (metrics && metrics.bodyTextLength < 20) pushFailure(prefix + ": page rendered almost no text");
  if (pageErrors.length) pushFailure(prefix + ": page errors: " + pageErrors.join(" | "));
  if (consoleErrors.length) pushWarning(prefix + ": console errors: " + consoleErrors.slice(0, 5).join(" | "));
  if (accessibility?.duplicateIds.length) pushFailure(prefix + ": duplicate IDs: " + accessibility.duplicateIds.join(", "));
  if (accessibility?.missingAltImages.length) pushFailure(prefix + ": images missing alt text: " + accessibility.missingAltImages.join(", "));
  if (accessibility?.unlabeledControls.length) pushFailure(prefix + ": unlabeled controls: " + accessibility.unlabeledControls.join(", "));

  return {
    name: item.name,
    path: item.path,
    status,
    finalUrl,
    metrics,
    accessibility,
    pageErrors,
    consoleErrors,
    navigationError
  };
}

async function signIn(context) {
  if (!email || !password) {
    return { ok: false, reason: "SMOKE_EMAIL/SMOKE_PASSWORD not configured" };
  }

  const page = await context.newPage();
  try {
    await page.goto(baseUrl + "/login", { waitUntil: "networkidle", timeout: 30000 });
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await Promise.all([
      page.waitForURL(url => !url.pathname.startsWith("/login"), { timeout: 20000 }),
      page.locator('button[type="submit"]').click()
    ]);
    return { ok: true, finalUrl: page.url() };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
      finalUrl: page.url()
    };
  } finally {
    await page.close();
  }
}

for (const viewport of viewports) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    reducedMotion: "no-preference"
  });

  const viewportReport = {
    ...viewport,
    auth: null,
    pages: []
  };

  for (const item of publicPages) {
    viewportReport.pages.push(await auditPage(context, viewport.name, item));
  }

  viewportReport.auth = await signIn(context);

  if (viewportReport.auth.ok) {
    for (const item of authenticatedPages) {
      viewportReport.pages.push(await auditPage(context, viewport.name, item));
    }
  } else {
    const message = viewport.name + ": authenticated visual QA skipped: " + (viewportReport.auth.reason ?? "unknown");
    if (requireAuth) pushFailure(message);
    else pushWarning(message);
  }

  report.viewports.push(viewportReport);
  await context.close();
}

await browser.close();

report.finishedAt = new Date().toISOString();
await fs.writeFile(path.join(outputRoot, "report.json"), JSON.stringify(report, null, 2));

console.log("VISUAL_QA_FAILURES=" + report.failures.length);
console.log("VISUAL_QA_WARNINGS=" + report.warnings.length);
console.log("VISUAL_QA_REPORT=" + path.join(outputRoot, "report.json"));

if (report.failures.length) process.exitCode = 1;
