/**
 * Read-only HACK-X feature QA. Run against a branch-preview or staging URL.
 *
 * Required: BASE_URL, SMOKE_EMAIL, SMOKE_PASSWORD.
 * Optional: SMOKE_SECOND_EMAIL, SMOKE_SECOND_PASSWORD for isolation.
 * No personal screenshots, cookies or generated reports are saved.
 */
import { chromium } from "@playwright/test";

const baseUrl = (process.env.BASE_URL ?? "").replace(/\/$/, "");
const email = process.env.SMOKE_EMAIL?.trim();
const password = process.env.SMOKE_PASSWORD;
const secondEmail = process.env.SMOKE_SECOND_EMAIL?.trim();
const secondPassword = process.env.SMOKE_SECOND_PASSWORD;
const results = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function allowedUrl(raw) {
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "https:" && (
      parsed.hostname.endsWith(".up.railway.app") ||
      parsed.hostname.endsWith(".vercel.app") ||
      parsed.hostname.endsWith(".railway.app")
    );
  } catch { return false; }
}
function pass(label) {
  results.push({ check: label, status: "PASS" });
  console.log("PASS " + label);
}
function skip(label, reason) {
  results.push({ check: label, status: "SKIP", reason });
  console.log("SKIP " + label + " — " + reason);
}
async function visit(page, path) {
  const response = await page.goto(baseUrl + path, { waitUntil: "domcontentloaded", timeout: 30000 });
  assert(response && response.status() < 400, path + " returned an error response");
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  return page;
}
async function login(context, username, secret) {
  const page = await context.newPage();
  await visit(page, "/login");
  await page.locator('input[type="email"]').fill(username);
  await page.locator('input[type="password"]').fill(secret);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(url => !url.pathname.startsWith("/login"), { timeout: 25000 });
  assert(!page.url().includes("/login"), "sign-in did not finish");
  await page.close();
}
async function checkPage(context, path, heading) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await visit(page, path);
  assert(!page.url().includes("/login"), path + " unexpectedly redirected to sign-in");
  assert(await page.getByRole("heading", { name: heading }).count() > 0, path + " heading missing");
  assert(errors.length === 0, path + " runtime errors: " + errors.join(" | "));
  return page;
}

assert(allowedUrl(baseUrl), "BASE_URL must be an HTTPS Railway or Vercel preview/staging hostname");
assert(email && password, "SMOKE_EMAIL and SMOKE_PASSWORD are required for real authenticated QA");
const browser = await chromium.launch({ headless: true });
try {
  // No session: private routes must redirect before returning any evidence.
  const anonymous = await browser.newContext();
  for (const path of ["/passport", "/discover"]) {
    const page = await anonymous.newPage();
    await page.goto(baseUrl + path, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForURL(url => url.pathname.startsWith("/login"), { timeout: 15000 });
    pass("anonymous " + path + " redirects to sign-in");
    await page.close();
  }
  await anonymous.close();

  const primary = await browser.newContext({ viewport: { width: 1365, height: 900 } });
  await login(primary, email, password);

  const passport = await checkPage(primary, "/passport", /Career Evidence Passport/);
  const hasGoal = (await passport.getByText("Private report", { exact: true }).count()) > 0;
  if (hasGoal) {
    assert(await passport.getByText("Model-based guidance, not hiring probability").count() > 0,
      "Passport readiness needs its non-hiring-probability disclaimer");
    assert(await passport.getByText("Important limitations").count() > 0,
      "Passport needs its qualification limitations");
    await passport.emulateMedia({ media: "print" });
    const hidden = await passport.locator(".passport-actions").first().evaluate(
      el => getComputedStyle(el).display === "none"
    );
    assert(hidden, "print layout did not hide the private actions");
    const pdfBytes = await passport.pdf({ printBackground: true, format: "A4" });
    assert(pdfBytes.length > 1000, "print-to-PDF generated an empty report");
    pass("Passport content and in-memory A4 PDF generation");
  } else {
    assert(await passport.getByRole("link", { name: /Set up my career goal/ }).count() > 0,
      "Passport empty state must lead to onboarding");
    pass("Passport empty-goal state");
  }
  await passport.close();

  const discovery = await checkPage(primary, "/discover", /Explore where your skills could take you/);
  const cards = discovery.locator('button[aria-controls="career-details"]');
  if (await cards.count() > 0) {
    await cards.first().click();
    const deepLink = discovery.getByRole("link", { name: /Explore this as my goal/ });
    const href = await deepLink.getAttribute("href");
    assert(/^\/onboarding\?role=[a-f\d-]{36}$/i.test(href ?? ""), "role selection does not deep link to onboarding");
    await visit(discovery, href);
    assert(await discovery.getByRole("heading", { name: /Build a SkillTwin/ }).count() > 0,
      "onboarding failed to open after exploring a career");
    pass("Discovery role selection opens onboarding without a write");
  } else {
    assert(await discovery.getByText(/Career catalog is currently empty|No matching roles/).count() > 0,
      "empty discovery needs an explanation");
    pass("Discovery empty catalog state");
  }
  await discovery.close();
  await primary.close();

  // A second account provides an additional, non-destructive RLS visibility check.
  if (secondEmail && secondPassword) {
    const secondary = await browser.newContext();
    await login(secondary, secondEmail, secondPassword);
    const page = await checkPage(secondary, "/passport", /Career Evidence Passport/);
    const nav = page.getByText(secondEmail, { exact: true });
    assert(await nav.count() > 0, "second account navigation does not match its identity");
    assert(await page.getByText(email, { exact: true }).count() === 0,
      "first account identifier appeared in second account view");
    pass("second user sees their own account");
    await page.close();
    await secondary.close();
  } else skip("two-account isolation", "second smoke user credentials not configured");
} finally {
  await browser.close();
}
console.log(JSON.stringify({ result: "PASS", baseUrl, checks: results }, null, 2));
