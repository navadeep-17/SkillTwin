import assert from "node:assert/strict";
import {chromium} from "@playwright/test";

/**
 * RAG pilot signed-in smoke. This sends chat messages to a disposable test
 * account and therefore WRITES conversation history. Run only against a
 * verified isolated preview with SKILLTWIN_AGENT_V3_RAG_ENABLED=true.
 * It does not start any assessment, update evidence, change a learning plan,
 * inspect another learner's data or print private chat responses.
 */
const expectedDb=process.env.RAG_QA_TEST_DB_REF?.trim();
const base=process.env.BASE_URL?.trim().replace(/\/$/,"");
const url=base?new URL(base):null;
const email=process.env.SMOKE_EMAIL?.trim();
const password=process.env.SMOKE_PASSWORD;
const project=process.env.RAG_QA_SAVED_PROJECT_NAME?.trim();
const repo=process.env.RAG_QA_EXPECT_REPOSITORY?.trim();
const productionProject="eozvilqmrhtujqtdmrri";
if(process.env.RAG_QA_ISOLATED_PREVIEW!=="YES" || !expectedDb ||
  expectedDb===productionProject || !url ||
  ["skilltwin-production.up.railway.app","skilltwin.vercel.app"].includes(url.hostname) ||
  !email || !password || !project || !repo ||
  !/^[A-Za-z0-9-]+\/[A-Za-z0-9_.-]+$/.test(repo)){
  console.error("RAG_QA_BLOCKED: verify isolated preview + non-production DB ref, opt-in flag, disposable learner and saved public project.");
  process.exit(2);
}
const browser=await chromium.launch({headless:true});
try {
  const ctx=await browser.newContext({viewport:{width:1280,height:820}});
  const page=await ctx.newPage();
  await page.goto(base+"/login",{waitUntil:"domcontentloaded",timeout:45000});
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await Promise.all([
    page.waitForURL(u=>!u.pathname.startsWith("/login"),{timeout:35000}),
    page.locator('button[type="submit"]').click()
  ]);
  const send=async message=>{
    const response=await ctx.request.post(base+"/api/chat",{
      data:{message},headers:{"Content-Type":"application/json"},timeout:45000
    });
    assert.equal(response.status(),200,"Authenticated chat request failed");
    const body=await response.json();
    assert.equal(body.ok,true,"Chat must return success");
    assert.ok(body.data?.message?.content,"Expected saved assistant message");
    assert.equal(body.data?.actionProposal??null,null,"Source RAG must never propose a write action");
    return body.data.message;
  };
  const cited=await send("Explain the authentication logic in my project "+project+" GitHub source code.");
  assert.match(cited.agentMode??"",/^source-rag-(gemini|fallback)-v1$/,"Agent V3 routing is not active in this isolated environment");
  assert.ok((cited.refs??[]).some(r=>r.type==="profile_project"),"Source answer must reference a saved user-owned project");
  const pattern=/https:\/\/github\.com\/[A-Za-z0-9-]+\/[A-Za-z0-9_.-]+\/blob\/([a-f0-9]{40})\/[^\s]+#L\d+-L\d+/ig;
  const links=[...cited.content.matchAll(pattern)];
  assert.ok(links.length>0,"No commit-pinned source citations returned: verify fixture has matching code in the inspected first three files");
  const commits=new Set(links.map(m=>m[1].toLowerCase()));
  assert.equal(commits.size,1,"All citations must come from a single pinned commit");
  for(const m of links)assert.ok(m[0].includes("github.com/"+repo+"/blob/"),"Citation points outside the selected repository");

  // This request must abstain on a concept absent from the bounded fixture.
  const absent=await send("Find the zzqvvindigoops function in my "+project+" GitHub repository code.");
  assert.match(absent.agentMode??"",/^source-rag-(gemini|fallback)-v1$/);
  assert.match(absent.content,/could not find a passage matching your question/i);
  assert.ok(!absent.content.includes("https://github.com/"),"Absent concept must never receive a code citation");
  assert.equal(absent.actionProposal??null,null);

  // Prior normal skill explanations must not be routed into the code retriever.
  const ordinary=await send("What is my current skill confidence?");
  assert.ok(!String(ordinary.agentMode??"").startsWith("source-rag-"),
    "Ordinary SkillTwin skill questions must continue through the existing agent tools");
  assert.equal(ordinary.actionProposal??null,null);
  console.log("RAG_QA_PASS: isolated signed-in code citation, abstention boundary, legacy skill routing and no action proposal.");
  await ctx.close();
}finally{await browser.close();}
