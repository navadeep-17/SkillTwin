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
    const response = await page.goto(base + "/orbit-lab", { waitUntil: "networkidle", timeout: 45000 });
    assert.equal(response?.status(), 200, v.name + " prototype route must load");
    await page.getByRole("heading", { name: /Meet the AI that/i }).waitFor();
    await page.screenshot({ path: out + "/" + v.name + "-landing.png", fullPage: true });

    await page.getByRole("button", { name: "Today", exact: true }).click();
    await page.getByRole("heading", { name: /Every skill has a story/i }).waitFor();
    const task = page.getByRole("button", { name: /Review model evaluation fundamentals/ });
    await task.click();
    assert.equal(await task.getAttribute("aria-pressed"), "true", "Demo checklist must react");
    await page.screenshot({ path: out + "/" + v.name + "-today.png", fullPage: true });

    await page.getByRole("button", { name: "Challenge", exact: true }).click();
    await page.getByRole("heading", { name: /Don't just trust your Twin/i }).waitFor();
    const submit = page.getByRole("button", { name: /Submit demo answer/ });
    assert.equal(await submit.isDisabled(), true, "Submit must be disabled before choice");
    await page.getByRole("button", { name: /\[n \*\* 2 for n in numbers\]/ }).click();
    await submit.click();
    await page.getByRole("heading", { name: /New evidence can strengthen/i }).waitFor();
    await page.getByText(/No assessment, score or roadmap is saved/).waitFor();
    await page.screenshot({ path: out + "/" + v.name + "-challenge-result.png", fullPage: true });

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth
    }));
    assert.ok(overflow.scrollWidth <= overflow.viewportWidth + 1,
      v.name + " has horizontal overflow: " + JSON.stringify(overflow));

    const screenshotErrors = [];
    page.on("pageerror", e => screenshotErrors.push(e.message));
    assert.deepEqual(screenshotErrors, [], v.name + " client errors");
    console.log(v.name + ": screenshots, navigation, checklist, assessment demo and overflow checks passed");
    await context.close();
  }
} finally {
  await browser.close();
}
