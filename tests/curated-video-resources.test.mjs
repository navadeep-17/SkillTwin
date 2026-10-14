import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {EDITOR_REVIEWED_VIDEOS,reviewedVideoUrl,videoFitsTaskTitle} from "../lib/domain/editor-reviewed-videos.ts";
import {recommendCuratedResources} from "../lib/domain/curated-learning-resources.ts";

const picks=(skillSlug,taskType="LEARN",difficulty="BASIC",durationMinutes=35,taskTitle="")=>
  recommendCuratedResources({skillSlug,taskType,difficulty,durationMinutes,taskTitle});

test("editor reviewed video catalog uses real, exact, restricted creator-hosted video URLs",()=>{
  assert.equal(EDITOR_REVIEWED_VIDEOS.length,16);
  assert.equal(new Set(EDITOR_REVIEWED_VIDEOS.map(v=>v.id)).size,16);
  assert.equal(new Set(EDITOR_REVIEWED_VIDEOS.map(v=>v.id+v.videoId)).size,16);
  assert.equal(new Set(EDITOR_REVIEWED_VIDEOS.map(v=>v.skillSlug)).size,9);
  for(const video of EDITOR_REVIEWED_VIDEOS){
    const url=reviewedVideoUrl(video);
    assert.ok(url,video.id);
    const parsed=new URL(url);
    assert.equal(parsed.protocol,"https:");
    assert.equal(parsed.hostname,"www.youtube.com");
    assert.equal(parsed.pathname,"/watch");
    assert.equal(parsed.searchParams.get("v"),video.videoId);
    assert.ok(video.studyBlockMinutes>=10 && video.studyBlockMinutes<=40);
    assert.ok(video.quality>=.9 && video.quality<=1);
    assert.ok(video.levels.length>0 && video.modes.length>0);
    assert.equal(new URL(video.referenceUrl).protocol,"https:");
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(video.reviewedOn));
  }
  assert.equal(reviewedVideoUrl({...EDITOR_REVIEWED_VIDEOS[0],videoId:"wrong"}),null);
  assert.equal(reviewedVideoUrl({...EDITOR_REVIEWED_VIDEOS[0],startSeconds:-4}),null);
});

test("roadmap returns video PLUS learning references; no external link updates evidence",()=>{
  const chosen=picks("sql","LEARN","BASIC",45,"Learn SQL JOINs");
  assert.equal(chosen[0].id,"sql-postgres");
  assert.ok(chosen.some(r=>r.id==="video-sql-joins-basic"&&r.format==="VIDEO"));
  assert.ok(chosen.length>=2&&chosen.length<=3);
  const video=chosen.find(r=>r.format==="VIDEO");
  assert.equal(video.video_focus,"JOIN purpose and INNER JOIN");
  assert.equal(video.video_start_seconds,156);
  assert.ok(video.url.includes("t=156s"));
  assert.ok(video.reason.includes("not the full course runtime"));
  assert.ok(video.suggested_minutes<=45);
  assert.equal(video.reviewed_on,"2026-10-14");
});

test("levels and modes route to relevant chapter and avoid inappropriate tasks",()=>{
  const applied=picks("sql","PRACTICE","STANDARD",30,"Practice LEFT JOIN");
  assert.equal(applied[0].id,"sqlbolt-joins");
  assert.equal(applied.find(r=>r.format==="VIDEO")?.video_start_seconds,835);
  assert.ok(picks("javascript","LEARN","STANDARD",35,"JavaScript functions")
    .some(r=>r.id==="video-javascript-functions"));
  assert.ok(picks("nodejs","PRACTICE","STANDARD",40,"Create an HTTP server")
    .some(r=>r.id==="video-nodejs-http"));
  assert.ok(picks("java","LEARN","BASIC",15,"Your first Java program")
    .some(r=>r.id==="video-java-hello-world"));
  assert.equal(picks("java","LEARN","STANDARD",40).some(r=>r.format==="VIDEO"),false);
  assert.ok(picks("system-design","LEARN","STANDARD",30).some(r=>r.format==="VIDEO"));
  assert.equal(picks("system-design","LEARN","ADVANCED",45).some(r=>r.format==="VIDEO"),false);
  for(const skill of ["sql","python","git","docker","javascript","linux"]){
    assert.equal(picks(skill,"BUILD","BASIC").some(r=>r.format==="VIDEO"),false);
    assert.deepEqual(picks(skill,"VALIDATE","BASIC"),[]);
  }
});

test("focused specialty tasks reject unrelated video chapters but preserve docs and practice",()=>{
  assert.equal(picks("sql","LEARN","BASIC",30,"Create database indexes")
    .some(r=>r.format==="VIDEO"),false);
  assert.equal(picks("python","LEARN","BASIC",30,"Build functions with Python")
    .some(r=>r.format==="VIDEO"),false);
  assert.equal(picks("docker","LEARN","STANDARD",45,"Write a Dockerfile")
    .some(r=>r.format==="VIDEO"),false);
  assert.equal(picks("javascript","LEARN","STANDARD",30,"Async promises")
    .some(r=>r.format==="VIDEO"),false);
  const basics=picks("linux","LEARN","BASIC",30,"Navigate files");
  assert.ok(basics.some(r=>r.format==="VIDEO"));
  assert.ok(picks("git","LEARN","STANDARD",30,"Create a feature branch").some(r=>r.format==="VIDEO"));
  assert.deepEqual(picks("invented skill","LEARN","BASIC"),[]);
  assert.equal(videoFitsTaskTitle(EDITOR_REVIEWED_VIDEOS[0],"INDEXING"),false);
});

test("topic links are deterministic, bounded and imply study blocks not entire video duration",()=>{
  const baseline=picks("javascript","LEARN","BASIC",20,"Learn JavaScript basics");
  assert.deepEqual(baseline,picks("javascript","LEARN","BASIC",20,"Learn JavaScript basics"));
  assert.ok(baseline.length<=3);
  const video=baseline.find(r=>r.format==="VIDEO");
  assert.equal(video.suggested_minutes,20);
  assert.ok(video.reason.includes("suggested study block"));
  assert.equal(video.video_start_seconds,752);
});

test("roadmap API and UI integrate read-only video supplements, metadata and safe external links",()=>{
  const api=readFileSync(new URL("../app/api/roadmap/route.ts",import.meta.url),"utf8");
  const ui=readFileSync(new URL("../components/roadmap/roadmap-view.tsx",import.meta.url),"utf8");
  assert.match(api,/taskTitle: String\(task\.title/);
  assert.match(api,/recommendCuratedResources/);
  assert.match(ui,/item\.format === "VIDEO"/);
  assert.match(ui,/Watch/);
  assert.match(ui,/Practice/);
  assert.match(ui,/Read/);
  assert.match(ui,/noopener noreferrer/);
  assert.match(ui,/Opening a resource doesn't mark this task complete/);
  assert.doesNotMatch(ui,/dangerouslySetInnerHTML/);
});
