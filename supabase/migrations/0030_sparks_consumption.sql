-- Sparks consumption v2: explicitly optional AI usage and weekly refill.
begin;
alter table public.sparks_transactions drop constraint if exists sparks_transactions_reason_check;
alter table public.sparks_transactions add constraint sparks_transactions_reason_check
  check (reason in ('WELCOME','AI_ACTION','AI_REFUND','REFERRAL_INVITER','REFERRAL_INVITEE','WEEKLY_REFILL'));

create table public.sparks_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_key text not null check (length(operation_key) between 8 and 120),
  action text not null check (action in ('ENHANCED_CHAT','RESUME_REANALYSIS')),
  reference_id uuid,
  cost integer not null check (cost between 0 and 100),
  status text not null default 'RESERVED' check (status in ('RESERVED','COMPLETED','REFUNDED')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, operation_key)
);
create index sparks_usage_quota_idx on public.sparks_usage(user_id,action,status,cost);
create unique index sparks_usage_resume_single_active on public.sparks_usage(user_id,reference_id)
  where action='RESUME_REANALYSIS' and reference_id is not null and status in ('RESERVED','COMPLETED');
alter table public.sparks_usage enable row level security;
alter table public.sparks_usage force row level security;
revoke all on public.sparks_usage from public,anon,authenticated;
revoke all on sequence public.sparks_usage_id_seq from public,anon,authenticated;
commit;
