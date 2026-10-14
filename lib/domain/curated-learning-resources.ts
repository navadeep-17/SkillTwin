/**
 * Small, manually checked, source-controlled learning catalog.
 *
 * These are supplemental, READ-ONLY links attached to existing roadmap tasks.
 * They are not evidence, assessments, persisted assignments, or claims of
 * completion. URLs must never be generated from learner input or by an LLM.
 * Verified on 2026-10-14; periodically recheck and retire broken links.
 */
import { EDITOR_REVIEWED_VIDEOS, reviewedVideoUrl } from "./editor-reviewed-videos.js";

export type LearningTaskType = "LEARN" | "PRACTICE" | "BUILD" | "VALIDATE";
export type LearnerLevel = "BASIC" | "STANDARD" | "ADVANCED";
export type LearningFormat = "DOCS" | "INTERACTIVE" | "ARTICLE" | "VIDEO";

interface CuratedResource {
  id: string;
  skillSlug: string;
  title: string;
  provider: string;
  url: string;
  format: LearningFormat;
  levels: LearnerLevel[];
  modes: Array<Exclude<LearningTaskType, "VALIDATE">>;
  studyBlockMinutes: number;
  /** Editorial heuristic, not a learner score, between 0 and 1. */
  quality: number;
  official: boolean;
}

export interface RecommendedLearningResource {
  id: string;
  title: string;
  provider: string;
  url: string;
  format: LearningFormat;
  suggested_minutes: number;
  reason: string;
  /** Only supplied for editorially reviewed video segments. */
  video_focus?: string;
  video_start_seconds?: number;
  reviewed_on?: string;
}

