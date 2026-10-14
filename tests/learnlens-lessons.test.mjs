import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getLearnLensLesson, videoEmbedUrl } from "../lib/domain/learnlens-lessons.ts";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("video lessons are scoped to the known SQL skill and non-assessment tasks", () => {
  assert.ok(getLearnLensLesson({skillSlug:"python",taskType:"LEARN",difficulty:"BASIC"}));
  assert.equal(getLearnLensLesson({skillSlug:"sql' OR 1=1",taskType:"PRACTICE",difficulty:"STANDARD"}), null);
  assert.equal(getLearnLensLesson({skillSlug:"sql",taskType:"BUILD",difficulty:"STANDARD"}), null);
  assert.equal(getLearnLensLesson({skillSlug:"sql",taskType:"VALIDATE",difficulty:"STANDARD"}), null);
  assert.equal(getLearnLensLesson({skillSlug:"sql",taskType:"LEARN",difficulty:"ADVANCED"}), null);
  assert.equal(getLearnLensLesson({skillSlug:"sql",taskType:"LEARN",difficulty:"NOVICE"}), null);
  const basic = getLearnLensLesson({skillSlug:"sql",taskType:"LEARN",difficulty:"BASIC"});
  const standard = getLearnLensLesson({skillSlug:"sql",taskType:"PRACTICE",difficulty:"STANDARD"});
  assert.ok(basic && standard);
  assert.notEqual(basic.id, standard.id);
  assert.equal(basic.level,"BASIC");
  assert.equal(standard.level,"STANDARD");
  assert.equal(standard.questions.length,3);
  assert.equal(basic.questions.length,3);
});

