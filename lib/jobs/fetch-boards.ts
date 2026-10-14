import {feedUrl, type JobSource} from "./source-registry.js";
import {normalizeAtsResponse,type AtsJob} from "./ats-normalizers.js";

export type BoardResult={source:JobSource;jobs:AtsJob[];fetchedAt:string};
type Fetcher=typeof fetch;
async function fetchJson(url:string,fetcher:Fetcher):Promise<unknown>{
  const response=await fetcher(url,{
    method:"GET",redirect:"error",
    headers:{Accept:"application/json","User-Agent":"SkillTwinJobs/1.0 (+https://skilltwin-production.up.railway.app)"},
    signal:AbortSignal.timeout(9000),
    cache:"no-store"
  });
  if(!response.ok)throw new Error("FEED_HTTP_"+response.status);
  if(!response.headers.get("content-type")?.toLowerCase().includes("json"))throw new Error("FEED_NOT_JSON");
  const size=Number(response.headers.get("content-length")||0);
  if(size>6_000_000)throw new Error("FEED_TOO_LARGE");
  const body=await response.text();
  if(body.length>6_000_000)throw new Error("FEED_TOO_LARGE");
  try{return JSON.parse(body) as unknown;}catch{throw new Error("FEED_INVALID_JSON");}
}

/** Never silently treat a partial/empty feed as evidence that old jobs closed. */
export async function fetchBoard(source:JobSource,fetcher:Fetcher=fetch):Promise<BoardResult>{
  const combined:AtsJob[]=[];
  if(source.provider!=="lever"){
    const body=await fetchJson(feedUrl(source),fetcher);
    combined.push(...normalizeAtsResponse(source,body));
  }else{
    let complete=false;
    for(let page=0;page<5;page++){
      const skip=page*100;
      const body=await fetchJson(feedUrl(source,skip),fetcher);
      if(!Array.isArray(body))throw new Error("LEVER_BAD_PAGE");
      combined.push(...normalizeAtsResponse(source,body));
      if(body.length<100){complete=true;break;}
    }
    if(!complete)throw new Error("LEVER_PAGINATION_TRUNCATED");
  }
  if(!combined.length)throw new Error("EMPTY_OR_UNPARSABLE_FEED");
  const unique=[...new Map(combined.map(job=>[job.externalId,job])).values()];
  if(unique.length>1000)throw new Error("FEED_TOO_MANY_JOBS");
  return {source,jobs:unique,fetchedAt:new Date().toISOString()};
}
