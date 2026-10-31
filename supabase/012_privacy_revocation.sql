-- Preserve deletion while old tabs / in-flight requests finish. Content project only.
begin;
create table if not exists public.website_visit_revocations(visitor text primary key,expires_at timestamptz not null);
alter table public.website_visit_revocations enable row level security;
revoke all on public.website_visit_revocations from public,anon,authenticated;
create or replace function public.forget_website_visits(visitor_key text) returns void language plpgsql security definer set search_path=public as $$begin
 if visitor_key is null or length(visitor_key)<>64 then raise exception 'Invalid content.';end if;
 perform pg_advisory_xact_lock(hashtextextended(visitor_key,0));
 insert into website_visit_revocations values(visitor_key,now()+interval '30 days') on conflict(visitor) do update set expires_at=excluded.expires_at;
 delete from website_visits where visitor=visitor_key;
end $$;
do $$declare definition text;begin
 select pg_get_functiondef('public.record_website_visit(jsonb,text)'::regprocedure) into definition;
 if position('website_visit_revocations' in definition)=0 then
 definition:=replace(definition,'declare n integer;begin',$patch$declare n integer;begin
 perform pg_advisory_xact_lock(hashtextextended(p->>'visitor',0));
 if exists(select 1 from website_visit_revocations where visitor=p->>'visitor' and expires_at>now()) then return;end if;
 $patch$);
 execute definition;
 end if;
 select pg_get_functiondef('public.prune_website_visits()'::regprocedure) into definition;
 if position('website_visit_revocations' in definition)=0 then
 definition:=replace(definition,'delete from website_engagement_limits where day<current_date-1;','delete from website_engagement_limits where day<current_date-1; delete from website_visit_revocations where expires_at<=now();');
 execute definition;
 end if;
end $$;
revoke all on function public.forget_website_visits(text) from public,anon,authenticated;
grant execute on function public.forget_website_visits(text) to service_role;
commit;
