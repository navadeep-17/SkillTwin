import {type JobOpportunity,type JobRegion,plain,seniorTitle} from "../domain/live-job-matching.js";

export type StoredEmployerJob={
  provider:string;board:string;external_id:string;
  title:string;company:string;location:string;
  workplace_type:string|null;employment_type:string|null;
  description:string;posting_url:string;
  published_at:Date|string|null;first_seen_at:Date|string;last_seen_at:Date|string;
};
const normalize=(x:string)=>x.toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const tokenize=(x:string)=>normalize(x).split(" ").filter(x=>x.length>2&&
  !["and","for","the","with","senior","junior","associate","entry","level"].includes(x));
const variants:Record<string,string[]>={
  software:["software","developer","engineer"],backend:["backend","back end","api"],
  frontend:["frontend","front end","react"],engineer:["engineer","developer"],
  developer:["developer","engineer"],data:["data","analytics"],analyst:["analyst","analytics"],
  devops:["devops","platform","infrastructure"],cloud:["cloud","platform"],
  security:["security","cybersecurity"],fullstack:["full stack","fullstack"]
};
const mentionedSkills=["python","java","javascript","typescript","react","node.js","sql","postgresql",
  "docker","kubernetes","aws","git","linux","golang","testing","graphql","pandas","spark",
  "flask","fastapi","machine learning","excel"];
const indianPlaces=["hyderabad","bengaluru","bangalore","pune","mumbai","chennai","gurugram","gurgaon",
  "noida","delhi","kolkata","kochi","india"];
function appliesToRegion(location:string,region:JobRegion):boolean{
  if(region==="all")return true;
  const geo=normalize(location);
  const anywhere=["worldwide","global","anywhere"].some(x=>geo.includes(x));
  if(region==="anywhere")return anywhere;
  const india=indianPlaces.some(city=>geo.includes(city));
  if(region==="india")return anywhere||india;
  return anywhere||india||["apac","asia pacific","singapore"].some(x=>geo.includes(x));
}
function safelyHosted(url:string,provider:string,board:string):boolean{
  try{
    const u=new URL(url);
    const allowed:Record<string,string[]>={
      greenhouse:["job-boards.greenhouse.io","boards.greenhouse.io"],
      lever:["jobs.lever.co","jobs.eu.lever.co"],ashby:["jobs.ashbyhq.com"]
    };
    return u.protocol==="https:"&&!u.username&&!u.password
      &&Boolean(allowed[provider]?.includes(u.hostname))
      &&u.pathname.startsWith("/"+board+"/");
  }catch{return false;}
}
const providerName=(name:string):JobOpportunity["source"]=>
  name==="greenhouse"?"Greenhouse":name==="lever"?"Lever":"Ashby";
const iso=(v:Date|string|null):string|null=>{
  if(!v)return null;
  const d=v instanceof Date?v:new Date(v);
  return Number.isFinite(d.getTime())?d.toISOString():null;
};

/** Confidence-limited relevance ranking. Never use this as a hiring fit score. */
export function recommendEmployerJobs(input:{
  rows:StoredEmployerJob[];role:string;recordedSkills:string[];
  region:JobRegion;hideSenior:boolean;limit?:number;
}):JobOpportunity[]{
  const words=tokenize(input.role).slice(0,6);
  if(!words.length)return [];
  const known=new Set(input.recordedSkills.map(normalize));
  const seen=new Set<string>();
  const ranked:Array<{job:JobOpportunity;rank:number}>=[];
  for(const row of input.rows.slice(0,600)){
    if(!safelyHosted(row.posting_url,row.provider,row.board))continue;
    const title=plain(row.title,150),company=plain(row.company,100);
    if(!title||!company||!appliesToRegion(row.location,input.region))continue;
    const senior=seniorTitle(title,row.employment_type??"");
    if(senior&&input.hideSenior)continue;
    const titleNorm=" "+normalize(title)+" ";
    const hit=words.filter(w=>(variants[w]??[w]).some(v=>titleNorm.includes(" "+normalize(v)+" "))).length;
    if(hit===0||(words.length>1&&hit<2))continue;
    const canonical=normalize(title)+"|"+normalize(company);
    if(seen.has(canonical))continue;
    seen.add(canonical);
    const body=" "+normalize(title+" "+row.description)+" ";
    const matches=mentionedSkills.filter(skill=>body.includes(" "+normalize(skill)+" "));
    const knownSkills=matches.filter(skill=>known.has(normalize(skill))).slice(0,4);
    const exploreNext=matches.filter(skill=>!known.has(normalize(skill))).slice(0,4);
    const firstSeen=iso(row.first_seen_at),published=iso(row.published_at);
    if(!firstSeen)continue;
    const job:JobOpportunity={
      id:row.provider+":"+row.board+":"+row.external_id,
      title,company,source:providerName(row.provider),url:row.posting_url,
      region:plain(row.location,130)||"Location not provided",
      level:null,employmentType:plain(row.employment_type,50)||null,
      publishedAt:published??firstSeen,checkedAt:iso(row.last_seen_at)??undefined,
      dateKind:published?"PUBLISHED":"FIRST_SEEN",
      excerpt:plain(row.description,220),
      signals:{
        role:hit===words.length?"Title closely matches your career goal":
          "Related title; verify responsibilities and qualifications",
        knownSkills,exploreNext,seniorRole:senior
      }
    };
    ranked.push({job,rank:Math.round(100*hit/words.length)+knownSkills.length*5-(senior?25:0)});
  }
  return ranked.sort((a,b)=>b.rank-a.rank||b.job.publishedAt.localeCompare(a.job.publishedAt))
    .slice(0,Math.max(1,Math.min(input.limit??12,24))).map(x=>x.job);
}
