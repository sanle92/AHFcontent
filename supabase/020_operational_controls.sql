begin;
create table if not exists website_operational_metrics(day date not null default current_date,metric text not null,count bigint not null default 1,primary key(day,metric));
create table if not exists website_csp_limits(day date not null,tag text not null,count integer not null default 1,primary key(day,tag));
create table if not exists website_maintenance_state(name text primary key,finished_at timestamptz not null default now());
alter table website_operational_metrics enable row level security;
alter table website_csp_limits enable row level security;
alter table website_maintenance_state enable row level security;
revoke all on website_operational_metrics,website_csp_limits,website_maintenance_state from public,anon,authenticated;
create or replace function website_metric(p_metric text) returns void language sql security definer set search_path=public as $$
 insert into website_operational_metrics(day,metric) values(current_date,left(p_metric,50)) on conflict(day,metric) do update set count=website_operational_metrics.count+1
$$;
revoke all on function website_metric(text) from public,anon,authenticated;
create or replace function record_website_visit(p jsonb,request_tag text) returns void language plpgsql security definer set search_path=public as $$declare n integer;begin
 if length(p->>'id')<>64 or length(p->>'visitor')<>64 or p->>'action' not in ('view','heartbeat','giving','merchandise','volunteer','partner','kids') or length(p->>'path')>180 then raise exception 'Invalid content.';end if;
 perform pg_advisory_xact_lock(hashtextextended(p->>'visitor',0));
 if exists(select 1 from website_visit_revocations where visitor=p->>'visitor' and expires_at>now()) then return;end if;
 insert into website_engagement_limits(day,tag) values(current_date,request_tag) on conflict(day,tag) do update set count=website_engagement_limits.count+1 returning count into n;
 if n>2000 then perform website_metric('analytics_rate_dropped');return;end if;
 insert into website_visits(id,visitor,country,region,city,device,browser,referrer,last_path) values(p->>'id',p->>'visitor',left(p->>'country',2),left(p->>'region',80),left(p->>'city',80),left(p->>'device',20),left(p->>'browser',30),left(p->>'referrer',100),p->>'path') on conflict(id) do update set last_seen=now(),last_path=excluded.last_path where website_visits.visitor=excluded.visitor;
 if p->>'action'<>'heartbeat' then
  if (select count(*) from website_visit_events where visit=p->>'id')<500 then insert into website_visit_events(visit,path,action) values(p->>'id',p->>'path',p->>'action');
  else perform website_metric('analytics_session_dropped');end if;
 end if;
end $$;
create or replace function record_website_csp(p_directive text,p_tag text) returns void language plpgsql security definer set search_path=public as $$declare n integer;begin
 if p_directive not in ('default-src','script-src','script-src-elem','script-src-attr','style-src','style-src-elem','style-src-attr','connect-src','img-src','media-src','font-src','frame-src','worker-src','frame-ancestors','base-uri','form-action','object-src') or length(p_tag)<>64 then raise exception 'Invalid content.';end if;
 insert into website_csp_limits(day,tag) values(current_date,p_tag) on conflict(day,tag) do update set count=website_csp_limits.count+1 returning count into n;
 if n<=1000 then perform website_metric('csp/'||p_directive);end if;
end $$;
revoke all on function record_website_csp(text,text) from public,anon,authenticated;
grant execute on function record_website_csp(text,text) to service_role;
-- Wrap previous pruning without modifying already-applied migrations.
do $$begin if to_regprocedure('public.prune_website_visits_v1()') is null then alter function prune_website_visits() rename to prune_website_visits_v1;end if;end $$;
create or replace function prune_website_visits() returns void language plpgsql security definer set search_path=public as $$begin
 perform prune_website_visits_v1();
 delete from website_operational_metrics where day<current_date-30;
 delete from website_csp_limits where day<current_date-1;
 insert into website_maintenance_state values('prune',now()) on conflict(name) do update set finished_at=excluded.finished_at;
