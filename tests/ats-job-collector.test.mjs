import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {JOB_SOURCES,feedUrl,validateSource} from "../lib/jobs/source-registry.ts";
import {normalizeAtsResponse} from "../lib/jobs/ats-normalizers.ts";
import {fetchBoard} from "../lib/jobs/fetch-boards.ts";
import {recommendEmployerJobs} from "../lib/jobs/recommend-employer-jobs.ts";

const source=provider=>JOB_SOURCES.find(item=>item.provider===provider);
const gh=source("greenhouse"),lev=source("lever"),ash=source("ashby");
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("all configured public boards have deterministic fixed-host endpoints",()=>{
  assert.ok(JOB_SOURCES.length>=7);
  assert.equal(new Set(JOB_SOURCES.map(s=>s.id)).size,JOB_SOURCES.length);
  for(const board of JOB_SOURCES){
    assert.doesNotThrow(()=>validateSource(board));
    const endpoint=new URL(feedUrl(board));
    assert.equal(endpoint.protocol,"https:");
    assert.ok(["boards-api.greenhouse.io","api.lever.co","api.ashbyhq.com"].includes(endpoint.hostname));
  }
  assert.throws(()=>feedUrl(lev,-1),/BAD_PAGE/);
  assert.throws(()=>validateSource({...gh,token:"127.0.0.1/evil"}));
  assert.throws(()=>validateSource({...gh,boardUrl:"https://evil.example/jobs"}));
});

test("Greenhouse parsing preserves update date without inventing publication date",()=>{
  const records=normalizeAtsResponse(gh,{jobs:[{
    id:1234,title:"Software Engineer",location:{name:"Hyderabad, India"},
    updated_at:"2026-10-13T08:00:00Z",
    absolute_url:"https://job-boards.greenhouse.io/redwoodsoftware/jobs/1234",
    content:"<p>Python &amp; SQL</p>"
  }]});
  assert.equal(records.length,1);
  assert.equal(records[0].publishedAt,null);
  assert.equal(records[0].sourceUpdatedAt,"2026-10-13T08:00:00.000Z");
  assert.equal(records[0].description,"Python & SQL");
  assert.equal(records[0].location,"Hyderabad, India");
  assert.equal(records[0].company,"Redwood Software");
});

test("Lever parsing maps canonical hosted posting URL and employment metadata",()=>{
  const records=normalizeAtsResponse(lev,[{
    id:"abc",text:"Software Engineer",categories:{location:"Bengaluru",commitment:"Full-time"},
    workplaceType:"hybrid",descriptionPlain:"Java and Docker",
    hostedUrl:"https://jobs.lever.co/acceldata/abc",createdAt:1791888000000
  }]);
  assert.equal(records.length,1);
  assert.equal(records[0].employmentType,"Full-time");
  assert.equal(records[0].workplaceType,"hybrid");
  assert.equal(records[0].url,"https://jobs.lever.co/acceldata/abc");
  assert.equal(records[0].publishedAt,null); // Creation does not establish publish time
});

test("Ashby honors isListed and refuses unrelated or non-HTTPS job URLs",()=>{
  const records=normalizeAtsResponse(ash,{jobs:[
    {title:"Engineer",jobUrl:"https://jobs.ashbyhq.com/Astronomer/a1",
      isListed:true,location:"Remote - India",workplaceType:"Remote",
      employmentType:"FullTime",publishedAt:"2026-10-12T00:00:00Z"},
    {title:"Unlisted",jobUrl:"https://jobs.ashbyhq.com/Astronomer/a2",isListed:false},
    {title:"Bad link",jobUrl:"https://bad.example/apply",isListed:true},
    {title:"Bad protocol",jobUrl:"javascript:alert(1)",isListed:true}
  ]});
  assert.equal(records.length,1);
  assert.equal(records[0].publishedAt,"2026-10-12T00:00:00.000Z");
  assert.equal(records[0].employmentType,"FullTime");
});

