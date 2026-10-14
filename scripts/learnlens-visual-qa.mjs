import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";
import {chromium} from "@playwright/test";

const base=process.env.BASE_URL ?? "http://127.0.0.1:3017";
const out="artifacts/orbit-visual-qa";
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
  for(const v of [{name:"desktop",width:1440,height:900},{name:"mobile",width:390,height:844},{name:"small-mobile",width:360,height:780}]){
    const context=await browser.newContext({viewport:{width:v.width,height:v.height},reducedMotion:"reduce"});
    const page=await context.newPage();
    const errors=[];
    const forbidden=[];
    page.on("pageerror",e=>errors.push(e.message));
    page.on("request",request=>{
      if(request.method()!=="GET" && new URL(request.url()).pathname.startsWith("/api/"))forbidden.push(request.url());
    });
    const res=await page.goto(base+"/learnlens-preview",{waitUntil:"networkidle",timeout:45000});
    assert.equal(res?.status(),200,"public fixture loads");
    await page.getByRole("heading",{name:/SQL JOINs: Understand the relationships/}).waitFor();
    await page.getByText(/full transcript has not been licensed or retrieved/i).waitFor();
    assert.equal(await page.locator("iframe").count(),0,"YouTube embed must await explicit consent");
    const questions=page.locator("fieldset");
    assert.equal(await questions.count(),3);
    const before=page.getByRole("button",{name:"Check my answers"});
    assert.equal(await before.isDisabled(),true);
    for(const [index,answer] of ["INNER JOIN","LEFT JOIN","It specifies how rows are matched"].entries()){
      await questions.nth(index).getByRole("radio",{name:answer,exact:true}).check();
    }
    assert.equal(await before.isEnabled(),true);
    await before.click();
    await page.getByText("3 of 3 correct").waitFor();
    await page.getByRole("button",{name:"Try again"}).click();
    assert.equal(await page.getByRole("button",{name:"Check my answers"}).isDisabled(),true);
    await page.getByLabel("Draft your solution (not saved)").fill("SELECT c.name FROM customers c");
    await page.getByRole("button",{name:"Reveal example solution"}).click();
    await page.locator("pre").filter({hasText:"LEFT JOIN orders o ON c.id = o.customer_id"}).last().waitFor();
    const chapters=page.getByRole("button",{name:/Play LEFT JOIN from 13:55/});
    await chapters.click();
    await page.locator("iframe[src*='youtube-nocookie.com/embed/0OQJDd3QqQM']").waitFor();
    assert.ok((await page.locator("iframe").getAttribute("src")).includes("start=835"));
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    assert.ok(overflow<=2,v.name+" LearnLens overflows horizontally: "+overflow);
    await page.screenshot({path:out+"/"+v.name+"-learnlens.png",fullPage:true,animations:"disabled"});
    // Verify the sample toggles really select different skill-level lessons;
    // no learner record is created and no unsupported transcript is shown.
    const samples=[
      {skill:"python",name:/Python: Variables/,level:"BASIC"},
      {skill:"python",name:/Python: Reusable functions/,level:"STANDARD"},
      {skill:"git",name:/Git: From working tree/,level:"BASIC"},
      {skill:"git",name:/Git: Branches and pull requests/,level:"STANDARD"},
      {skill:"docker",name:/Docker: Images/,level:"BASIC"},
      {skill:"docker",name:/Docker: Build an image/,level:"STANDARD"}
    ];
    for(const sample of samples){
      const response=await page.goto(base+"/learnlens-preview?skill="+sample.skill+"&level="+sample.level,
        {waitUntil:"domcontentloaded",timeout:45000});
      assert.equal(response?.status(),200,"Selected lesson must load");
      await page.getByRole("heading",{name:sample.name}).waitFor();
      assert.equal(await page.locator("fieldset").count(),3,"Lesson has three formative questions");
      assert.equal(await page.locator("iframe").count(),0,"Video requires an explicit click");
      assert.ok((await page.getByLabel("Draft your solution (not saved)").count())===1);
      const width=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
      assert.ok(width<=2,sample.skill+" "+sample.level+" overflows "+v.name+" by "+width+"px");
    }
    assert.deepEqual(errors,[],v.name+" browser errors");
    assert.deepEqual(forbidden,[],v.name+" must not write learner state");
    await context.close();
  }
}finally{await browser.close();}