end $$;
revoke all on function prune_website_visits(),prune_website_visits_v1() from public,anon,authenticated;
grant execute on function prune_website_visits() to service_role;
create or replace function website_due_reminders() returns void language plpgsql security definer set search_path=public as $$declare e website_enquiries;c content_items;day_key text:=to_char(now() at time zone 'Africa/Kampala','YYYY-MM-DD');begin
 for e in select * from website_enquiries where status<>'Closed' and follow_up_at<=now() order by follow_up_at limit 50 loop
  perform website_notice(array['administrator','enquiry_coordinator'],'due/'||e.id||'/'||day_key,'enquiry','An enquiry follow-up is due.',e.assigned_to);
  if e.follow_up_at<now()-interval '1 day' then perform website_notice(array['administrator'],'overdue/'||e.id||'/'||day_key,'enquiry','An overdue enquiry needs coordination.');end if;
 end loop;
 for c in select * from content_items where kind='campaign' and status in ('Published','Scheduled','Approved') and coalesce(details->>'campaign_status','')<>'Completed' and (nullif(details->>'figures_date','') is null or (details->>'figures_date')::timestamptz<now()-interval '30 days') order by updated_at limit 50 loop
  perform website_notice(array['administrator'],'campaign-review/'||c.id||'/'||day_key,'maintenance','Campaign information needs a staff review.');
 end loop;
end $$;
-- Anonymization requires an administrator, a policy cutoff and explicit confirmation.
alter table website_enquiries add column if not exists retention_hold boolean not null default false;
alter table website_enquiries add column if not exists anonymized_at timestamptz;
create or replace function website_retention(p_before timestamptz,p_apply boolean default false,p_confirmation text default '') returns jsonb language plpgsql security definer set search_path=public as $$declare n integer;begin
 if not website_role(array['administrator']) then raise exception 'Access denied.';end if;
 if p_before is null or p_before>=now() then raise exception 'Invalid content.';end if;
 select count(*) into n from website_enquiries where created_at<p_before and status='Closed' and not retention_hold and anonymized_at is null and not exists(select 1 from website_email_outbox active_mail where active_mail.enquiry_id=website_enquiries.id and active_mail.status='Sending' and active_mail.lease_until>now());
 if p_apply then
  if p_confirmation<>'ANONYMIZE CLOSED ENQUIRIES' then raise exception 'Confirm retention processing.';end if;
  with eligible as(select id from website_enquiries where created_at<p_before and status='Closed' and not retention_hold and anonymized_at is null and not exists(select 1 from website_email_outbox active_mail where active_mail.enquiry_id=website_enquiries.id and active_mail.status='Sending' and active_mail.lease_until>now()) for update),changed as(update website_enquiries set name='[Anonymized]',email=id::text||'@invalid.example',phone='',message='[Anonymized under retention policy]',internal_note='',ip_tag='',anonymized_at=now(),version=version+1 where id in(select id from eligible) returning id)
  update enquiry_audit set note='[Personal note removed under retention policy]' where enquiry_id in(select id from changed);
  update website_email_outbox set message='',last_error='Personal content removed under retention policy',status=case when status='Accepted' then status else 'Needs review' end,lease_token=null,lease_until=null where enquiry_id in(select id from website_enquiries where anonymized_at is not null and created_at<p_before);
  insert into enquiry_audit(enquiry_id,actor_id,status,note) select id,auth.uid(),status,'Policy anonymization applied.' from website_enquiries where anonymized_at=now();
 end if;
 return jsonb_build_object('eligible',n,'applied',p_apply,'before',p_before);
end $$;
create or replace function website_retention_hold(p_id uuid,p_hold boolean) returns void language plpgsql security definer set search_path=public as $$begin
 if not website_role(array['administrator']) then raise exception 'Access denied.';end if;
 update website_enquiries set retention_hold=p_hold,version=version+1 where id=p_id;
 if not found then raise exception 'Invalid content.';end if;
 insert into enquiry_audit(enquiry_id,actor_id,status,note) select id,auth.uid(),status,'Retention hold changed to '||p_hold from website_enquiries where id=p_id;
end $$;
revoke all on function website_retention(timestamptz,boolean,text),website_retention_hold(uuid,boolean) from public,anon,authenticated;
grant execute on function website_retention(timestamptz,boolean,text),website_retention_hold(uuid,boolean) to authenticated;
create or replace function website_orphan_media() returns jsonb language plpgsql security invoker set search_path=public as $$begin
 if not website_role(array['administrator']) then raise exception 'Access denied.';end if;
 return (select coalesce(jsonb_agg(x),'[]') from(select m.id,m.filename,m.created_at,m.status from website_media m where m.created_at<now()-interval '7 days' and not exists(select 1 from content_items c where c.cover_id=m.id or c.details->>'video_id'=m.id::text or coalesce(nullif(c.details->>'gallery',''),'[]')::jsonb ? m.id::text) and not exists(select 1 from publications p where p.snapshot->>'cover_id'=m.id::text or p.snapshot->'details'->>'video_id'=m.id::text or coalesce(nullif(p.snapshot->'details'->>'gallery',''),'[]')::jsonb ? m.id::text) and not exists(select 1 from content_revisions r where r.snapshot->>'cover_id'=m.id::text or r.snapshot->'details'->>'video_id'=m.id::text or coalesce(nullif(r.snapshot->'details'->>'gallery',''),'[]')::jsonb ? m.id::text) order by m.created_at limit 100)x);
