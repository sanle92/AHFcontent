begin;
-- Retry idempotent public submissions without storing another copy of their contact details.
create table if not exists public.website_submission_keys(id uuid primary key,enquiry_id uuid not null references website_enquiries(id) on delete cascade,fingerprint text not null,created_at timestamptz not null default now());
alter table website_submission_keys enable row level security;
revoke all on website_submission_keys from public,anon,authenticated;
do $$begin if to_regprocedure('public.receive_website_enquiry_v1(jsonb,text)') is null then alter function public.receive_website_enquiry(jsonb,text) rename to receive_website_enquiry_v1;end if;end $$;
create or replace function public.receive_website_enquiry(payload jsonb,request_tag text) returns uuid language plpgsql security definer set search_path=public as $$declare key_id uuid;finger text;prior website_submission_keys;rid uuid;begin
 if coalesce(payload->>'submission_key','')='' then return receive_website_enquiry_v1(payload,request_tag);end if;
 key_id:=(payload->>'submission_key')::uuid;
 finger:=encode(sha256(convert_to((payload-'submission_key')::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended(key_id::text,1));
 select * into prior from website_submission_keys where id=key_id;
 if found then if prior.fingerprint<>finger then raise exception 'Invalid content.';end if;return prior.enquiry_id;end if;
 rid:=receive_website_enquiry_v1(payload-'submission_key',request_tag);
 insert into website_submission_keys(id,enquiry_id,fingerprint) values(key_id,rid,finger);return rid;
end $$;
revoke all on function receive_website_enquiry(jsonb,text),receive_website_enquiry_v1(jsonb,text) from public,anon,authenticated;
grant execute on function receive_website_enquiry(jsonb,text) to service_role;

alter table website_email_outbox add column if not exists lease_token uuid;
alter table website_email_outbox add column if not exists next_attempt timestamptz not null default now();
create index if not exists website_email_due_idx on website_email_outbox(status,next_attempt);
create or replace function claim_website_email_v2(enquiry uuid) returns setof website_email_outbox language plpgsql security definer set search_path=public as $$begin
 update website_email_outbox set status='Needs review',lease_until=null,lease_token=null,last_error='Review provider records before retrying.' where enquiry_id=enquiry and status in ('Sending','Failed') and (first_attempt_at<now()-interval '23 hours' or attempts>=6 and lease_until<now());
 return query with chosen as(select id from website_email_outbox where enquiry_id=enquiry and attempts<6 and next_attempt<=now() and (status in ('Pending','Failed') or status='Sending' and lease_until<now()) for update skip locked)
 update website_email_outbox o set status='Sending',lease_until=now()+interval '2 minutes',lease_token=gen_random_uuid(),attempts=o.attempts+1,first_attempt_at=coalesce(o.first_attempt_at,now()) where o.id in(select id from chosen) returning o.*;
end $$;
create or replace function finish_website_email_v2(mail_id uuid,lease uuid,provider text,error_text text) returns void language sql security definer set search_path=public as $$
 update website_email_outbox set status=case when provider is not null then 'Accepted' when attempts>=6 then 'Needs review' else 'Failed' end,provider_id=provider,last_error=left(coalesce(error_text,''),300),lease_until=null,lease_token=null,next_attempt=now()+least(60,power(2,attempts)) * interval '1 minute' where id=mail_id and status='Sending' and lease_token=lease
$$;
create or replace function website_due_email() returns table(enquiry_id uuid) language sql security definer set search_path=public as $$
 select o.enquiry_id from website_email_outbox o where (o.status in ('Pending','Failed') and o.next_attempt<=now()) or (o.status='Sending' and o.lease_until<now()) group by o.enquiry_id order by min(o.created_at) limit 4
$$;

alter table website_push_jobs add column if not exists lease_token uuid;
create index if not exists website_push_due_idx on website_push_jobs(status,next_attempt);
create or replace function claim_website_push_v2(selected_notice uuid default null,selected_endpoint text default null) returns table(job_id uuid,payload jsonb,title text,body text,url text,lease_token uuid) language plpgsql security definer set search_path=public as $$begin
 update website_push_jobs j set status='Cancelled',lease_token=null from website_push_subscriptions s,website_notifications n,website_profiles p where j.subscription_id=s.id and j.notification_id=n.id and p.id=s.user_id and j.status in ('Pending','Sending') and (not s.enabled or not p.active or not p.roles&&n.target_roles or n.user_id<>s.user_id);
 update website_push_jobs j set status='Failed',lease_token=null,error='Final delivery lease expired; review delivery logs.' where j.status='Sending' and j.attempts>=5 and j.lease_until<now();
 return query with chosen as (select j.id from website_push_jobs j join website_push_subscriptions s on s.id=j.subscription_id where (selected_notice is null or j.notification_id=selected_notice) and (selected_endpoint is null or s.endpoint=selected_endpoint) and j.attempts<5 and j.next_attempt<=now() and (j.status='Pending' or j.status='Sending' and j.lease_until<now()) order by j.next_attempt limit 16 for update of j skip locked),claimed as(update website_push_jobs j set status='Sending',attempts=j.attempts+1,lease_until=now()+interval '2 minutes',lease_token=gen_random_uuid() where j.id in(select id from chosen) returning j.*)
 select c.id,s.subscription,n.title,n.body,n.url,c.lease_token from claimed c join website_push_subscriptions s on s.id=c.subscription_id join website_notifications n on n.id=c.notification_id;
end $$;
create or replace function finish_website_push_v2(job uuid,lease uuid,result text) returns void language plpgsql security definer set search_path=public as $$declare sub uuid;begin
 update website_push_jobs set status=case when result='Sent' then 'Sent' when result='Gone' then 'Gone' when attempts>=5 then 'Failed' else 'Pending' end,error=case when result='Sent' then '' else left(result,200) end,next_attempt=now()+least(30,power(2,attempts))*interval '1 minute',lease_until=null,lease_token=null where id=job and status='Sending' and lease_token=lease returning subscription_id into sub;
 if result='Gone' and sub is not null then update website_push_subscriptions set enabled=false where id=sub;end if;
end $$;
create or replace function queue_website_test() returns uuid language plpgsql security definer set search_path=public as $$declare notice uuid;begin
 perform test_website_notice();
 select id into notice from website_notifications where user_id=auth.uid() and source_key='test/'||auth.uid()||'/'||to_char(now(),'YYYYMMDDHH24MI');return notice;
end $$;
create or replace function website_test_delivery(notice uuid,endpoint text) returns boolean language plpgsql security definer set search_path=public as $$begin
 if not website_role(array['administrator','editor','publisher','enquiry_coordinator']) then raise exception 'Access denied.';end if;
 return exists(select 1 from website_push_jobs j join website_notifications n on n.id=j.notification_id join website_push_subscriptions s on s.id=j.subscription_id where n.id=notice and n.user_id=auth.uid() and s.user_id=auth.uid() and s.endpoint=endpoint and j.status='Sent');
end $$;

create table if not exists website_dispatch_runs(id bigint generated always as identity primary key,finished_at timestamptz not null default now(),sent integer not null,emails integer not null,failed boolean not null);
alter table website_dispatch_runs enable row level security;
revoke all on website_dispatch_runs from public,anon,authenticated;
create or replace function record_website_dispatch(sent integer,emails integer,failed boolean) returns void language sql security definer set search_path=public as $$insert into website_dispatch_runs(sent,emails,failed) values(sent,emails,failed);delete from website_dispatch_runs where finished_at<now()-interval '30 days';delete from website_submission_keys where created_at<now()-interval '24 hours'$$;
create or replace function website_delivery_health() returns jsonb language plpgsql security definer set search_path=public as $$begin
 if not website_role(array['administrator']) then raise exception 'Access denied.';end if;
 return jsonb_build_object('push_pending',(select count(*) from website_push_jobs where status in ('Pending','Sending')),'push_failed',(select count(*) from website_push_jobs where status='Failed'),'email_pending',(select count(*) from website_email_outbox where status in ('Pending','Sending','Failed')),'email_review',(select count(*) from website_email_outbox where status='Needs review'),'oldest_email',(select min(created_at) from website_email_outbox where status in ('Pending','Sending','Failed')),'last_dispatch',(select to_jsonb(r)-'id' from website_dispatch_runs r order by finished_at desc limit 1));
end $$;
revoke all on function claim_website_email_v2(uuid),finish_website_email_v2(uuid,uuid,text,text),website_due_email(),claim_website_push_v2(uuid,text),finish_website_push_v2(uuid,uuid,text),record_website_dispatch(integer,integer,boolean),website_delivery_health(),queue_website_test(),website_test_delivery(uuid,text) from public,anon,authenticated;
grant execute on function claim_website_email_v2(uuid),finish_website_email_v2(uuid,uuid,text,text),website_due_email(),claim_website_push_v2(uuid,text),finish_website_push_v2(uuid,uuid,text),record_website_dispatch(integer,integer,boolean) to service_role;
grant execute on function website_delivery_health(),queue_website_test(),website_test_delivery(uuid,text) to authenticated;
commit;