/** Deliberately bounded catalog: exact canonical skill slug, not text search. */
export const CURATED_LEARNING_RESOURCES: readonly CuratedResource[] = [
  {id:"python-tutorial",skillSlug:"python",title:"The Python Tutorial",provider:"Python Docs",url:"https://docs.python.org/3/tutorial/",format:"DOCS",levels:["BASIC","STANDARD"],modes:["LEARN","BUILD"],studyBlockMinutes:40,quality:.98,official:true},
  {id:"python-controlflow",skillSlug:"python",title:"Python control flow and functions",provider:"Python Docs",url:"https://docs.python.org/3/tutorial/controlflow.html",format:"DOCS",levels:["BASIC","STANDARD"],modes:["PRACTICE","LEARN"],studyBlockMinutes:35,quality:.97,official:true},
  {id:"java-learn",skillSlug:"java",title:"Learn Java",provider:"Dev.java",url:"https://dev.java/learn/",format:"DOCS",levels:["BASIC","STANDARD"],modes:["LEARN","BUILD"],studyBlockMinutes:45,quality:.98,official:true},
  {id:"node-intro",skillSlug:"nodejs",title:"Introduction to Node.js",provider:"Node.js",url:"https://nodejs.org/learn/getting-started/introduction-to-nodejs",format:"DOCS",levels:["BASIC","STANDARD"],modes:["LEARN","BUILD"],studyBlockMinutes:30,quality:.98,official:true},
  {id:"sql-postgres",skillSlug:"sql",title:"The SQL Language",provider:"PostgreSQL Docs",url:"https://www.postgresql.org/docs/current/tutorial-sql.html",format:"DOCS",levels:["BASIC","STANDARD"],modes:["LEARN","BUILD"],studyBlockMinutes:40,quality:.98,official:true},
  {id:"sqlbolt-select",skillSlug:"sql",title:"SQLBolt: SELECT exercises",provider:"SQLBolt",url:"https://sqlbolt.com/lesson/select_queries_introduction",format:"INTERACTIVE",levels:["BASIC"],modes:["PRACTICE"],studyBlockMinutes:25,quality:.93,official:false},
  {id:"sqlbolt-joins",skillSlug:"sql",title:"SQLBolt: SQL JOIN exercises",provider:"SQLBolt",url:"https://sqlbolt.com/lesson/select_queries_with_joins",format:"INTERACTIVE",levels:["STANDARD"],modes:["PRACTICE"],studyBlockMinutes:30,quality:.93,official:false},
  {id:"git-book",skillSlug:"git",title:"Pro Git: recording changes",provider:"Git SCM",url:"https://git-scm.com/book/en/v2/Git-Basics-Recording-Changes-to-the-Repository",format:"DOCS",levels:["BASIC","STANDARD"],modes:["LEARN","PRACTICE","BUILD"],studyBlockMinutes:35,quality:.97,official:true},
  {id:"http-methods",skillSlug:"http",title:"HTTP request methods",provider:"MDN Web Docs",url:"https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Methods",format:"DOCS",levels:["BASIC","STANDARD"],modes:["LEARN","PRACTICE"],studyBlockMinutes:30,quality:.98,official:true},
  {id:"http-status",skillSlug:"http",title:"HTTP response status codes",provider:"MDN Web Docs",url:"https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status",format:"DOCS",levels:["BASIC","STANDARD"],modes:["LEARN","PRACTICE"],studyBlockMinutes:25,quality:.98,official:true},
  {id:"rest-mdn",skillSlug:"rest-api",title:"REST: resource-oriented APIs",provider:"MDN Web Docs",url:"https://developer.mozilla.org/en-US/docs/Glossary/REST",format:"DOCS",levels:["BASIC","STANDARD"],modes:["LEARN","BUILD"],studyBlockMinutes:25,quality:.96,official:true},
  {id:"auth-owasp",skillSlug:"authentication",title:"Authentication Cheat Sheet",provider:"OWASP",url:"https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html",format:"DOCS",levels:["STANDARD","ADVANCED"],modes:["LEARN","BUILD","PRACTICE"],studyBlockMinutes:40,quality:.98,official:true},
  {id:"docker-start",skillSlug:"docker",title:"Get started with Docker",provider:"Docker Docs",url:"https://docs.docker.com/get-started/",format:"DOCS",levels:["BASIC","STANDARD"],modes:["LEARN"],studyBlockMinutes:40,quality:.98,official:true},
  {id:"docker-workshop",skillSlug:"docker",title:"Docker hands-on workshop",provider:"Docker Docs",url:"https://docs.docker.com/get-started/workshop/",format:"DOCS",levels:["BASIC","STANDARD"],modes:["PRACTICE","BUILD"],studyBlockMinutes:55,quality:.98,official:true},
  {id:"linux-ubuntu",skillSlug:"linux",title:"Linux command line for beginners",provider:"Ubuntu",url:"https://ubuntu.com/tutorials/command-line-for-beginners",format:"DOCS",levels:["BASIC","STANDARD"],modes:["LEARN","PRACTICE"],studyBlockMinutes:40,quality:.98,official:true},
  {id:"pytest-start",skillSlug:"testing",title:"Write your first automated test",provider:"pytest",url:"https://docs.pytest.org/en/stable/getting-started.html",format:"DOCS",levels:["BASIC","STANDARD"],modes:["LEARN","PRACTICE","BUILD"],studyBlockMinutes:35,quality:.98,official:true},
  {id:"system-design-roadmap",skillSlug:"system-design",title:"System design learning map",provider:"roadmap.sh",url:"https://roadmap.sh/system-design",format:"ARTICLE",levels:["BASIC","STANDARD","ADVANCED"],modes:["LEARN","PRACTICE"],studyBlockMinutes:40,quality:.9,official:false},
  {id:"well-architected",skillSlug:"system-design",title:"AWS Well-Architected Framework",provider:"AWS Docs",url:"https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html",format:"DOCS",levels:["STANDARD","ADVANCED"],modes:["LEARN","BUILD"],studyBlockMinutes:45,quality:.98,official:true},
  {id:"cloud-aws-framework",skillSlug:"cloud",title:"AWS Well-Architected Framework",provider:"AWS Docs",url:"https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html",format:"DOCS",levels:["STANDARD","ADVANCED"],modes:["LEARN","BUILD"],studyBlockMinutes:45,quality:.98,official:true}
];

