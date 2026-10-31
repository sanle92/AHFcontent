begin;
create table public.website_notifications(id uuid primary key default gen_random_uuid(),user_id uuid not null references website_profiles(id),kind text not null,title text not null,body text not null,url text not null default '/holyghost',source_key text not null,target_roles text[] not null,read_at timestamptz,created_at timestamptz not null default now(),unique(user_id,source_key));
alter table website_notifications enable row level security;
create policy own_notifications on website_notifications for select to authenticated using(user_id=auth.uid() and website_role(target_roles));
revoke all on website_notifications from anon,authenticated;grant select on website_notifications to authenticated;
create function website_notice(audience text[],event_key text,event_kind text,heading text,recipient uuid default null) returns void language sql security definer set search_path=public as $$insert into website_notifications(user_id,kind,title,body,source_key,target_roles) select id,event_kind,heading,'Sign in to your website workspace to review the update.',event_key,audience from website_profiles where active and roles&&audience and (recipient is null or id=recipient) on conflict(user_id,source_key) do nothing$$;
create function website_notice_trigger() returns trigger language plpgsql security definer set search_path=public as $$begin
 if tg_table_name='website_enquiries' then
  if tg_op='INSERT' then perform website_notice(array['administrator','enquiry_coordinator'],'enquiry/'||new.id,'enquiry','A new website enquiry needs attention.');
  elsif new.assigned_to is distinct from old.assigned_to and new.assigned_to is not null then perform website_notice(array['administrator','enquiry_coordinator'],'assigned/'||new.id||'/'||new.version,'enquiry','An enquiry has been assigned to you.',new.assigned_to);end if;
 elsif new.status='Review' and old.status is distinct from new.status then perform website_notice(array['administrator','publisher'],tg_table_name||'/'||new.id||'/'||new.version,'review','Content or media is ready for approval.');
 elsif new.status in ('Approved','Returned','Rejected') and old.status is distinct from new.status then perform website_notice(array['administrator','editor'],tg_table_name||'/'||new.id||'/'||new.version,'review','Your content or media review has an update.',new.created_by);end if;return new;
end $$;
create trigger enquiry_notice after insert or update on website_enquiries for each row execute function website_notice_trigger();
create trigger content_notice after update on content_items for each row execute function website_notice_trigger();
create trigger media_notice after update on website_media for each row execute function website_notice_trigger();
create function read_website_notice(notice uuid) returns void language sql security definer set search_path=public as $$update website_notifications set read_at=now() where id=notice and user_id=auth.uid() and website_role(target_roles)$$;
create table public.website_push_subscriptions(id uuid primary key default gen_random_uuid(),user_id uuid not null references website_profiles(id),endpoint text not null unique,subscription jsonb not null,enabled boolean not null default true,created_at timestamptz not null default now());
alter table website_push_subscriptions enable row level security;
revoke all on website_push_subscriptions from public,anon,authenticated;
create function save_website_push(payload jsonb,remove boolean default false) returns void language plpgsql security definer set search_path=public as $$begin
 if not website_role(array['administrator','editor','publisher','enquiry_coordinator']) then raise exception 'Access denied.';end if;
 if payload->>'endpoint'!~'^https://(fcm.googleapis.com|updates.push.services.mozilla.com|[a-zA-Z0-9.-]+\.push.apple.com|[a-zA-Z0-9.-]+\.notify.windows.com)/' or length(payload->>'endpoint')>2000 then raise exception 'Invalid content.';end if;
 if remove then update website_push_subscriptions set enabled=false where user_id=auth.uid() and endpoint=payload->>'endpoint';return;end if;
 if coalesce(payload->'keys'->>'p256dh','')!~'^[a-zA-Z0-9_=-]{80,100}$' or coalesce(payload->'keys'->>'auth','')!~'^[a-zA-Z0-9_=-]{20,30}$' then raise exception 'Invalid content.';end if;
 if exists(select 1 from website_push_subscriptions where endpoint=payload->>'endpoint' and user_id<>auth.uid() and enabled) then raise exception 'Access denied.';end if;
 insert into website_push_subscriptions(user_id,endpoint,subscription) values(auth.uid(),payload->>'endpoint',payload) on conflict(endpoint) do update set user_id=auth.uid(),subscription=excluded.subscription,enabled=true;
end $$;
create table public.website_push_jobs(id uuid primary key default gen_random_uuid(),notification_id uuid not null references website_notifications(id) on delete cascade,subscription_id uuid not null references website_push_subscriptions(id),status text not null default 'Pending',attempts integer not null default 0,lease_until timestamptz,next_attempt timestamptz not null default now(),error text not null default '',unique(notification_id,subscription_id));
alter table website_push_jobs enable row level security;revoke all on website_push_jobs from public,anon,authenticated;
create function enqueue_website_push() returns trigger language plpgsql security definer set search_path=public as $$begin insert into website_push_jobs(notification_id,subscription_id) select new.id,id from website_push_subscriptions where user_id=new.user_id and enabled;return new;end $$;
create trigger website_notice_push after insert on website_notifications for each row execute function enqueue_website_push();
create function claim_website_push() returns table(job_id uuid,payload jsonb,title text,body text,url text) language plpgsql security definer set search_path=public as $$begin
 update website_push_jobs j set status='Cancelled' from website_push_subscriptions s,website_notifications n,website_profiles p where j.subscription_id=s.id and j.notification_id=n.id and p.id=s.user_id and j.status in ('Pending','Sending') and (not s.enabled or not p.active or not p.roles&&n.target_roles);
 return query with chosen as (select j.id from website_push_jobs j where j.attempts<5 and j.next_attempt<=now() and (j.status='Pending' or j.status='Sending' and j.lease_until<now()) order by j.next_attempt limit 4 for update skip locked), claimed as (update website_push_jobs set status='Sending',attempts=attempts+1,lease_until=now()+interval '2 minutes' where id in(select id from chosen) returning *) select c.id,s.subscription,n.title,n.body,n.url from claimed c join website_push_subscriptions s on s.id=c.subscription_id join website_notifications n on n.id=c.notification_id;
end $$;
create function finish_website_push(job uuid,result text) returns void language plpgsql security definer set search_path=public as $$begin
 if result='Gone' then update website_push_subscriptions set enabled=false where id=(select subscription_id from website_push_jobs where id=job);end if;
 update website_push_jobs set status=case when result='Sent' then 'Sent' when result='Gone' then 'Gone' when attempts>=5 then 'Failed' else 'Pending' end,error=case when result='Sent' then '' else left(result,200) end,next_attempt=now()+interval '5 minutes',lease_until=null where id=job and status='Sending';
end $$;
create function website_due_reminders() returns void language plpgsql security definer set search_path=public as $$declare e website_enquiries;begin for e in select * from website_enquiries where status<>'Closed' and follow_up_at<=now() and follow_up_at>now()-interval '7 days' loop perform website_notice(array['administrator','enquiry_coordinator'],'due/'||e.id||'/'||e.follow_up_at::text,'enquiry','An enquiry follow-up is due.',e.assigned_to);end loop;end $$;
revoke all on function website_notice(text[],text,text,text,uuid),website_notice_trigger(),enqueue_website_push(),claim_website_push(),finish_website_push(uuid,text),website_due_reminders(),save_website_push(jsonb,boolean),read_website_notice(uuid) from public,anon,authenticated;
grant execute on function save_website_push(jsonb,boolean),read_website_notice(uuid) to authenticated;
grant execute on function claim_website_push(),finish_website_push(uuid,text),website_due_reminders() to service_role;
commit;
