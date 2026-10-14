/**
 * A small hand-reviewed list of creator-hosted, freely viewable videos.
 * Topic timestamps are taken from published creator chapters or the
 * existing reviewed LearnLens lesson. Links are NOT AI-generated.
 *
 * This source list is editorial, not a metric of learner proficiency.
 * Recheck availability, title, teaching relevance and timestamps periodically.
 */
import type {LearnerLevel, LearningTaskType} from "./curated-learning-resources.js";

export interface ReviewedSkillVideo {
  id:string;
  skillSlug:string;
  title:string;
  creator:string;
  videoId:string;
  /** Topic-specific entry point into the external video. */
  startSeconds:number;
  focus:string;
  levels:LearnerLevel[];
  modes:Array<Extract<LearningTaskType,"LEARN"|"PRACTICE">>;
  /** Study-block recommendation, NOT a claim about total video runtime. */
  studyBlockMinutes:number;
  quality:number;
  reviewedOn:string;
  /** Documentation link explaining video subject; not a video transcript. */
  referenceUrl:string;
}

/**
 * Skill slug and level must match exactly. For multi-hour courses, each link
 * starts at a specific segment, so learners need not watch the entire course.
 */
export const EDITOR_REVIEWED_VIDEOS: readonly ReviewedSkillVideo[] = [
  {id:"video-sql-joins-basic",skillSlug:"sql",title:"SQL JOINs Tutorial – Part 1",creator:"techTFQ",videoId:"0OQJDd3QqQM",startSeconds:156,focus:"JOIN purpose and INNER JOIN",levels:["BASIC"],modes:["LEARN","PRACTICE"],studyBlockMinutes:25,quality:.96,reviewedOn:"2026-10-14",referenceUrl:"https://www.postgresql.org/docs/current/tutorial-join.html"},
  {id:"video-sql-joins-applied",skillSlug:"sql",title:"SQL JOINs Tutorial – Part 1",creator:"techTFQ",videoId:"0OQJDd3QqQM",startSeconds:835,focus:"LEFT JOIN and missing matches",levels:["STANDARD"],modes:["LEARN","PRACTICE"],studyBlockMinutes:25,quality:.96,reviewedOn:"2026-10-14",referenceUrl:"https://www.postgresql.org/docs/current/tutorial-join.html"},
  {id:"video-python-variables",skillSlug:"python",title:"Python Full Course for Beginners",creator:"Programming with Mosh",videoId:"K5KVEU3aaeQ",startSeconds:1904,focus:"Variables and data types",levels:["BASIC"],modes:["LEARN","PRACTICE"],studyBlockMinutes:30,quality:.96,reviewedOn:"2026-10-14",referenceUrl:"https://docs.python.org/3/tutorial/"},
  {id:"video-python-functions",skillSlug:"python",title:"Python Full Course for Beginners",creator:"Programming with Mosh",videoId:"K5KVEU3aaeQ",startSeconds:6313,focus:"Defining and using functions",levels:["STANDARD"],modes:["LEARN","PRACTICE"],studyBlockMinutes:25,quality:.96,reviewedOn:"2026-10-14",referenceUrl:"https://docs.python.org/3/tutorial/controlflow.html"},
  {id:"video-git-commits",skillSlug:"git",title:"Git & GitHub Crash Course",creator:"Traversy Media",videoId:"vA5TTz6BXhY",startSeconds:990,focus:"Staging and making commits",levels:["BASIC"],modes:["LEARN","PRACTICE"],studyBlockMinutes:20,quality:.95,reviewedOn:"2026-10-14",referenceUrl:"https://git-scm.com/book/en/v2/Git-Basics-Recording-Changes-to-the-Repository"},
  {id:"video-git-branches",skillSlug:"git",title:"Git & GitHub Crash Course",creator:"Traversy Media",videoId:"vA5TTz6BXhY",startSeconds:2340,focus:"Branches and collaboration",levels:["STANDARD"],modes:["LEARN","PRACTICE"],studyBlockMinutes:25,quality:.95,reviewedOn:"2026-10-14",referenceUrl:"https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell"},
  {id:"video-docker-images",skillSlug:"docker",title:"Docker Tutorial for Beginners",creator:"mCoding",videoId:"b0HMimUb4f0",startSeconds:437,focus:"Images versus containers",levels:["BASIC"],modes:["LEARN","PRACTICE"],studyBlockMinutes:25,quality:.95,reviewedOn:"2026-10-14",referenceUrl:"https://docs.docker.com/get-started/"},
  {id:"video-docker-compose",skillSlug:"docker",title:"Docker Tutorial for Beginners",creator:"mCoding",videoId:"b0HMimUb4f0",startSeconds:2199,focus:"Running services with Docker Compose",levels:["STANDARD"],modes:["LEARN","PRACTICE"],studyBlockMinutes:25,quality:.95,reviewedOn:"2026-10-14",referenceUrl:"https://docs.docker.com/get-started/workshop/"},
  {id:"video-java-hello-world",skillSlug:"java",title:"Start coding with Java in 10 minutes",creator:"Bro Code",videoId:"23HFxAPyJ9U",startSeconds:0,focus:"JDK setup and first Java program",levels:["BASIC"],modes:["LEARN"],studyBlockMinutes:10,quality:.93,reviewedOn:"2026-10-14",referenceUrl:"https://dev.java/learn/"},
  {id:"video-javascript-basics",skillSlug:"javascript",title:"JavaScript Full Course",creator:"Bro Code",videoId:"lfmg-EJ8gm4",startSeconds:752,focus:"Variables and expressions",levels:["BASIC"],modes:["LEARN","PRACTICE"],studyBlockMinutes:25,quality:.95,reviewedOn:"2026-10-14",referenceUrl:"https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide"},
  {id:"video-javascript-functions",skillSlug:"javascript",title:"JavaScript Full Course",creator:"Bro Code",videoId:"lfmg-EJ8gm4",startSeconds:10171,focus:"Functions and return values",levels:["STANDARD"],modes:["LEARN","PRACTICE"],studyBlockMinutes:25,quality:.95,reviewedOn:"2026-10-14",referenceUrl:"https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Functions"},
  {id:"video-nodejs-setup",skillSlug:"nodejs",title:"Node.js Crash Course",creator:"Traversy Media",videoId:"32M1al-Y6Ag",startSeconds:919,focus:"Node.js project setup and modules",levels:["BASIC"],modes:["LEARN"],studyBlockMinutes:30,quality:.96,reviewedOn:"2026-10-14",referenceUrl:"https://nodejs.org/learn/getting-started/introduction-to-nodejs"},
  {id:"video-nodejs-http",skillSlug:"nodejs",title:"Node.js Crash Course",creator:"Traversy Media",videoId:"32M1al-Y6Ag",startSeconds:1640,focus:"HTTP module and server",levels:["STANDARD"],modes:["LEARN","PRACTICE"],studyBlockMinutes:30,quality:.96,reviewedOn:"2026-10-14",referenceUrl:"https://nodejs.org/api/http.html"},
  {id:"video-linux-navigation",skillSlug:"linux",title:"Linux Command Line for Beginners",creator:"Keep On Coding",videoId:"16d2lHc0Pe8",startSeconds:187,focus:"Navigating files and directories",levels:["BASIC"],modes:["LEARN","PRACTICE"],studyBlockMinutes:20,quality:.94,reviewedOn:"2026-10-14",referenceUrl:"https://ubuntu.com/tutorials/command-line-for-beginners"},
  {id:"video-linux-pipes",skillSlug:"linux",title:"Linux Command Line for Beginners",creator:"Keep On Coding",videoId:"16d2lHc0Pe8",startSeconds:2712,focus:"Pipelines and text filtering",levels:["STANDARD"],modes:["LEARN","PRACTICE"],studyBlockMinutes:20,quality:.94,reviewedOn:"2026-10-14",referenceUrl:"https://ubuntu.com/tutorials/command-line-for-beginners"},
  {id:"video-system-design-framework",skillSlug:"system-design",title:"System Design Interview: A Step-By-Step Guide",creator:"ByteByteGo",videoId:"i7twT3x5yv8",startSeconds:0,focus:"Structured approach to a system-design problem",levels:["STANDARD"],modes:["LEARN"],studyBlockMinutes:25,quality:.95,reviewedOn:"2026-10-14",referenceUrl:"https://roadmap.sh/system-design"}
];

