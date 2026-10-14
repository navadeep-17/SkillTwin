import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {plain,rankLiveJobs,regionRelevant,seniorTitle} from "../lib/domain/live-job-matching.ts";

const now = new Date("2026-10-14T00:00:00.000Z");
const sample = (override={})=>({
  id:123,
  jobTitle:"Backend Software Engineer",
  companyName:"Sample Employer",
  url:"https://jobicy.com/jobs/backend-software-engineer/",
  jobGeo:"Worldwide",
  jobLevel:"Junior",
  jobType:["Full-Time"],
  jobExcerpt:"Work with Python SQL and Docker on APIs",
  pubDate:"2026-10-13T13:00:00.000Z",
  ...override
});
const ranked=(records,overrides={})=>rankLiveJobs({
  records,role:"Backend Engineer",region:"all",hideSenior:true,
  recordedSkills:["Python"],now,...overrides
});

test("live jobs are source-backed and matched to a learner's role, not invented",()=>{
  const jobs=ranked([sample(),sample({id:55,jobTitle:"Marketing Manager",url:"https://jobicy.com/jobs/marketing"})]);
  assert.equal(jobs.length,1);
  const [job]=jobs;
  assert.equal(job.source,"Jobicy");
  assert.equal(job.title,"Backend Software Engineer");
  assert.equal(job.company,"Sample Employer");
  assert.match(job.url,/^https:\/\/jobicy\.com\/jobs\//);
  assert.deepEqual(job.signals.knownSkills,["python"]);
  assert.ok(job.signals.exploreNext.includes("sql"));
  assert.ok(job.signals.exploreNext.includes("docker"));
  assert.equal(Object.hasOwn(job,"fitScore"),false);
});

test("no remote URL injection, invalid timestamps or stale/duplicate offers",()=>{
  const records=[
    sample({id:1,url:"javascript:alert(1)"}),
    sample({id:2,url:"https://evil.example/jobs/phishing"}),
    sample({id:3,url:"https://jobicy.com.evil.example/jobs/phishing"}),
    sample({id:4,pubDate:"2026-09-01T00:00:00.000Z"}),
    sample({id:5}),
    sample({id:6,url:"https://jobicy.com/jobs/duplicate"})
  ];
  assert.equal(ranked(records).length,1);
  assert.equal(ranked(records)[0].id,"jobicy:5");
  assert.equal(ranked([sample({id:8,pubDate:"not a date"})]).length,0);
});

test("regional filters conservatively avoid assuming APAC implies India eligibility",()=>{
  assert.equal(regionRelevant("Worldwide","india"),true);
  assert.equal(regionRelevant("India","india"),true);
  assert.equal(regionRelevant("APAC","india"),false);
  assert.equal(regionRelevant("Europe","apac"),false);
  assert.equal(regionRelevant("Asia Pacific","apac"),true);
  assert.equal(regionRelevant("Anywhere","anywhere"),true);
  assert.equal(regionRelevant("United States","anywhere"),false);
  assert.equal(ranked([sample({jobGeo:"United States"})],{region:"india"}).length,0);
});

test("senior roles are hidden by default but available when a learner broadens the filter",()=>{
  const senior=sample({jobTitle:"Senior Backend Engineer",jobLevel:"Senior"});
  assert.equal(seniorTitle("Senior Backend Engineer","Senior"),true);
  assert.equal(ranked([senior]).length,0);
  const shown=ranked([senior],{hideSenior:false});
  assert.equal(shown.length,1);
  assert.equal(shown[0].signals.seniorRole,true);
});

test("untrusted provider snippets remain bounded plain text",()=>{
  assert.equal(plain("<b>Python</b> &amp; SQL",20),"Python & SQL");
  assert.equal(plain("a".repeat(800),30).length,30);
  assert.deepEqual(ranked([sample({jobTitle:"Unrelated Vacancy"})]),[]);
  assert.deepEqual(ranked([]),[]);
});

test("endpoint is authenticated, provider endpoint is fixed and failures never emit sample vacancies",()=>{
  const route=readFileSync(new URL("../app/api/jobs/recommendations/route.ts",import.meta.url),"utf8");
  const view=readFileSync(new URL("../components/discovery/live-job-opportunities.tsx",import.meta.url),"utf8");
  const parent=readFileSync(new URL("../components/discovery/career-discovery.tsx",import.meta.url),"utf8");
  assert.match(route,/await requireUser\(\)/);
  assert.match(route,/\.eq\("user_id",user\.id\)/);
  assert.match(route,/https:\/\/jobicy\.com\/api\/v2\/remote-jobs\?count=100/);
  assert.match(route,/revalidate:3600/);
  assert.match(route,/available=employerCatalogAvailable/);
  assert.match(route,/let employerCatalogAvailable=false/);
  assert.match(route,/jobs:combined/);
  assert.match(route,/jobs: ReturnType<typeof rankLiveJobs>\s*=\s*\[\]/);
  assert.match(parent,/<LiveJobOpportunities/);
  assert.match(view,/noopener noreferrer/);
  assert.match(view,/No closely matching roles/);
  assert.match(view,/temporarily unavailable/);
  assert.match(view,/Recorded skills can be self-reported|data\.disclaimer/);
  assert.doesNotMatch(view,/dangerouslySetInnerHTML/);
});
