-- Optional aggregate counts. No cookies, raw IPs, individual journeys or visitor IDs.
begin;
create table website_engagement(day date not null default current_date,action text not null check(action in ('giving','merchandise','volunteer','partner','kids')),count bigint not null default 0,primary key(day,action));
create table website_engagement_limits(day date not null,tag text not null,count integer not null default 1,primary key(day,tag));
alter table website_engagement enable row level security;alter table website_engagement_limits enable row level security;
create policy engagement_read on website_engagement for select to authenticated using(website_role(array['administrator','editor','publisher']));
revoke all on website_engagement,website_engagement_limits from public,anon,authenticated;grant select on website_engagement to authenticated;
create function record_website_engagement(category text,request_tag text) returns void language plpgsql security definer set search_path=public as $$declare n integer;begin
 if category not in ('giving','merchandise','volunteer','partner','kids') or length(request_tag)<>64 then raise exception 'Invalid content.';end if;
 delete from website_engagement_limits where day<current_date-1;
 insert into website_engagement_limits(day,tag) values(current_date,request_tag) on conflict(day,tag) do update set count=website_engagement_limits.count+1 returning count into n;
 if n<=100 then insert into website_engagement(day,action,count) values(current_date,category,1) on conflict(day,action) do update set count=website_engagement.count+1;end if;
end $$;
revoke all on function record_website_engagement(text,text) from public,anon,authenticated;grant execute on function record_website_engagement(text,text) to service_role;
commit;
