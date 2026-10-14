import {getSql} from "@/lib/db/postgres";
import type {BoardResult} from "./fetch-boards.js";
import type {JobSource} from "./source-registry.js";

export type BoardSyncOutcome={source:string;status:"SUCCESS"|"FAILED";count:number;errorCode?:string};

/**
 * One atomic upsert per board. A missing posting becomes inactive only after
 * two COMPLETE, successful board snapshots; a network/parse error never ages it.
 */
export async function persistBoard(result:BoardResult,startedAt:Date):Promise<void>{
  const sql=getSql();
  const payload=result.jobs.map(job=>({
    provider:job.provider,board:job.board,external_id:job.externalId,
    company:job.company,title:job.title,location:job.location,
    workplace_type:job.workplaceType,employment_type:job.employmentType,
    description:job.description,posting_url:job.url,
    published_at:job.publishedAt,publisher_updated_at:job.sourceUpdatedAt
  }));
  if(!payload.length)throw new Error("REFUSE_EMPTY_BOARD_COMMIT");
  await sql.begin(async tx=>{
    await tx.unsafe(`
      insert into public.ats_job_postings
        (provider,board,external_id,company,title,location,workplace_type,
         employment_type,description,posting_url,published_at,publisher_updated_at,
         first_seen_at,last_seen_at,missing_scans,is_active)
      select j.provider,j.board,j.external_id,j.company,j.title,j.location,
        j.workplace_type,j.employment_type,j.description,j.posting_url,
        nullif(j.published_at,'')::timestamptz,
        nullif(j.publisher_updated_at,'')::timestamptz,
        clock_timestamp(),clock_timestamp(),0,true
      from jsonb_to_recordset($1::jsonb) as j(
        provider text,board text,external_id text,company text,title text,
        location text,workplace_type text,employment_type text,description text,
        posting_url text,published_at text,publisher_updated_at text)
      on conflict(provider,board,external_id) do update set
        company=excluded.company,title=excluded.title,location=excluded.location,
        workplace_type=excluded.workplace_type,employment_type=excluded.employment_type,
        description=excluded.description,posting_url=excluded.posting_url,
        published_at=coalesce(excluded.published_at,public.ats_job_postings.published_at),
        publisher_updated_at=excluded.publisher_updated_at,
        last_seen_at=clock_timestamp(),missing_scans=0,is_active=true
    `,[JSON.stringify(payload)]);
    await tx.unsafe(`
      update public.ats_job_postings
      set missing_scans=least(missing_scans+1,10000),
          is_active=(missing_scans+1 < 2)
      where provider=$1 and board=$2 and last_seen_at<$3::timestamptz
        and is_active=true
    `,[result.source.provider,result.source.token,startedAt.toISOString()]);
    await tx.unsafe(`
      insert into public.ats_job_sync_runs(provider,board,status,started_at,parsed_count)
      values ($1,$2,'SUCCESS',$3::timestamptz,$4)
    `,[result.source.provider,result.source.token,startedAt.toISOString(),result.jobs.length]);
  });
}

export async function recordBoardFailure(source:JobSource,startedAt:Date,code:string):Promise<void>{
  const sql=getSql();
  const clean=code.replace(/[^A-Z0-9_]/g,"_").slice(0,90);
  await sql.unsafe(`
    insert into public.ats_job_sync_runs
      (provider,board,status,started_at,parsed_count,error_code)
    values($1,$2,'FAILED',$3::timestamptz,0,$4)
  `,[source.provider,source.token,startedAt.toISOString(),clean]);
}
