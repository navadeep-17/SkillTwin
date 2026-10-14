/**
 * Heuristic relevance for third-party vacancy notices.
 * This is NOT a hiring-eligibility or validated proficiency prediction.
 * Never infer a requirement from absence of a job-description keyword.
 */
export type JobRegion = "all" | "anywhere" | "apac" | "india";
export type JobOpportunity = {
  id: string; source: "Jobicy"; title: string; company: string;
  url: string; region: string; level: string | null; employmentType: string | null;
  publishedAt: string; excerpt: string;
  signals: { role: string; knownSkills: string[]; exploreNext: string[]; seniorRole: boolean };
};

export type JobicyRecord = {
  id?: string | number; url?: string; jobTitle?: string; companyName?: string;
  jobGeo?: string; jobLevel?: string; jobExcerpt?: string; jobDescription?: string;
  jobType?: string[] | string; pubDate?: string;
};

export function plain(value: unknown, max = 280): string {
  if (typeof value !== "string") return "";
  return value.replace(/<[^>]*>/g, " ").replace(/&amp;/gi,"&").replace(/&nbsp;/gi," ")\n    .replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/&quot;/gi,'"').replace(/&#39;/gi,"\'")
    .replace(/\s+/g, " ").trim().slice(0,max);
}
const normalized = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const tokens = (x:string) => normalized(x).split(" ").filter(x=>x.length>=3 && !["and","for","the","with","remote","junior","senior","entry","level","intern","role","associate","graduate"].includes(x));
const safeUrl = (raw: unknown): string | null => {
  if(typeof raw!=="string")return null;
  try {
    const x=new URL(raw);
    return x.protocol==="https:" && !x.username && !x.password
      && (x.hostname==="jobicy.com" || x.hostname==="www.jobicy.com")
      && x.pathname.startsWith("/jobs/") ? x.toString() : null;
  }catch{return null;}
};
const skillKeywords = [
  "python","java","javascript","typescript","react","node.js","nodejs","sql",
  "postgresql","docker","kubernetes","aws","git","linux","go","golang",
  "testing","rest","graphql","machine learning","pytorch","tensorflow",
  "excel","power bi","tableau","spark","pandas","fastapi","flask","html","css"
] as const;
const alias = new Map<string,string[]>([
  ["software",["software","engineer","developer","programmer"]],
  ["backend",["backend","back end","api","server"]],
  ["frontend",["frontend","front end","react","web developer"]],
  ["fullstack",["fullstack","full stack","web developer"]],
  ["engineer",["engineer","engineering","developer"]],
  ["developer",["developer","engineer","programmer"]],
  ["analyst",["analyst","analytics","analysis"]],
  ["data",["data","analytics","analyst"]],
  ["machine",["machine","ml","ai"]],
  ["learning",["learning","ml","ai"]],
  ["devops",["devops","cloud","platform","sre"]],
  ["cloud",["cloud","devops","infrastructure"]],
  ["security",["security","cybersecurity","infosec"]],
  ["testing",["quality assurance","qa","test"]],
  ["designer",["designer","design","ux","ui"]],
  ["product",["product","pm"]],
  ["marketing",["marketing","growth"]],
  ["support",["support","customer success"]],
  ["teacher",["teacher","educator","tutor"]]
]);

function roleRelevance(title:string, role:string): {score:number;reason:string}|null {
  const sought=tokens(role).slice(0,6);
  if(!sought.length)return null;
  const titleText=" "+normalized(title)+" ";
  const scores=sought.map(word=>{
    const variants=alias.get(word)??[word];
    return variants.some(v=>titleText.includes(" "+normalized(v)+" "));
  });
  const hit=scores.filter(Boolean).length;
  // No generic search results masquerading as personalized recommendations.
  if(hit===0 || (sought.length>1 && hit<Math.min(2,sought.length)))return null;
  const reason=hit===sought.length
    ? "Role title aligns with your chosen career search"
    : "Related job title; review responsibilities before applying";
  return {score:hit/Math.max(1,sought.length),reason};
}

