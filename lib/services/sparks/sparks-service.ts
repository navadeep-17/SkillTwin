import "server-only";
import { getSql } from "@/lib/db/postgres";
import { MONTHLY_REWARDED_REFERRAL_LIMIT, REFERRAL_SPARKS, SPARKS_PRICES, type SparksAction, WELCOME_SPARKS } from "@/lib/domain/sparks";

type Row = Record<string, unknown>;
const rows = (value: unknown) => value as Row[];
export class InsufficientSparksError extends Error {
  constructor() { super("INSUFFICIENT_SPARKS"); }
}
export class DuplicateSparksOperationError extends Error {
  constructor() { super("SPARKS_OPERATION_ALREADY_USED"); }
}
// Off until migration and authenticated release QA complete.
export function isSparksChargingEnabled() {
  return process.env.SKILLTWIN_SPARKS_CHARGING_ENABLED === "true";
}
export async function ensureSparksWallet(userId: string) {
  const sql = getSql();
  await sql.begin(async tx => {
    const created = rows(await tx.unsafe(
      `insert into public.sparks_wallets(user_id,referral_code)
       values ($1::uuid,upper(substr(md5(gen_random_uuid()::text),1,12)))
       on conflict(user_id) do nothing returning user_id`, [userId]
    ));
    if (created.length) {
      await tx.unsafe(
        `insert into public.sparks_transactions(user_id,delta,reason,operation_key)
         values($1::uuid,$2,'WELCOME','WELCOME') on conflict do nothing`,
        [userId, WELCOME_SPARKS]
      );
    }
  });
}
export async function getSparksWallet(userId: string) {
  await ensureSparksWallet(userId);
  const sql = getSql();
  const wallet = rows(await sql.unsafe(
    "select balance,referral_code from public.sparks_wallets where user_id=$1::uuid",
    [userId]
  ))[0];
  const ledger = rows(await sql.unsafe(
    "select delta,reason,created_at from public.sparks_transactions where user_id=$1::uuid order by id desc limit 20",
    [userId]
  ));
  return { balance: Number(wallet.balance), referralCode: String(wallet.referral_code),
    welcomeSparks: WELCOME_SPARKS, rewardSparks: REFERRAL_SPARKS,
    prices: SPARKS_PRICES, chargingEnabled: isSparksChargingEnabled(), transactions: ledger };
}
export async function spendSparks(userId: string, action: SparksAction, key: string) {
  if (!isSparksChargingEnabled()) return;
  if (!/^[a-zA-Z0-9:_-]{8,120}$/.test(key)) throw new Error("INVALID_SPARKS_OPERATION_KEY");
  await ensureSparksWallet(userId);
  const cost = SPARKS_PRICES[action];
  const sql = getSql();
  await sql.begin(async tx => {
    const wallet = rows(await tx.unsafe(
      "select balance from public.sparks_wallets where user_id=$1::uuid for update", [userId]
    ))[0];
    const already = rows(await tx.unsafe(
      "select 1 from public.sparks_transactions where user_id=$1::uuid and operation_key=$2",
      [userId, "SPEND:" + key]
    ));
    if (already.length) throw new DuplicateSparksOperationError();
    if (Number(wallet.balance) < cost) throw new InsufficientSparksError();
    await tx.unsafe("update public.sparks_wallets set balance=balance-$2,updated_at=now() where user_id=$1::uuid", [userId, cost]);
    await tx.unsafe(
      "insert into public.sparks_transactions(user_id,delta,reason,operation_key) values($1::uuid,$2,'AI_ACTION',$3)",
      [userId, -cost, "SPEND:" + key]
    );
  });
}
export async function refundSparks(userId: string, action: SparksAction, key: string) {
  if (!isSparksChargingEnabled()) return;
  const sql = getSql();
  await sql.begin(async tx => {
    await tx.unsafe("select balance from public.sparks_wallets where user_id=$1::uuid for update", [userId]);
    const spent = rows(await tx.unsafe(
      "select 1 from public.sparks_transactions where user_id=$1::uuid and operation_key=$2 and reason='AI_ACTION'",
      [userId, "SPEND:" + key]
    ));
    if (!spent.length) return;
    const issued = rows(await tx.unsafe(
      "insert into public.sparks_transactions(user_id,delta,reason,operation_key) values($1::uuid,$2,'AI_REFUND',$3) on conflict do nothing returning id",
      [userId, SPARKS_PRICES[action], "REFUND:" + key]
    ));
    if (issued.length) await tx.unsafe(
      "update public.sparks_wallets set balance=balance+$2,updated_at=now() where user_id=$1::uuid",
      [userId, SPARKS_PRICES[action]]
    );
  });
}
// Activation requires a verified account, valid inviter, and a saved career goal.
// The invite is captured during Supabase signup; no browser-provided inviter ID is trusted.
export async function activateSparksReferral(userId: string) {
  await ensureSparksWallet(userId);
  const sql = getSql();
  const record = rows(await sql.unsafe(
    "select u.email_confirmed_at, c.referral_code as code from auth.users u left join public.sparks_referral_claims c on c.invitee_user_id=u.id where u.id=$1::uuid",
    [userId]
  ))[0];
  const code = record?.code;
  if (!record?.email_confirmed_at || typeof code !== "string" || !/^[A-F0-9]{12}$/.test(code)) return false;
  const inviter = rows(await sql.unsafe(
    "select user_id from public.sparks_wallets where referral_code=$1 and user_id<>$2::uuid",
    [code, userId]
  ))[0];
  if (!inviter) return false;
  const inviterId = String(inviter.user_id);
  const activated = await sql.begin(async tx => {
    // Stable lock order prevents deadlock even if two accounts invite each other.
    await tx.unsafe(
      "select user_id from public.sparks_wallets where user_id in ($1::uuid,$2::uuid) order by user_id for update",
      [inviterId,userId]
    );
    const goal = rows(await tx.unsafe(
      "select 1 from public.career_goals where user_id=$1::uuid and status='ACTIVE' limit 1", [userId]
    ));
    if (!goal.length) return false;
    const existing = rows(await tx.unsafe(
      "select 1 from public.sparks_referrals where invitee_user_id=$1::uuid", [userId]
    ));
    if (existing.length) return false;
    const count = rows(await tx.unsafe(
      `select count(*)::integer as n from public.sparks_referrals
       where inviter_user_id=$1::uuid and activated_at>=date_trunc('month',now())
         and activated_at<date_trunc('month',now())+interval '1 month'`, [inviterId]
    ))[0];
    if (Number(count.n) >= MONTHLY_REWARDED_REFERRAL_LIMIT) return false;
    const invite = rows(await tx.unsafe(
      `insert into public.sparks_referrals(invitee_user_id,inviter_user_id)
       values($1::uuid,$2::uuid) on conflict do nothing returning invitee_user_id`,
      [userId, inviterId]
    ));
    if (!invite.length) return false;
    for (const [uid, reason] of [[inviterId, "REFERRAL_INVITER"], [userId, "REFERRAL_INVITEE"]]) {
      await tx.unsafe(
        "insert into public.sparks_transactions(user_id,delta,reason,operation_key) values($1::uuid,$2,$3,$4)",
        [uid, REFERRAL_SPARKS, reason, "REFERRAL:" + userId]
      );
      await tx.unsafe(
        "update public.sparks_wallets set balance=balance+$2,updated_at=now() where user_id=$1::uuid",
        [uid, REFERRAL_SPARKS]
      );
    }
    return true;
  });
  return activated;
}