end $$;
revoke all on function website_orphan_media() from public,anon,authenticated;
grant execute on function website_orphan_media() to authenticated;
do $$begin if to_regprocedure('public.website_delivery_health_v1()') is null then alter function website_delivery_health() rename to website_delivery_health_v1;end if;end $$;
create or replace function website_delivery_health() returns jsonb language plpgsql security definer set search_path=public as $$begin
 if not website_role(array['administrator']) then raise exception 'Access denied.';end if;
 return website_delivery_health_v1()||jsonb_build_object('maintenance',(select to_jsonb(m) from website_maintenance_state m where name='prune'),'quality',(select coalesce(jsonb_object_agg(metric,count),'{}') from website_operational_metrics where day=current_date));
end $$;
revoke all on function website_delivery_health(),website_delivery_health_v1() from public,anon,authenticated;
grant execute on function website_delivery_health() to authenticated;
create or replace function defer_website_job(p_kind text,p_id uuid,p_lease uuid,p_seconds integer) returns void language plpgsql security definer set search_path=public as $$begin
 if p_seconds<1 or p_seconds>86400 then raise exception 'Invalid content.';end if;
 if p_kind='email' then update website_email_outbox set next_attempt=greatest(next_attempt,now()+p_seconds*interval '1 second') where id=p_id and status='Sending' and lease_token=p_lease;
 elsif p_kind='push' then update website_push_jobs set next_attempt=greatest(next_attempt,now()+p_seconds*interval '1 second') where id=p_id and status='Sending' and lease_token=p_lease;
 else raise exception 'Invalid content.';end if;
end $$;
revoke all on function defer_website_job(text,uuid,uuid,integer) from public,anon,authenticated;
grant execute on function defer_website_job(text,uuid,uuid,integer) to service_role;
do $$declare definition text;begin
 select pg_get_functiondef('finish_website_email_v2(uuid,uuid,text,text)'::regprocedure) into definition;
 definition:=replace(definition,$patch$next_attempt=now()+least(60,power(2,attempts)) * interval '1 minute'$patch$,$patch$next_attempt=greatest(next_attempt,now()+least(60,power(2,attempts))*(0.8+random()*0.4)*interval '1 minute')$patch$);
 execute definition;
 select pg_get_functiondef('finish_website_push_v2(uuid,uuid,text)'::regprocedure) into definition;
 definition:=replace(definition,$patch$next_attempt=now()+least(30,power(2,attempts))*interval '1 minute'$patch$,$patch$next_attempt=greatest(next_attempt,now()+least(30,power(2,attempts))*(0.8+random()*0.4)*interval '1 minute')$patch$);
 execute definition;
end $$;
create or replace function website_due_email() returns table(enquiry_id uuid) language sql security definer set search_path=public as $$
 select o.enquiry_id from website_email_outbox o where o.next_attempt<=now() and (o.status in ('Pending','Failed') or (o.status='Sending' and o.lease_until<now())) group by o.enquiry_id order by min(o.created_at) limit 4
$$;
-- Historical metrics are event based; expose data quality without a second tracker.
do $$begin if to_regprocedure('public.website_analytics_events(timestamptz,timestamptz,text,integer)') is null then alter function website_analytics(timestamptz,timestamptz,text,integer) rename to website_analytics_events;end if;end $$;
create or replace function website_analytics(start_at timestamptz,end_at timestamptz,selected_country text default '',page_offset integer default 0) returns jsonb language plpgsql security definer set search_path=public as $$begin
 if not website_role(array['administrator']) then raise exception 'Access denied.';end if;
 return website_analytics_events(start_at,end_at,selected_country,page_offset)||jsonb_build_object('quality_today',(select coalesce(jsonb_object_agg(metric,count),'{}') from website_operational_metrics where day=current_date and metric like 'analytics_%'));
end $$;
revoke all on function website_analytics(timestamptz,timestamptz,text,integer),website_analytics_events(timestamptz,timestamptz,text,integer) from public,anon,authenticated;
grant execute on function website_analytics(timestamptz,timestamptz,text,integer) to authenticated;
commit;