export function regionRelevant(jobGeo:string, region:JobRegion):boolean {
  if(region==="all")return true;
  const geo=normalized(jobGeo);
  const anywhere=["anywhere","worldwide","global","work from anywhere"].some(x=>geo.includes(x));
  if(region==="anywhere")return anywhere;
  if(region==="india")return anywhere || geo.includes("india");
  return anywhere || ["apac","asia","asia pacific","india"].some(x=>geo.includes(x));
}
export function seniorTitle(title:string,level:string):boolean {
  return /\b(senior|sr\.?|staff|principal|lead|director|vp|vice president|head of|chief|manager)\b/i.test(title+" "+level);
}
function includesSkill(text:string,skill:string):boolean {
  const subject=" "+normalized(text)+" ";
  if(skill==="go" || skill==="rest")return subject.includes(" "+skill+" ") && normalized(text).includes(skill);
  if(skill==="node.js" || skill==="nodejs")return subject.includes(" node js ") || subject.includes(" nodejs ");
  return subject.includes(" "+normalized(skill)+" ");
}

export function rankLiveJobs(input:{
  records:JobicyRecord[];role:string;recordedSkills:string[];
  region:JobRegion;hideSenior:boolean;now?:Date;limit?:number;
}):JobOpportunity[] {
  const now=input.now??new Date();
  const known=new Set(input.recordedSkills.map(normalized));
  const unique=new Set<string>();
  const candidates: Array<{job:JobOpportunity;rank:number}>=[];
  for(const raw of input.records.slice(0,250)){
    const url=safeUrl(raw.url);
    const title=plain(raw.jobTitle,140),company=plain(raw.companyName,90);
    const place=plain(raw.jobGeo,90)||"Location not specified";
    const level=plain(raw.jobLevel,60)||null;
    const published=typeof raw.pubDate==="string" ? new Date(raw.pubDate):new Date(NaN);
    if(!url||!title||!company||!Number.isFinite(published.getTime()))continue;
    const age=now.getTime()-published.getTime();
    if(age< -3600_000 || age>10*24*3600_000)continue;
    const dedupeKey=normalized(title)+"|"+normalized(company);
    if(unique.has(dedupeKey)||!regionRelevant(place,input.region))continue;
    const relevance=roleRelevance(title,input.role);
    if(!relevance)continue;
    const senior=seniorTitle(title,level??"");
    if(senior&&input.hideSenior)continue;
    const text=plain(raw.jobExcerpt??raw.jobDescription,2500);
    const skillMentions=skillKeywords.filter(skill=>includesSkill(title+" "+text,skill));
    const knownSkills=skillMentions.filter(skill=>known.has(normalized(skill))).slice(0,4);
    const exploreNext=skillMentions.filter(skill=>!known.has(normalized(skill))).slice(0,4);
    const employmentType=Array.isArray(raw.jobType)?plain(raw.jobType.join(", "),80):plain(raw.jobType,80);
    unique.add(dedupeKey);
    candidates.push({
      job:{
        id:"jobicy:"+String(raw.id??url).slice(0,120),source:"Jobicy",title,company,url,
        region:place,level,employmentType:employmentType||null,publishedAt:published.toISOString(),
        excerpt:plain(raw.jobExcerpt,230),
        signals:{role:relevance.reason,knownSkills,exploreNext,seniorRole:senior}
      },
      rank:Math.round(100*relevance.score)+knownSkills.length*4
        - (senior?20:0)-Math.floor(age/(24*3600_000))
    });
  }
  return candidates.sort((a,b)=>b.rank-a.rank||b.job.publishedAt.localeCompare(a.job.publishedAt))
    .slice(0,Math.max(1,Math.min(24,input.limit??12))).map(item=>item.job);
}