/**
 * Conservative topic guard: a narrowly focused roadmap task should not be
 * pointed to a different chapter merely because the skill slug matches.
 * A generic task title (without a recognized specialty) can use the reviewed
 * level-specific introduction.
 */
const focusedKeywords: Readonly<Record<string,readonly string[]>>={
  "video-sql-joins-basic":["join","joins"],
  "video-sql-joins-applied":["join","joins"],
  "video-python-variables":["variable","variables","loop","loops"],
  "video-python-functions":["function","functions","method","methods"],
  "video-git-commits":["commit","commits","staging","stage"],
  "video-git-branches":["branch","branches","merge","merging"],
  "video-docker-images":["image","images","container","containers"],
  "video-docker-compose":["compose"],
  "video-java-hello-world":["setup","jdk","hello","program"],
  "video-javascript-basics":["variable","variables","expression","expressions"],
  "video-javascript-functions":["function","functions"],
  "video-nodejs-setup":["module","modules","setup","package","packages"],
  "video-nodejs-http":["http","server","api","apis"],
  "video-linux-navigation":["file","files","directory","directories","navigation"],
  "video-linux-pipes":["pipeline","pipelines","pipe","pipes","grep","filter","filtering"],
  "video-system-design-framework":["interview","framework","design"]
};
const specialtyWords=new Set([
  ...Object.values(focusedKeywords).flat(),
  "index","indexes","indexing","transaction","transactions","normalization",
  "arrays","array","promises","promise","async","authentication","security",
  "deploy","deployment","dockerfile","testing","tests","database","databases",
  "react","closures","inheritance","generics"
]);

export function videoFitsTaskTitle(video:ReviewedSkillVideo,taskTitle:string):boolean{
  const tokens=taskTitle.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  const specialty=tokens.filter(t=>specialtyWords.has(t));
  if(!specialty.length)return true;
  const allowed=new Set(focusedKeywords[video.id]??[]);
  return specialty.some(t=>allowed.has(t));
}

const idPattern=/^[A-Za-z0-9_-]{11}$/;
export function reviewedVideoUrl(video:ReviewedSkillVideo):string|null {
  if(!idPattern.test(video.videoId)||!Number.isSafeInteger(video.startSeconds)||video.startSeconds<0)return null;
  if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(video.reviewedOn)||video.quality<.9||video.quality>1)return null;
  const url=new URL("https://www.youtube.com/watch");
  url.searchParams.set("v",video.videoId);
  if(video.startSeconds)url.searchParams.set("t",String(video.startSeconds)+"s");
  return url.toString();
}
