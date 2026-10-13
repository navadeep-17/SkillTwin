import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

// Run only against a branch preview or local server with a dedicated test user.
// This test NEVER saves profile changes, starts assessments or uploads files.
const base = (process.env.BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const email = process.env.SMOKE_EMAIL?.trim();
const password = process.env.SMOKE_PASSWORD;
if (!email || !password) {
  console.error("ORBIT_AUTH_QA_NOT_RUN: provide SMOKE_EMAIL and SMOKE_PASSWORD for a dedicated test account.");
  process.exit(2);
}
const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 }
];
const browser = await chromium.launch({ headless: true });
let failed = false;
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport: {width: viewport.width,height: viewport.height}, reducedMotion: viewport.name==="mobile"?"reduce":"no-preference" });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", () => errors.push("CLIENT_ERROR"));
    try {
      await page.goto(base + "/login", {waitUntil:"domcontentloaded",timeout:40000});
      await page.locator('input[type="email"]').fill(email);
      await page.locator('input[type="password"]').fill(password);
      await Promise.all([
        page.waitForURL(url=>!url.pathname.startsWith("/login"),{timeout:30000}),
        page.locator('button[type="submit"]').click()
      ]);

      const screens = [
        {path:"/orbit-beta",marker:".orbit-live-inner"},
        {path:"/orbit-skills",marker:".orbit-skills-inner"},
        {path:"/orbit-journey",marker:".oj-main"},
        {path:"/orbit-prove",marker:".op-main"},
        {path:"/orbit-onboarding",marker:".orbit-onboarding-frame"}
      ];
      for (const item of screens) {
        const response = await page.goto(base + item.path,{waitUntil:"domcontentloaded",timeout:50000});
        assert.equal(response?.status(),200,viewport.name+" "+item.path+" did not load");
        assert.equal(new URL(page.url()).pathname,item.path,viewport.name+" "+item.path+" redirected unexpectedly");
        await page.locator(item.marker).waitFor({state:"visible",timeout:30000});
        assert.equal(await page.locator('text=/Application error|Internal Server Error/').count(),0,item.path+" displayed a server error");
        const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
        assert.ok(overflow<=2,viewport.name+" "+item.path+" overflows horizontally");
        if (item.path==="/orbit-skills") {
          const list=page.getByRole("button",{name:"List",exact:true});
          if(await list.isVisible()) await list.click();
          const row=page.locator(".orbit-skills-list-item").first();
          if(await row.count()) {
            await row.click();
            assert.equal(await row.getAttribute("aria-pressed"),"true","Selecting a competency should inspect it");
            await page.locator(".orbit-skills-detail h2").waitFor({state:"visible"});
          } else {
            await page.locator(".orbit-skills-empty").waitFor({state:"visible"});
          }
        }
        console.log("ORBIT_AUTH_PASS " + viewport.name + " " + item.path);
      }
      assert.deepEqual(errors,[],viewport.name+" client errors");
    } catch {
      failed=true;
      console.error("ORBIT_AUTH_FAIL " + viewport.name + " — inspect private local browser logs; user data is not printed.");
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
if (failed) process.exitCode=1;
