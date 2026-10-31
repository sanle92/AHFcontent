begin;
create index if not exists website_visit_events_visit_created_idx on website_visit_events(visit,created_at desc);
create or replace function public.website_analytics(start_at timestamptz,end_at timestamptz,selected_country text default '',page_offset integer default 0) returns jsonb language plpgsql security definer set search_path=public as $$declare result jsonb;begin
 if not website_role(array['administrator']) then raise exception 'Access denied.';end if;
 if start_at is null or end_at is null or end_at<=start_at or end_at-start_at>interval '91 days' or page_offset<0 then raise exception 'Invalid content.';end if;
 perform prune_website_visits();
 with active_visits as(select * from website_visits where first_seen<end_at and last_seen>=start_at and (selected_country='' or country=selected_country)),
 started_visits as(select * from active_visits where first_seen>=start_at),
 events as(select e.* from website_visit_events e join active_visits v on v.id=e.visit where e.created_at>=start_at and e.created_at<end_at)
 select jsonb_build_object('sessions',(select count(*) from started_visits),'visitors',(select count(distinct visitor) from active_visits),'live',(select count(*) from website_visits where last_seen>now()-interval '2 minutes' and (selected_country='' or country=selected_country)),'pageviews',(select count(*) from events where action='view'),'actions',(select count(*) from events where action not in ('view','heartbeat')),'countries',(select coalesce(jsonb_agg(x),'[]') from(select country,count(*) sessions from started_visits group by country order by count(*) desc limit 30)x),'pages',(select coalesce(jsonb_agg(x),'[]') from(select path,count(*) views from events where action='view' group by path order by count(*) desc limit 20)x),'days',(select coalesce(jsonb_agg(x),'[]') from(select (created_at at time zone 'Africa/Kampala')::date as "day",count(*) views from events where action='view' group by 1 order by 1)x),'history',(select coalesce(jsonb_agg(x),'[]') from(select id,country,region,city,device,browser,referrer,first_seen,last_seen,last_path from active_visits order by last_seen desc limit 50 offset least(page_offset,10000))x)) into result;return result;
end $$;
create or replace function website_engagement_summary() returns table(day date,action text,count bigint) language plpgsql security definer set search_path=public as $$begin
 if not website_role(array['administrator','editor','publisher']) then raise exception 'Access denied.';end if;
 return query select (e.created_at at time zone 'Africa/Kampala')::date,e.action,count(*) from website_visit_events e where e.action not in ('view','heartbeat') and e.created_at>=now()-interval '30 days' group by 1,2 order by 1 desc;
end $$;
revoke all on function website_engagement_summary() from public,anon,authenticated;
grant execute on function website_engagement_summary() to authenticated;
commit;