test("the published chapter timeline is stable and embed URLs only allow listed timestamps", () => {
  const lesson = getLearnLensLesson({skillSlug:"sql",taskType:"LEARN",difficulty:"BASIC"});
  assert.ok(lesson);
  assert.equal(lesson.video.id,"0OQJDd3QqQM");
  assert.equal(lesson.video.chaptersSource,"creator_description");
  assert.equal(lesson.video.transcriptAvailable,false);
  assert.deepEqual(lesson.video.chapters.map(c => c.seconds),[156,330,835,1199]);
  assert.match(videoEmbedUrl(lesson), /^https:\/\/www\.youtube-nocookie\.com\/embed\//);
  assert.ok(videoEmbedUrl(lesson,835).endsWith("start=835"));
  assert.throws(() => videoEmbedUrl(lesson,500), /UNVERIFIED_TIMESTAMP/);
  assert.throws(() => videoEmbedUrl({...lesson,video:{...lesson.video,id:"../../bad"}},0), /INVALID_VIDEO_ID/);
});

test("lesson notes clearly distinguish official documentation from video transcript", () => {
  for(const difficulty of ["BASIC","STANDARD"]){
    const lesson = getLearnLensLesson({skillSlug:"sql",taskType:"LEARN",difficulty});
    assert.ok(lesson);
    assert.equal(lesson.reference.publisher,"PostgreSQL Documentation");
    assert.equal(lesson.reference.url,"https://www.postgresql.org/docs/current/tutorial-join.html");
    assert.ok(lesson.studyNotes.length >= 3);
    assert.ok(lesson.questions.every(q => q.options.some(option=>option.id===q.correctId)));
    assert.ok(lesson.questions.every(q => q.explanation && q.prompt));
    assert.equal(new Set(lesson.questions.map(q=>q.id)).size,3);
    assert.ok(lesson.exercise.prompt && lesson.exercise.starter && lesson.exercise.sampleSolution);
  }
  const ui=read("components/roadmap/learnlens-lesson-panel.tsx");
  assert.match(ui,/full transcript has not been licensed or retrieved/i);
  assert.match(ui,/not a verbatim transcript/);
  assert.match(ui,/creator's published description/);
});

test("LearnLens does not claim skill evidence, record completion or fetch transcript", () => {
  const ui=read("components/roadmap/learnlens-lesson-panel.tsx");
  const model=read("lib/domain/learnlens-lessons.ts");
  assert.doesNotMatch(ui, /fetch\s*\(|postMessage\s*\(|localStorage\.setItem|sessionStorage\.setItem/);
  assert.doesNotMatch(model,/fetch\s*\(|youtube-transcript|\bcaptions\.download\b/);
  assert.match(ui,/does not complete your roadmap task/);
  assert.match(ui,/does not.*change your skill score/);
  assert.match(ui,/Load video/);
  assert.match(ui,/allowEmbed \?/);
  assert.match(ui,/allowFullScreen/);
  assert.match(ui,/Check my answers/);
  assert.match(ui,/Apply it to a real task/);
  assert.match(ui,/noopener noreferrer/);
});

test("only the already authenticated owner may view the task detail lesson", () => {
  const task=read("app/roadmap/task/[id]/page.tsx");
  const roadmap=read("components/roadmap/roadmap-view.tsx");
  assert.match(task,/supabase\.auth\.getUser\(\)/);
  assert.match(task,/if \(!auth\.user\) redirect\("\/login"\)/);
  assert.match(task,/\.eq\("learning_plans\.user_id", auth\.user\.id\)/);
  assert.match(task,/getLearnLensLesson/);
  assert.match(task,/<LearnLensLessonPanel/);
  assert.match(roadmap,/hasVideoLesson=\{Boolean\(getLearnLensLesson/);
  assert.match(roadmap,/#learnlens/);
});

test("skill-gap targeting provides six distinct grounded lessons, without claiming AI transcripts", async () => {
  const {EXTENDED_LEARNLENS_LESSONS}=await import("../lib/domain/learnlens-multiskill.ts");
  assert.equal(EXTENDED_LEARNLENS_LESSONS.length,6);
  assert.equal(new Set(EXTENDED_LEARNLENS_LESSONS.map(x=>x.id)).size,6);
  const reviewed={python:"K5KVEU3aaeQ",git:"vA5TTz6BXhY",docker:"b0HMimUb4f0"};
  for (const skill of ["python","git","docker"]){
    const beginner=getLearnLensLesson({skillSlug:skill,taskType:"LEARN",difficulty:"BASIC"});
    const intermediate=getLearnLensLesson({skillSlug:skill,taskType:"PRACTICE",difficulty:"STANDARD"});
    assert.ok(beginner && intermediate);
    assert.notEqual(beginner.id,intermediate.id);
    assert.equal(beginner.video.id,reviewed[skill]);
    assert.equal(beginner.video.chaptersSource,"creator_description");
    assert.equal(beginner.video.transcriptAvailable,false);
    assert.ok(new URL(beginner.reference.url).protocol==="https:");
    assert.ok(beginner.studyNotes.length>=3);
    assert.equal(beginner.questions.length,3);
    assert.equal(intermediate.questions.length,3);
    assert.ok(intermediate.video.chapters.every(c=>Number.isInteger(c.seconds) && c.seconds>0));
    assert.ok(beginner.exercise.sampleSolution.length>8);
    assert.deepEqual(getLearnLensLesson({skillSlug:skill,taskType:"VALIDATE",difficulty:"BASIC"}),null);
    assert.deepEqual(getLearnLensLesson({skillSlug:skill,taskType:"BUILD",difficulty:"BASIC"}),null);
    assert.deepEqual(getLearnLensLesson({skillSlug:skill,taskType:"LEARN",difficulty:"ADVANCED"}),null);
    assert.ok(videoEmbedUrl(intermediate,intermediate.video.chapters[0].seconds).includes("youtube-nocookie.com"));
  }
  assert.deepEqual(getLearnLensLesson({skillSlug:"docker;DROP",taskType:"LEARN",difficulty:"BASIC"}),null);
});
