import {type JobSource} from "./source-registry.js";

/** One published, normalized vacancy from a known official ATS job board. */
export type AtsJob = {
  provider:string; board:string; externalId:string;
  title:string; company:string; location:string; workplaceType:string|null;
  employmentType:string|null; description:string; url:string;
  publishedAt:string|null; sourceUpdatedAt:string|null;
};
type Obj=Record<string,unknown>;
const obj=(v:unknown):Obj|null=>v&&typeof v==="object"&&!Array.isArray(v)?v as Obj:null;
const str=(v:unknown,limit=4000):string=>typeof v==="string"
  ?v.replace(/<[^>]*>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&")
    .replace(/&#39;/gi,"'").replace(/&quot;/gi,'"')
    .replace(/\s+/g," ").trim().slice(0,limit):"";
const list=(v:unknown):unknown[]=>Array.isArray(v)?v:[];
const date=(v:unknown):string|null=>{
  const d=typeof v==="number"?new Date(v):typeof v==="string"?new Date(v):null;
  return d&&Number.isFinite(d.getTime())?d.toISOString():null;
};
function safePosting(raw:unknown,source:JobSource):string|null {
  if(typeof raw!=="string")return null;
  try{
    const url=new URL(raw);
    if(url.protocol!=="https:"||url.username||url.password)return null;
    // Hosted ATS URLs only for MVP. Prevent an upstream feed from putting
    // an arbitrary outbound domain on SkillTwin's trusted apply action.
    const hosts:Record<string,string[]>={
      greenhouse:["job-boards.greenhouse.io","boards.greenhouse.io"],
      lever:["jobs.lever.co","jobs.eu.lever.co"],
      ashby:["jobs.ashbyhq.com"]
    };
    if(!hosts[source.provider]?.includes(url.hostname))return null;
    if(!url.pathname.startsWith("/"+source.token+"/"))return null;
    return url.toString();
  }catch{return null;}
}
function result(source:JobSource,job:{
  externalId:unknown; title:unknown; location:unknown;workplaceType:unknown;
  employmentType:unknown;description:unknown;url:unknown;
  publishedAt:unknown;sourceUpdatedAt:unknown;
}):AtsJob|null {
  const externalId=typeof job.externalId==="number"?String(job.externalId):str(job.externalId,150);
  const title=str(job.title,180);
  const url=safePosting(job.url,source);
  if(!externalId||!title||!url)return null;
  return {
    provider:source.provider,board:source.token,externalId,title,company:source.company,
    location:str(job.location,180)||"Location not provided",
    workplaceType:str(job.workplaceType,50)||null,
    employmentType:str(job.employmentType,50)||null,
    description:str(job.description,6000),url,
    publishedAt:date(job.publishedAt),sourceUpdatedAt:date(job.sourceUpdatedAt)
  };
}

export function normalizeAtsResponse(source:JobSource,payload:unknown):AtsJob[] {
  let raw:unknown[];
  if(source.provider==="lever"){
    if(!Array.isArray(payload))throw new Error("ATS_RESPONSE_INVALID");
    raw=payload;
  } else {
    const body=obj(payload);
    if(!body||!Array.isArray(body.jobs))throw new Error("ATS_RESPONSE_INVALID");
    raw=body.jobs;
  }
  if(raw.length>1200)throw new Error("ATS_RESPONSE_TOO_MANY_JOBS");
  const out:AtsJob[]=[];
  const seen=new Set<string>();
  for(const item of raw){
    const row=obj(item);
    if(!row)continue;
    let normalized:AtsJob|null=null;
    if(source.provider==="greenhouse"){
      const loc=obj(row.location);
      const id=row.id;
      normalized=result(source,{
        externalId:id,title:row.title,location:loc?.name,
        workplaceType:null,employmentType:null,description:row.content,
        url:row.absolute_url??(id!=null?"https://job-boards.greenhouse.io/"+source.token+"/jobs/"+String(id):null),
        publishedAt:null, // updated_at is NOT the original publication date
        sourceUpdatedAt:row.updated_at
      });
    }else if(source.provider==="lever"){
      const categories=obj(row.categories);
      normalized=result(source,{
        externalId:row.id,title:row.text,location:categories?.location,
        workplaceType:row.workplaceType,employmentType:categories?.commitment,
        description:row.descriptionPlain,url:row.hostedUrl,
        publishedAt:null, // Lever createdAt is creation metadata, not proof of first public publication
        sourceUpdatedAt:row.updatedAt
      });
    }else{
      // Ashby isListed=false means intentionally unlisted even if the URL works.
      if(row.isListed===false)continue;
      normalized=result(source,{
        externalId:row.jobUrl??row.id,title:row.title,location:row.location,
        workplaceType:row.workplaceType,employmentType:row.employmentType,
        description:row.descriptionPlain,url:row.jobUrl,
        publishedAt:row.publishedAt,sourceUpdatedAt:null
      });
    }
    if(!normalized||seen.has(normalized.externalId))continue;
    seen.add(normalized.externalId);
    out.push(normalized);
  }
  return out;
}