test("missing/invalid feed cannot masquerade as an empty successful sync",async()=>{
  const fetcher=async()=>new Response(JSON.stringify({jobs:[]}),{headers:{"content-type":"application/json"}});
  await assert.rejects(fetchBoard(gh,fetcher),/EMPTY_OR_UNPARSABLE_FEED/);
  await assert.rejects(fetchBoard(gh,async()=>new Response("<html>oops</html>",{headers:{"content-type":"text/html"}})),/FEED_NOT_JSON/);
  await assert.rejects(fetchBoard(gh,async()=>new Response("{}",{headers:{"content-type":"application/json"}})),/ATS_RESPONSE_INVALID/);
});

test("Lever pagination checks completeness and never closes jobs on truncation",async()=>{
  const one=Array.from({length:100},(_,i)=>({
    id:"id"+i,text:"Software Engineer",categories:{location:"India"},
    hostedUrl:"https://jobs.lever.co/acceldata/id"+i
  }));
  const seen=[];
  const fetcher=async url=>{
    seen.push(url);
    const n=new URL(url).searchParams.get("skip");
    return new Response(JSON.stringify(n==="0"?one:[]),{headers:{"content-type":"application/json"}});
  };
  const out=await fetchBoard(lev,fetcher);
  assert.equal(out.jobs.length,100);
  assert.deepEqual(seen.map(x=>new URL(x).searchParams.get("skip")),["0","100"]);
  await assert.rejects(fetchBoard(lev,async()=>new Response(JSON.stringify(one),{
    headers:{"content-type":"application/json"}
  })),/LEVER_PAGINATION_TRUNCATED/);
});

test("employer ranking highlights real overlap, preserves local India locations and timestamp type",()=>{
  const now="2026-10-14T00:00:00Z";
  const rows=[{
    provider:"greenhouse",board:"redwoodsoftware",external_id:"1234",
    title:"Software Engineer",company:"Redwood Software",location:"Hyderabad, Telangana",
    workplace_type:"Hybrid",employment_type:"Full Time",
    description:"Build Python and SQL backend APIs",posting_url:"https://job-boards.greenhouse.io/redwoodsoftware/jobs/1234",
    published_at:null,first_seen_at:now,last_seen_at:now
  }];
  const jobs=recommendEmployerJobs({rows,role:"Software Engineer",
    recordedSkills:["Python"],region:"india",hideSenior:true});
  assert.equal(jobs.length,1);
  assert.equal(jobs[0].source,"Greenhouse");
  assert.equal(jobs[0].dateKind,"FIRST_SEEN");
  assert.ok(jobs[0].signals.knownSkills.includes("python"));
  assert.ok(jobs[0].signals.exploreNext.includes("sql"));
  assert.equal(recommendEmployerJobs({rows,role:"Data Scientist",
    recordedSkills:[],region:"india",hideSenior:true}).length,0);
  assert.equal(recommendEmployerJobs({rows:[{...rows[0],posting_url:"https://attacker.example/steal"}],
    role:"Software Engineer",recordedSkills:[],region:"all",hideSenior:false}).length,0);
});

test("collector access is secret-only, not learner-triggered, and persisted records use RLS",()=>{
  const route=read("app/api/internal/jobs/collect/route.ts");
  const refresh=read("lib/jobs/persist-board.ts");
  const schema=read("supabase/migrations/0031_ats_job_collector.sql");
  const api=read("app/api/jobs/recommendations/route.ts");
  assert.match(route,/timingSafeEqual/);
  assert.match(route,/JOB_COLLECTOR_SECRET/);
  assert.match(route,/if\(!authorized\(request\)\)/);
  assert.match(route,/recordBoardFailure/);
  assert.match(refresh,/on conflict\(provider,board,external_id\)/);
  assert.match(refresh,/missing_scans\+1 < 2/);
  assert.match(refresh,/REFUSE_EMPTY_BOARD_COMMIT/);
  assert.match(schema,/enable row level security/);
  assert.match(schema,/revoke all on table public\.ats_job_postings from anon, authenticated/);
  assert.match(schema,/grant select on table public\.ats_job_postings to authenticated/);
  assert.match(api,/recommendEmployerJobs/);
  assert.match(api,/jobs\.ats_catalog\.unavailable/);
  assert.match(api,/rankLiveJobs/);
});
