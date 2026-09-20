import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const baseUrl = process.env.BASE_URL ?? "https://skilltwin-production.up.railway.app";
const email = process.env.SMOKE_EMAIL?.trim() ?? "";
const password = process.env.SMOKE_PASSWORD ?? "";
const outputRoot = path.resolve("artifacts/visual-qa");

const viewports = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 }
];

const publicPages = [
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
  { name: "settings", path: "/settings" },
  { name: "journey", path: "/journey" },
  { name: "activity", path: "/activity" }
];

await fs.rm(outputRoot, { recursive: true, force: true });
await fs.mkdir(outputRoot, { recursive: true });

const browser = await chromium.launch({ headless: true });
const report = {
  baseUrl,
  authenticated: Boolean(email && password),
  startedAt: new Date().toISOString(),
  viewports: [],
  failures: []
};

async function inspectPage(context, viewportName, item) {
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];

  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  let status = null;
  let finalUrl = "";
  let metrics = null;
  let navigationError = null;

  try {
    const response = await page.goto(baseUrl + item.path, {
      waitUntil: "networkidle",
      timeout: 30000
    });
    status = response?.status() ?? null;
    finalUrl = page.url();
    await page.waitForTimeout(700);

    metrics = await page.evaluate(() => {
      const html = document.documentElement;
      const body = document.body;
      const viewportWidth = html.clientWidth;
      const scrollWidth = Math.max(html.scrollWidth, body?.scrollWidth ?? 0);
      const viewportHeight = html.clientHeight;
      const scrollHeight = Math.max(html.scrollHeight, body?.scrollHeight ?? 0);
      const unnamedButtons = [...document.querySelectorAll("button")]
        .filter(button => {
          const aria = button.getAttribute("aria-label")?.trim();
          const text = button.textContent?.trim();
          const title = button.getAttribute("title")?.trim();
          return !aria && !text && !title;
        })
        .length;
      const imagesWithoutAlt = [...document.querySelectorAll("img")]
        .filter(image => !image.hasAttribute("alt"))
        .length;

      return {
        viewportWidth,
        viewportHeight,
        scrollWidth,
        scrollHeight,
        horizontalOverflowPx: Math.max(0, scrollWidth - viewportWidth),
        title: document.title,
        bodyTextLength: body?.innerText?.length ?? 0,
        unnamedButtons,
        imagesWithoutAlt
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

  const result = {
    name: item.name,
    path: item.path,
    status,
    finalUrl,
    metrics,
    pageErrors,
    consoleErrors,
    navigationError
  };

  if (navigationError) {
    report.failures.push(viewportName + "/" + item.name + ": navigation failed: " + navigationError);
  }
  if (status != null && status >= 400) {
    report.failures.push(viewportName + "/" + item.name + ": HTTP " + status);
  }
  if (metrics?.horizontalOverflowPx > 2) {
    report.failures.push(viewportName + "/" + item.name + ": horizontal overflow " + metrics.horizontalOverflowPx + "px");
  }
  if (metrics?.unnamedButtons > 0) {
    report.failures.push(viewportName + "/" + item.name + ": unnamed buttons " + metrics.unnamedButtons);
  }
  if (metrics?.imagesWithoutAlt > 0) {
    report.failures.push(viewportName + "/" + item.name + ": images without alt " + metrics.imagesWithoutAlt);
  }
  if (pageErrors.length) {
    report.failures.push(viewportName + "/" + item.name + ": page errors: " + pageErrors.join(" | "));
  }
  if (consoleErrors.length) {
    report.failures.push(viewportName + "/" + item.name + ": console errors: " + consoleErrors.join(" | "));
  }

  return result;
}

async function signIn(context) {
  if (!email || !password) return { ok: false, reason: "SMOKE_EMAIL/SMOKE_PASSWORD not configured" };

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
    viewportReport.pages.push(await inspectPage(context, viewport.name, item));
  }

  viewportReport.auth = await signIn(context);

  if (viewportReport.auth.ok) {
    for (const item of authenticatedPages) {
      viewportReport.pages.push(await inspectPage(context, viewport.name, item));
    }
  } else {
    console.log("AUTH_VISUAL_QA=SKIPPED " + viewport.name + " " + (viewportReport.auth.reason ?? ""));
  }

  report.viewports.push(viewportReport);
  await context.close();
}

await browser.close();

report.finishedAt = new Date().toISOString();
await fs.writeFile(path.join(outputRoot, "report.json"), JSON.stringify(report, null, 2));

console.log("VISUAL_QA_REPORT=" + path.join(outputRoot, "report.json"));
console.log("VISUAL_QA_FAILURES=" + report.failures.length);

if (report.failures.length) {
  for (const failure of report.failures) console.error("VISUAL_QA_FAIL " + failure);
  process.exitCode = 1;
}
