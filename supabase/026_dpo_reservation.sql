-- Website-content project only. Service-only primitives; no checkout is enabled.
begin;
create or replace function public.reserve_website_donation(p_reference uuid,p_amount_minor bigint,p_currency text,p_purpose text) returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.website_donation_transactions; created boolean;
begin
  if p_reference is null or p_amount_minor is null or p_amount_minor<1 or p_amount_minor>100000000000 or p_currency not in ('UGX','USD') or length(btrim(coalesce(p_purpose,''))) not between 1 and 180 then raise exception 'Invalid donation request.'; end if;
  insert into public.website_donation_transactions(reference,amount_minor,currency,purpose)
  values(p_reference,p_amount_minor,p_currency,btrim(p_purpose)) on conflict(reference) do nothing returning * into r;
  created:=found;
  if not created then select * into r from public.website_donation_transactions where reference=p_reference; end if;
  if r.amount_minor<>p_amount_minor or r.currency<>p_currency or r.purpose<>btrim(p_purpose) then raise exception 'Donation reference already used.'; end if;
  return jsonb_build_object('created',created,'reference',r.reference,'status',r.status,'token_bound',r.provider_token is not null);
end $$;
create or replace function public.bind_website_donation_token(p_reference uuid,p_token uuid) returns boolean language plpgsql security definer set search_path=public as $$
declare r public.website_donation_transactions;
begin
  if p_token is null then return false; end if;
  select * into r from public.website_donation_transactions where reference=p_reference for update;
  if not found or r.status<>'pending' then return false; end if;
  if r.provider_token is not null then return r.provider_token=p_token; end if;
  update public.website_donation_transactions set provider_token=p_token,updated_at=now() where id=r.id;
  return true;
end $$;
revoke all on function public.reserve_website_donation(uuid,bigint,text,text),public.bind_website_donation_token(uuid,uuid) from public,anon,authenticated;
grant execute on function public.reserve_website_donation(uuid,bigint,text,text),public.bind_website_donation_token(uuid,uuid) to service_role;
commit;
