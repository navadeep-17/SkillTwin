-- SkillTwin Sparks pilot: server-owned credits, immutable ledger, and verified referrals.
-- No pre-existing learner profile, assessment, plan, or evidence rows are modified.
begin;
create table public.sparks_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 100 check (balance >= 0),
  referral_code text not null unique check (referral_code ~ '^[A-F0-9]{12}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.sparks_transactions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  delta integer not null check (delta <> 0),
  reason text not null check (reason in ('WELCOME','AI_ACTION','AI_REFUND','REFERRAL_INVITER','REFERRAL_INVITEE')),
  operation_key text not null check (length(operation_key) between 1 and 150),
  created_at timestamptz not null default now(),
  unique(user_id, operation_key)
);
create index sparks_transactions_user_time on public.sparks_transactions (user_id, created_at desc);
create table public.sparks_referrals (
  invitee_user_id uuid primary key references auth.users(id) on delete cascade,
  inviter_user_id uuid not null references auth.users(id) on delete cascade,
  activated_at timestamptz not null default now(),
  check (invitee_user_id <> inviter_user_id)
);
-- Capture referral code exactly once on account creation.
create table public.sparks_referral_claims (
  invitee_user_id uuid primary key references auth.users(id) on delete cascade,
  referral_code text not null check (referral_code ~ '^[A-F0-9]{12} on public.sparks_referrals (inviter_user_id, activated_at desc);
-- Browser clients cannot mint, transfer, spend, or tamper with credits.
alter table public.sparks_wallets enable row level security;
alter table public.sparks_transactions enable row level security;
alter table public.sparks_referrals enable row level security;
alter table public.sparks_referral_claims enable row level security;
alter table public.sparks_wallets force row level security;
alter table public.sparks_transactions force row level security;
alter table public.sparks_referrals force row level security;
alter table public.sparks_referral_claims force row level security;
revoke all on public.sparks_wallets, public.sparks_transactions, public.sparks_referrals, public.sparks_referral_claims from public, anon, authenticated;
revoke all on sequence public.sparks_transactions_id_seq from public, anon, authenticated;
commit;
),
  created_at timestamptz not null default now()
);
create or replace function public.capture_sparks_signup_referral()
returns trigger language plpgsql security definer set search_path = '' as $
declare supplied_code text;
begin
  supplied_code := new.raw_user_meta_data ->> 'sparks_referral';
  if supplied_code ~ '^[A-F0-9]{12} on public.sparks_referrals (inviter_user_id, activated_at desc);
-- Browser clients cannot mint, transfer, spend, or tamper with credits.
alter table public.sparks_wallets enable row level security;
alter table public.sparks_transactions enable row level security;
alter table public.sparks_referrals enable row level security;
alter table public.sparks_wallets force row level security;
alter table public.sparks_transactions force row level security;
alter table public.sparks_referrals force row level security;
revoke all on public.sparks_wallets, public.sparks_transactions, public.sparks_referrals from public, anon, authenticated;
revoke all on sequence public.sparks_transactions_id_seq from public, anon, authenticated;
commit;
 then
    insert into public.sparks_referral_claims(invitee_user_id,referral_code)
    values(new.id,supplied_code) on conflict do nothing;
  end if;
  return new;
end;
$;
revoke all on function public.capture_sparks_signup_referral() from public,anon,authenticated;
create trigger capture_sparks_signup_referral
after insert on auth.users for each row execute function public.capture_sparks_signup_referral();
create index sparks_referrals_inviter_month on public.sparks_referrals (inviter_user_id, activated_at desc);
-- Browser clients cannot mint, transfer, spend, or tamper with credits.
alter table public.sparks_wallets enable row level security;
alter table public.sparks_transactions enable row level security;
alter table public.sparks_referrals enable row level security;
alter table public.sparks_wallets force row level security;
alter table public.sparks_transactions force row level security;
alter table public.sparks_referrals force row level security;
revoke all on public.sparks_wallets, public.sparks_transactions, public.sparks_referrals from public, anon, authenticated;
revoke all on sequence public.sparks_transactions_id_seq from public, anon, authenticated;
commit;
