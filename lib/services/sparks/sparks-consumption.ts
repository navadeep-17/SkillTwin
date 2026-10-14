import "server-only";
import { getSql } from "@/lib/db/postgres";
import { ensureSparksWallet, isSparksChargingEnabled, InsufficientSparksError, DuplicateSparksOperationError } from "@/lib/services/sparks/sparks-service";
import { FREE_ENHANCED_REPLIES, FREE_RESUME_ANALYSES, WEEKLY_REFILL_SPARKS, WEEKLY_REFILL_THRESHOLD, SPARKS_PRICES, type MeteredSparksAction } from "@/lib/domain/sparks";

type Row = Record<string,unknown>;
const rows=(v:unknown)=>v as Row[];
export class SparksActionInProgressError extends Error {
  constructor(){super("SPARKS_ACTION_IN_PROGRESS");}
}
const validKey=(v:string)=>/^[a-zA-Z0-9:_-]{8,120}$/.test(v);
async function freeQuotaRemaining(tx:Pick<ReturnType<typeof getSql>,"unsafe">,userId:string,action:MeteredSparksAction) {
  const used=rows(await tx.unsafe(
    "select count(*)::integer as n from public.sparks_usage where user_id=$1::uuid and action=$2 and cost=0 and status in ('RESERVED','COMPLETED')",
    [userId,action]
  ))[0];
  const prior=action==="RESUME_REANALYSIS"
    ?rows(await tx.unsafe(
      "select 1 from public.profile_analysis_runs where user_id=$1::uuid and source_type='resume' and status='complete' limit 1",
      [userId]
    )).length:0;
  const quota=action==="ENHANCED_CHAT"?FREE_ENHANCED_REPLIES:FREE_RESUME_ANALYSES;
  return Math.max(0,quota-Number(used?.n??0)-prior);
}
export async function getSparksConsumption(userId:string,createdAt:Date,balance:number) {
  const sql=getSql();
  const [chatFree,resumeFree,lastWeekly]=await Promise.all([
    freeQuotaRemaining(sql,userId,"ENHANCED_CHAT"),
    freeQuotaRemaining(sql,userId,"RESUME_REANALYSIS"),
    sql.unsafe("select created_at from public.sparks_transactions where user_id=$1::uuid and reason='WEEKLY_REFILL' order by id desc limit 1",[userId])
  ]);
  const last=rows(lastWeekly)[0];
  const nextAt=new Date(Math.max(createdAt.getTime(),last?.created_at?new Date(String(last.created_at)).getTime():0)+7*86400000);
  return {
    freeEnhancedRemaining:chatFree,
    freeResumeRemaining:resumeFree,
    enhancedReplyCostNow:isSparksChargingEnabled(userId)&&chatFree===0?SPARKS_PRICES.ENHANCED_CHAT:0,
    resumeCostNow:isSparksChargingEnabled(userId)&&resumeFree===0?SPARKS_PRICES.RESUME_REANALYSIS:0,
    weeklyRefillAmount:WEEKLY_REFILL_SPARKS,
    weeklyRefillThreshold:WEEKLY_REFILL_THRESHOLD,
    weeklyRefillEligible:balance<=WEEKLY_REFILL_THRESHOLD&&nextAt.getTime()<=Date.now(),
    weeklyNextAt:nextAt.toISOString()
  };
}
export async function reserveSparksUsage(input:{userId:string;action:MeteredSparksAction;key:string;referenceId?:string}) {
  if(!isSparksChargingEnabled(input.userId)) return {enabled:false,cost:0,free:true};
  if(!validKey(input.key)) throw new Error("INVALID_SPARKS_OPERATION_KEY");
  if(input.referenceId&&!/^[0-9a-f-]{36}$/i.test(input.referenceId)) throw new Error("INVALID_SPARKS_REFERENCE");
  await ensureSparksWallet(input.userId);
  await recoverStaleSparksUsage(input.userId);
  const sql=getSql();
  return sql.begin(async tx=>{
    const wallet=rows(await tx.unsafe("select balance from public.sparks_wallets where user_id=$1::uuid for update",[input.userId]))[0];
    const found=rows(await tx.unsafe("select status from public.sparks_usage where user_id=$1::uuid and operation_key=$2",[input.userId,input.key]))[0];
    if(found) throw new DuplicateSparksOperationError();
    if(input.action==="RESUME_REANALYSIS"&&input.referenceId){
      const existing=rows(await tx.unsafe(
        "select 1 from public.sparks_usage where user_id=$1::uuid and action='RESUME_REANALYSIS' and reference_id=$2::uuid and status in ('RESERVED','COMPLETED') limit 1",
        [input.userId,input.referenceId]
      ));
      if(existing.length)throw new SparksActionInProgressError();
    }
    const free=(await freeQuotaRemaining(tx,input.userId,input.action))>0;
    const cost=free?0:SPARKS_PRICES[input.action];
    if(cost>Number(wallet.balance))throw new InsufficientSparksError();
    await tx.unsafe(
      "insert into public.sparks_usage(user_id,operation_key,action,reference_id,cost) values ($1::uuid,$2,$3,$4::uuid,$5)",
      [input.userId,input.key,input.action,input.referenceId??null,cost]
    );
    if(cost>0){
      await tx.unsafe("update public.sparks_wallets set balance=balance-$2,updated_at=now() where user_id=$1::uuid",[input.userId,cost]);
      await tx.unsafe(
        "insert into public.sparks_transactions(user_id,delta,reason,operation_key) values ($1::uuid,$2,'AI_ACTION',$3)",
        [input.userId,-cost,"SPEND:"+input.key]
      );
    }
    return {enabled:true,cost,free};
  });
}
export async function finishSparksUsage(userId:string,key:string,success:boolean){
  // Always settle existing reservations, even if charging is disabled mid-flight.
  const sql=getSql();
  await sql.begin(async tx=>{
    await tx.unsafe("select 1 from public.sparks_wallets where user_id=$1::uuid for update",[userId]);
    const changed=rows(await tx.unsafe(
      "update public.sparks_usage set status=$3,completed_at=now() where user_id=$1::uuid and operation_key=$2 and status='RESERVED' returning cost",
      [userId,key,success?"COMPLETED":"REFUNDED"]
    ))[0];
    if(!changed||success||Number(changed.cost)===0)return;
    const cost=Number(changed.cost);
    await tx.unsafe("update public.sparks_wallets set balance=balance+$2,updated_at=now() where user_id=$1::uuid",[userId,cost]);
    await tx.unsafe("insert into public.sparks_transactions(user_id,delta,reason,operation_key) values($1::uuid,$2,'AI_REFUND',$3)",[userId,cost,"REFUND:"+key]);
  });
}
// Recover abandoned reservations after a process crash or client timeout.
// Paid work is bounded to under a minute; 15 minutes leaves ample settling time.
// Acquire the same wallet lock as regular spending and refunds, serialize with them.
export async function recoverStaleSparksUsage(userId:string){
  const sql=getSql();
  await sql.begin(async tx=>{
    const wallet=rows(await tx.unsafe(
      "select user_id from public.sparks_wallets where user_id=$1::uuid for update",[userId]
    ))[0];
    if(!wallet)return;
    const stale=rows(await tx.unsafe(
      "update public.sparks_usage set status='REFUNDED',completed_at=now() "+
      "where user_id=$1::uuid and status='RESERVED' and created_at<now()-interval '15 minutes' "+
      "returning operation_key,cost",[userId]
    ));
    for(const row of stale){
      const cost=Number(row.cost);
      if(cost<=0)continue;
      const refunded=rows(await tx.unsafe(
        "insert into public.sparks_transactions(user_id,delta,reason,operation_key) "+
        "values($1::uuid,$2,'AI_REFUND',$3) on conflict do nothing returning id",
        [userId,cost,"REFUND:"+String(row.operation_key)]
      ));
      if(refunded.length){
        await tx.unsafe(
          "update public.sparks_wallets set balance=balance+$2,updated_at=now() where user_id=$1::uuid",
          [userId,cost]
        );
      }
    }
  });
}
export async function claimWeeklySparks(userId:string){
  await ensureSparksWallet(userId);
  const sql=getSql();
  return sql.begin(async tx=>{
    const wallet=rows(await tx.unsafe("select balance,created_at from public.sparks_wallets where user_id=$1::uuid for update",[userId]))[0];
    if(!wallet||Number(wallet.balance)>WEEKLY_REFILL_THRESHOLD)return false;
    const weekly=rows(await tx.unsafe(
      "select created_at from public.sparks_transactions where user_id=$1::uuid and reason='WEEKLY_REFILL' order by id desc limit 1",
      [userId]
    ))[0];
    const latest=weekly?.created_at?new Date(String(weekly.created_at)):new Date(String(wallet.created_at));
    if(Date.now()-latest.getTime()<7*86400000)return false;
    const week=rows(await tx.unsafe("select to_char(now(),'IYYY-IW') as week"))[0];
    const key="WEEKLY:"+String(week.week);
    const reward=rows(await tx.unsafe(
      "insert into public.sparks_transactions(user_id,delta,reason,operation_key) values($1::uuid,$2,'WEEKLY_REFILL',$3) on conflict do nothing returning id",
      [userId,WEEKLY_REFILL_SPARKS,key]
    ));
    if(!reward.length)return false;
    await tx.unsafe("update public.sparks_wallets set balance=balance+$2,updated_at=now() where user_id=$1::uuid",[userId,WEEKLY_REFILL_SPARKS]);
    return true;
  });
}
