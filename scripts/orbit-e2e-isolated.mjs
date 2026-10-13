import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

/**
 * Opt-in, WRITING test. NEVER run on production or a personal account.
 * Requires a human-verified isolated Supabase development database, a branch
 * preview app, and a disposable dedicated learner account.
 *
 * This code does not bypass assessment evaluation, select correct answers,
 * or access answer keys. It deliberately submits ordinary sample answers.
 */
const allowed=process.env.ORBIT_E2E_ALLOW_WRITES==="TEST_ACCOUNT_ONLY";
const isolated=process.env.ORBIT_E2E_ISOLATED_PREVIEW==="YES";
const branchRef=process.env.ORBIT_E2E_TEST_DB_REF?.trim();
const origin=process.env.BASE_URL?.trim().replace(/\/$/,"");
const email=process.env.SMOKE_EMAIL?.trim();
const password=process.env.SMOKE_PASSWORD;
const url=origin?new URL(origin):null;
const blocked=["skilltwin-production.up.railway.app","skilltwin.vercel.app"];
if(!allowed||!isolated||!branchRef||branchRef==="eozvilqmrhtujqtdmrri"||
  !url||blocked.includes(url.hostname)||!email||!password){
  console.error("ORBIT_E2E_BLOCKED: requires disposable test credentials, a human-verified isolated preview and a NON-PRODUCTION Supabase project ref.");
  process.exit(2);
}
const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext({viewport:{width:1280,height:800},reducedMotion:"reduce"});
  const page=await context.newPage();
  await page.goto(origin+"/login",{waitUntil:"domcontentloaded",timeout:40000});
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await Promise.all([
    page.waitForURL(x=>!x.pathname.startsWith("/login"),{timeout:30000}),
    page.locator('button[type="submit"]').click()
  ]);
  await page.goto(origin+"/orbit-prove",{waitUntil:"domcontentloaded",timeout:50000});
  await page.locator(".op-skill-list").waitFor();
  const eligible=page.locator(".op-skill-option").filter({hasText:"Verified challenge ready"}).first();
  assert.ok(await eligible.count(),"Isolated seed must include at least one validated question bank and no preexisting active session");
  const skillName=await eligible.locator("strong").innerText();
  await eligible.click();
  await page.getByRole("button",{name:"Start verified challenge"}).click();
  await page.waitForURL(x=>/^\/orbit-prove\/session\/[0-9a-f-]{36}$/i.test(x.pathname),{timeout:40000});
  const id=new URL(page.url()).pathname.split("/").pop();
  assert.ok(id,"Assessment id should be present after launch");
  const session=page.locator(".op-session-content");
  let completed=false;
  for(let step=0;step<20;step++){
    if(await session.getByText("Validation complete",{exact:true}).count()){completed=true;break;}
    const submit=session.getByRole("button",{name:"Submit answer",exact:true});
    await submit.waitFor({state:"visible",timeout:30000});
    const options=session.locator("div.mt-6.space-y-3 > button");
    if(await options.count()){
      await options.first().click();
    }else{
      const textarea=session.locator("textarea");
      assert.ok(await textarea.count(),"Unknown validated question presentation");
      await textarea.fill("Test account demonstration response. I would verify requirements and explain the tradeoffs before acting.");
    }
    await submit.click();
    // Wait for persisted completion or feedback acknowledgment.
    await Promise.race([
      session.getByText("Validation complete",{exact:true}).waitFor({state:"visible",timeout:45000}),
      session.getByRole("button",{name:"Continue",exact:true}).waitFor({state:"visible",timeout:45000})
    ]);
    if(await session.getByText("Validation complete",{exact:true}).count()){completed=true;break;}
    await session.getByRole("button",{name:"Continue",exact:true}).click();
  }
  assert.ok(completed,"Assessment did not finish in 20 responses");
  const response=await context.request.get(origin+"/api/assessments/"+encodeURIComponent(id),{timeout:30000});
  assert.equal(response.status(),200,"Committed assessment must be retrievable");
  const payload=await response.json();
  assert.equal(payload.ok,true,"Authenticated assessment API should return an outcome");
  assert.equal(payload.data?.assessment?.status,"COMPLETED","Assessment status should be persisted");
  assert.ok(payload.data?.outcome,"Persisted outcome must be present");

  // Exact proof/history linkage is checked on the canonical Prove page.
  const skillId=payload.data?.assessment?.skill?.id;
  assert.ok(skillId,"Completed assessment should resolve its canonical skill");
  await page.goto(origin+"/orbit-prove?skillId="+encodeURIComponent(skillId),{waitUntil:"domcontentloaded",timeout:50000});
  await page.locator(".op-selected-head h2").waitFor({state:"visible",timeout:30000});
  assert.equal(await page.locator(".op-selected-head h2").innerText(),skillName,"Return view should show the challenged skill");
  await page.getByText("Recorded completed challenge").waitFor({timeout:30000});
  const status=page.locator(".op-roadmap-outcome-heading strong");
  await status.waitFor({state:"visible",timeout:10000});
  const text=await status.innerText();
  assert.ok(text==="Roadmap revised"||text==="Roadmap deliberately unchanged","A completed isolated proof must have an explainable recorded replan decision");
  console.log("ORBIT_E2E_PASS: verified assessment outcome, source-linked Prove history and recorded roadmap decision (no personal details printed).");
  await context.close();
}finally{await browser.close();}
