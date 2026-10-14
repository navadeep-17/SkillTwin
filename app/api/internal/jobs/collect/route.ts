import {timingSafeEqual} from "node:crypto";
import {JOB_SOURCES} from "@/lib/jobs/source-registry";
import {fetchBoard} from "@/lib/jobs/fetch-boards";
import {persistBoard,recordBoardFailure,type BoardSyncOutcome} from "@/lib/jobs/persist-board";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=120;

function authorized(request:Request):boolean{
  const configured=process.env.JOB_COLLECTOR_SECRET;
  if(!configured||configured.length<32)return false;
  const received=request.headers.get("x-job-collector-secret")||"";
  const a=Buffer.from(received),b=Buffer.from(configured);
  return a.length===b.length&&timingSafeEqual(a,b);
}

/** Called by a restricted scheduler, never directly by learners. */
export async function POST(request:Request){
  if(!authorized(request))return Response.json({ok:false,error:"NOT_AUTHORIZED"},{status:401});
  const outcomes:BoardSyncOutcome[]=[];
  // This endpoint can run for ~60s. Each source is an independent transaction.
  // No provider errors may close previously known listings.
  for(const source of JOB_SOURCES.filter(x=>x.enabled)){
    const startedAt=new Date();
    try{
      const result=await fetchBoard(source);
      await persistBoard(result,startedAt);
      outcomes.push({source:source.id,status:"SUCCESS",count:result.jobs.length});
    }catch(error){
      const code=error instanceof Error?error.message:"UNKNOWN_SOURCE_ERROR";
      outcomes.push({source:source.id,status:"FAILED",count:0,errorCode:code.replace(/[^A-Z0-9_]/gi,"_").slice(0,90)});
      console.warn("ats.collector.source_failed",{source:source.id,errorCode:outcomes.at(-1)?.errorCode});
      try{await recordBoardFailure(source,startedAt,code);}catch(e){
        console.error("ats.collector.audit_failed",{source:source.id,error:e instanceof Error?e.name:"unknown"});
      }
    }
  }
  const failed=outcomes.filter(x=>x.status==="FAILED").length;
  return Response.json({
    ok:failed===0,sourceCount:outcomes.length,
    succeeded:outcomes.length-failed,failed,
    postingsObserved:outcomes.reduce((n,x)=>n+x.count,0),
    sources:outcomes
  },{status:failed===outcomes.length?503:200,headers:{"Cache-Control":"no-store"}});
}
