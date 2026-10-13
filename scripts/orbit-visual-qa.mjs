import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

const base = process.env.BASE_URL ?? "http://127.0.0.1:3017";
const out = "artifacts/orbit-visual-qa";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const sizes = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
  { name: "small-mobile", width: 360, height: 780 }
];
try {
  for (const v of sizes) {
    const context = await browser.newContext({
      viewport: { width: v.width, height: v.height },
      deviceScaleFactor: 1,
      reducedMotion: v.name === "small-mobile" ? "reduce" : "no-preference"
    });
    const page = await context.newPage();
    const screenshotErrors = [];
    page.on("pageerror", e => screenshotErrors.push(e.message));
    const response = await page.goto(base + "/orbit-lab", { waitUntil: "networkidle", timeout: 45000 });
    assert.equal(response?.status(), 200, v.name + " prototype route must load");
    await page.getByRole("heading", { name: /Meet the AI that/i }).waitFor();
    await page.screenshot({ path: out + "/" + v.name + "-landing.png", fullPage: true, animations: "disabled" });

    await page.getByRole("button", { name: "Today", exact: true }).click();
    await page.getByRole("heading", { name: /Every skill has a story/i }).waitFor();
    const task = page.getByRole("button", { name: /Review model evaluation fundamentals/ });
    await task.click();
    assert.equal(await task.getAttribute("aria-pressed"), "true", "Demo checklist must react");
    await page.screenshot({ path: out + "/" + v.name + "-today.png", fullPage: true, animations: "disabled" });

    await page.getByRole("button", { name: "Challenge", exact: true }).click();
    await page.getByRole("heading", { name: /Don't just trust your Twin/i }).waitFor();
    const submit = page.getByRole("button", { name: /Submit demo answer/ });
    assert.equal(await submit.isDisabled(), true, "Submit must be disabled before choice");
    await page.getByRole("button", { name: /\[n \*\* 2 for n in numbers\]/ }).click();
    await submit.click();
    await page.getByRole("heading", { name: /New evidence can strengthen/i }).waitFor();
    await page.getByText(/No assessment, score or roadmap is saved/).waitFor();
    await page.screenshot({ path: out + "/" + v.name + "-challenge-result.png", fullPage: true, animations: "disabled" });

    // Public sample uses the same interactive graph/inspector component as the
    // protected My Twin route, allowing privacy-safe browser verification.
    const sampleResponse = await page.goto(base + "/orbit-lab/skill-demo", { waitUntil: "networkidle", timeout: 45000 });
    assert.equal(sampleResponse?.status(), 200, "Skill Constellation sample route must load");
    await page.getByRole("heading", { name: /Explore your skill universe/i }).waitFor();
    await page.getByRole("button", { name: "Graph", exact: true }).click();
    await page.locator(".react-flow__node").first().waitFor({ state: "visible", timeout: 20000 });
    await page.screenshot({ path: out + "/" + v.name + "-skill-graph.png", fullPage: true, animations: "disabled" });
    await page.getByRole("button", { name: "List", exact: true }).click();
    const python = page.locator(".orbit-skills-list-item").filter({ hasText: "Python" });
    await python.click();
    await page.getByRole("heading", { name: "Python", exact: true }).waitFor();
    await page.getByText(/Sample: built a Python data-cleaning project/).waitFor();
    await page.screenshot({ path: out + "/" + v.name + "-skill-inspector.png", fullPage: true, animations: "disabled" });
    await page.getByRole("button", { name: "Priority gaps", exact: true }).click();
    assert.equal(await page.locator(".orbit-skills-list-item").count(), 2, "Priority filter must isolate two sample gaps");
    const sampleOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(sampleOverflow <= 1, v.name + " graph page must not overflow horizontally: " + sampleOverflow);

    const journeyResponse = await page.goto(base + "/orbit-lab/journey-demo", { waitUntil: "networkidle", timeout: 45000 });
    assert.equal(journeyResponse?.status(), 200, "Public Journey demo must render");
    await page.getByRole("heading", { name: /A roadmap that moves with you/i }).waitFor();
    await page.getByRole("button", { name: /Week 2/i }).click();
    await page.getByRole("heading", { name: /Week 2: /i }).waitFor();
    await page.getByText("Study probability distributions").waitFor();
    await page.screenshot({ path: out + "/" + v.name + "-journey-milestones.png", fullPage: true, animations: "disabled" });
    await page.getByRole("button", { name: /Moved Python validation earlier/i }).click();
    await page.getByRole("heading", { name: "Moved Python validation earlier" }).waitFor();
    await page.getByText(/2 recorded operations/).waitFor();
    await page.screenshot({ path: out + "/" + v.name + "-journey-plandiff.png", fullPage: true, animations: "disabled" });
    await page.getByRole("button", { name: /Plan preserved · Not Material/i }).click();
    await page.getByRole("heading", { name: "Plan preserved intentionally" }).waitFor();
    const journeyOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(journeyOverflow <= 1, v.name + " Journey overflows horizontally: " + journeyOverflow);
    
    const proofCalls = [];
    page.on("request", request => {
      if (request.method()==="POST" && new URL(request.url()).pathname==="/api/assessments") proofCalls.push("ATTEMPTED_ASSESSMENT_WRITE");
    });
    const proofResponse = await page.goto(base + "/orbit-lab/proof-demo", { waitUntil: "networkidle", timeout: 45000 });
    assert.equal(proofResponse?.status(), 200, "Public fictional proof demo must render");
    await page.getByRole("heading", { name: /Your skills deserve real proof/i }).waitFor();
    await page.getByText(/Fictional data preview/).waitFor();
    await page.getByRole("heading", { name: "Python", exact: true }).waitFor();
    await page.getByText("Roadmap deliberately unchanged").waitFor();
    await page.screenshot({ path: out + "/" + v.name + "-proof-outcome.png", fullPage: true, animations: "disabled" });
    const demoButton = page.getByRole("button", { name: /Preview only — sign in to assess/ });
    assert.equal(await demoButton.isDisabled(), true, "Public fictional demo must not launch assessments");
    await page.locator(".op-skill-option").filter({ hasText: "Statistics" }).click();
    await page.getByText(/No completed proof is recorded for this skill yet/).waitFor();
    await page.screenshot({ path: out + "/" + v.name + "-proof-empty.png", fullPage: true, animations: "disabled" });
    await page.getByRole("button", { name: "All", exact: true }).click();
    await page.locator(".op-skill-option").filter({ hasText: "Model Deployment" }).click();
    await page.getByText(/At least four validated questions are required/).waitFor();
    assert.deepEqual(proofCalls, [], "Public demo must never POST assessments");
    const proofOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(proofOverflow <= 1, v.name + " Prove page overflows horizontally: " + proofOverflow);

    for (const route of ["/orbit-beta", "/orbit-onboarding", "/orbit-skills", "/orbit-journey", "/orbit-prove", "/orbit-prove/session/00000000-0000-0000-0000-000000000000"]) {
      const noSession = await page.request.get(base + route, { maxRedirects: 0 });
      assert.ok([302, 303, 307, 308].includes(noSession.status()), route + " must redirect anonymous visitors");
    }

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth
    }));
    assert.ok(overflow.scrollWidth <= overflow.viewportWidth + 1,
      v.name + " has horizontal overflow: " + JSON.stringify(overflow));

    assert.deepEqual(screenshotErrors, [], v.name + " client errors");
    console.log(v.name + ": screenshots, navigation, checklist, assessment demo and overflow checks passed");
    await context.close();
  }
} finally {
  await browser.close();
}
