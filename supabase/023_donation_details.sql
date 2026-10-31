-- Website content project only. Payment credentials never belong in content records.
begin;
do $$begin
  if to_regprocedure('public.validate_website_content_before_donation(jsonb)') is null then
    alter function public.validate_website_content(jsonb) rename to validate_website_content_before_donation;
  end if;
end $$;
create or replace function public.validate_website_content(p jsonb) returns void language plpgsql set search_path=public as $$
declare d jsonb:=p->'details'; k text;
keys text[]:=array['donate_intro','donate_bank_name','donate_bank_account_name','donate_bank_account_number','donate_bank_branch','donate_bank_swift','donate_bank_currency','donate_bank_instructions','donate_mtn_name','donate_mtn_code','donate_mtn_instructions','donate_airtel_name','donate_airtel_code','donate_airtel_instructions'];
begin
  perform public.validate_website_content_before_donation(jsonb_set(p,'{details}',d-keys));
  foreach k in array keys loop
    if d ? k and (jsonb_typeof(d->k)<>'string' or length(d->>k)>3000 or p->>'kind'<>'page' or p->>'slug'<>'site-settings') then raise exception 'Invalid donation details.'; end if;
  end loop;
end $$;
revoke all on function public.validate_website_content(jsonb) from public,anon,authenticated;
create or replace function public.guard_donation_details() returns trigger language plpgsql security definer set search_path=public as $$
declare k text; before_details jsonb := '{}'::jsonb;
keys text[]:=array['donate_intro','donate_bank_name','donate_bank_account_name','donate_bank_account_number','donate_bank_branch','donate_bank_swift','donate_bank_currency','donate_bank_instructions','donate_mtn_name','donate_mtn_code','donate_mtn_instructions','donate_airtel_name','donate_airtel_code','donate_airtel_instructions'];
begin
  if tg_op='UPDATE' then before_details:=old.details; end if;
  foreach k in array keys loop
    if new.details->k is distinct from before_details->k and not public.website_role(array['administrator']) then
      raise exception 'Only an administrator may change donation settings.';
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists guard_donation_details on public.content_items;
create trigger guard_donation_details before insert or update on public.content_items for each row execute function public.guard_donation_details();
revoke all on function public.guard_donation_details() from public,anon,authenticated;
commit;