const trustedHosts = new Set([
  "docs.python.org","dev.java","nodejs.org","www.postgresql.org",
  "sqlbolt.com","git-scm.com","developer.mozilla.org",
  "cheatsheetseries.owasp.org","docs.docker.com","ubuntu.com",
  "docs.pytest.org","roadmap.sh","docs.aws.amazon.com"
]);

function safelyCurated(resource: CuratedResource): boolean {
  try {
    const u = new URL(resource.url);
    return u.protocol === "https:" && !u.username && !u.password && trustedHosts.has(u.hostname);
  } catch { return false; }
}

export function recommendCuratedResources(input: {
  skillSlug: string;
  taskType: LearningTaskType;
  difficulty: LearnerLevel;
  durationMinutes: number;
}): RecommendedLearningResource[] {
  if (input.taskType === "VALIDATE") return [];
  const candidates = CURATED_LEARNING_RESOURCES.filter(r =>
    r.skillSlug === input.skillSlug && r.levels.includes(input.difficulty) && safelyCurated(r)
  );
  const ranked = candidates.map(resource => {
    const modeFit = resource.modes.includes(input.taskType as Exclude<LearningTaskType,"VALIDATE">) ? 1 : .1;
    const durationFit = Math.max(0, 1 - Math.abs(resource.studyBlockMinutes - input.durationMinutes) / Math.max(input.durationMinutes, 1));
    const score = .35 + .20 + .15*resource.quality + .10*durationFit + .10*modeFit + .10*(resource.official ? 1 : .75);
    return {resource, modeFit, score};
  }).filter(item => item.modeFit === 1)
    .sort((a,b)=>b.score-a.score || b.resource.quality-a.resource.quality || a.resource.id.localeCompare(b.resource.id));

  const readingAndPractice = ranked.slice(0,2).map(({resource}) => ({
    id:resource.id,
    title:resource.title,
    provider:resource.provider,
    url:resource.url,
    format:resource.format,
    suggested_minutes:Math.min(resource.studyBlockMinutes,Math.max(10,input.durationMinutes)),
    reason:input.difficulty === "BASIC"
      ? "Introductory material for this skill gap; use it in your planned "+input.taskType.toLowerCase()+" session."
      : "Matches your "+input.difficulty.toLowerCase()+" "+input.taskType.toLowerCase()+" task without restarting from the basics."
  }));

  // One relevant, publisher-hosted video segment per learning/practice task.
  // Do not displace a reference or interactive exercise; never suggest video
  // for BUILD/VALIDATE activities, where doing and demonstrating matter most.
  if(input.taskType!=="LEARN" && input.taskType!=="PRACTICE")return readingAndPractice;
  const matched=EDITOR_REVIEWED_VIDEOS.filter(v=>
    v.skillSlug===input.skillSlug && v.levels.includes(input.difficulty)
      && v.modes.includes(input.taskType as "LEARN"|"PRACTICE")
      && reviewedVideoUrl(v)!==null
  ).sort((a,b)=>b.quality-a.quality || a.id.localeCompare(b.id));
  const video=matched[0];
  if(!video)return readingAndPractice;
  const url=reviewedVideoUrl(video);
  if(!url)return readingAndPractice;
  return [...readingAndPractice,{
    id:video.id,title:video.title,provider:video.creator,url,
    format:"VIDEO" as const,
    suggested_minutes:Math.min(video.studyBlockMinutes,Math.max(10,input.durationMinutes)),
    reason:"Watch the focused "+video.focus+" segment of this creator-hosted video. This is a suggested study block, not the full course runtime.",
    video_focus:video.focus,video_start_seconds:video.startSeconds,
    reviewed_on:video.reviewedOn
  }];
}
