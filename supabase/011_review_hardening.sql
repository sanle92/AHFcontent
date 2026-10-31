-- Website content project only. Existing migrations remain unchanged.
begin;
create index if not exists website_visits_first_seen_idx on public.website_visits(first_seen);
-- Escape literal hostname dots in every allowlisted provider. Re-running is a no-op.
do $$declare definition text;begin
 select pg_get_functiondef('public.save_website_push(jsonb,boolean)'::regprocedure) into definition;
 definition:=replace(definition,'fcm.googleapis.com','fcm\.googleapis\.com');
 definition:=replace(definition,'updates.push.services.mozilla.com','updates\.push\.services\.mozilla\.com');
 definition:=replace(definition,'\.push.apple.com','\.push\.apple\.com');
 definition:=replace(definition,'\.notify.windows.com','\.notify\.windows\.com');
 execute definition;
 select pg_get_functiondef('public.record_website_visit(jsonb,text)'::regprocedure) into definition;
 definition:=replace(definition,$old$delete from website_visit_events where created_at<now()-interval '30 days';$old$,'');
 definition:=replace(definition,$old$delete from website_visits where first_seen<now()-interval '30 days' or last_seen<now()-interval '30 days';$old$,'');
 definition:=replace(definition,$old$delete from website_engagement_limits where day<current_date-1;$old$,'');
 execute definition;
end $$;
create or replace function public.prune_website_visits() returns void language sql security definer set search_path=public as $$
 delete from website_visit_events where created_at<now()-interval '30 days';
 delete from website_visits where first_seen<now()-interval '30 days' or last_seen<now()-interval '30 days';
 delete from website_engagement_limits where day<current_date-1;
$$;
-- The admin read previously performed its own deletes; use the same maintenance function.
do $$declare definition text;begin
 select pg_get_functiondef('public.website_analytics(timestamptz,timestamptz,text,integer)'::regprocedure) into definition;
 definition:=replace(definition,$old$delete from website_visits where first_seen<now()-interval '30 days';delete from website_visit_events where created_at<now()-interval '30 days';$old$,'perform prune_website_visits();');
 execute definition;
end $$;
revoke all on function public.prune_website_visits() from public,anon,authenticated;
grant execute on function public.prune_website_visits() to service_role;
commit;
