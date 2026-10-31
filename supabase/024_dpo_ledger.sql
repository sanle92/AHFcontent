-- WEBSITE CONTENT PROJECT ONLY. This ledger does not initiate payments.
begin;
create table if not exists public.website_donation_transactions (
  id uuid primary key default gen_random_uuid(),
  reference uuid not null unique,
  amount_minor bigint not null check (amount_minor > 0 and amount_minor <= 100000000000),
  currency text not null check (currency in ('UGX','USD')),
  purpose text not null check (length(purpose) between 1 and 180),
  provider_token uuid unique,
  status text not null default 'pending' check (status in ('pending','confirmed','needs_review')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  check ((status = 'confirmed') = (confirmed_at is not null))
);
alter table public.website_donation_transactions enable row level security;
revoke all on public.website_donation_transactions from public, anon, authenticated;
grant select on public.website_donation_transactions to authenticated;
drop policy if exists donation_admin_read on public.website_donation_transactions;
create policy donation_admin_read on public.website_donation_transactions for select to authenticated using(public.website_role(array['administrator']));
create index if not exists website_donations_status_idx on public.website_donation_transactions(status, created_at);
create or replace function public.confirm_website_donation(p_reference uuid,p_token uuid,p_amount_minor bigint,p_currency text) returns boolean language plpgsql security definer set search_path=public as $$
declare r public.website_donation_transactions;
begin
  select * into r from public.website_donation_transactions where reference=p_reference for update;
  if not found or r.provider_token is distinct from p_token or r.amount_minor is distinct from p_amount_minor or r.currency is distinct from p_currency then return false; end if;
  if r.status='confirmed' then return true; end if;
  if r.status<>'pending' then return false; end if;
  update public.website_donation_transactions set status='confirmed',confirmed_at=now(),updated_at=now() where id=r.id;
  return true;
end $$;
revoke all on function public.confirm_website_donation(uuid,uuid,bigint,text) from public,anon,authenticated;
grant execute on function public.confirm_website_donation(uuid,uuid,bigint,text) to service_role;
commit;
