begin;
create index if not exists publications_effective_idx on publications(content_id,publish_at desc,version desc) where not archived;
create index if not exists website_submission_created_idx on website_submission_keys(created_at);
create index if not exists website_dispatch_finished_idx on website_dispatch_runs(finished_at);
create or replace function website_media_references(media uuid) returns jsonb language plpgsql security invoker set search_path=public as $$begin
 if not website_role(array['administrator','editor','publisher']) then raise exception 'Access denied.';end if;
 return (select coalesce(jsonb_agg(x),'[]') from (
  select c.id,c.title,c.kind,c.slug,exists(select 1 from published_content p where p.id=c.id and (p.cover_id=media or p.details->>'video_id'=media::text or coalesce(nullif(p.details->>'gallery',''),'[]')::jsonb ? media::text)) as published_reference
  from content_items c where c.cover_id=media or c.details->>'video_id'=media::text or coalesce(nullif(c.details->>'gallery',''),'[]')::jsonb ? media::text or exists(select 1 from published_content p where p.id=c.id and (p.cover_id=media or p.details->>'video_id'=media::text or coalesce(nullif(p.details->>'gallery',''),'[]')::jsonb ? media::text)) order by c.title
 )x);
end $$;
revoke all on function website_media_references(uuid) from public,anon,authenticated;
grant execute on function website_media_references(uuid) to authenticated;
-- Legacy callers keep their existing signatures, but cannot finish or steal a v2 lease.
do $$declare definition text;begin
 if to_regprocedure('public.finish_website_push_legacy(uuid,text)') is null then alter function public.finish_website_push(uuid,text) rename to finish_website_push_legacy;end if;
 if to_regprocedure('public.finish_website_email_legacy(uuid,text,text)') is null then alter function public.finish_website_email(uuid,text,text) rename to finish_website_email_legacy;end if;
 select pg_get_functiondef('public.claim_website_push()'::regprocedure) into definition;
 definition:=replace(definition,'where j.attempts<5','where j.lease_token is null and j.attempts<5');execute definition;
 select pg_get_functiondef('public.claim_website_email(uuid)'::regprocedure) into definition;
 definition:=replace(definition,'where enquiry_id=enquiry and attempts<6','where enquiry_id=enquiry and lease_token is null and attempts<6');execute definition;
 select pg_get_functiondef('public.claim_website_email_v2(uuid)'::regprocedure) into definition;
 definition:=replace(definition,'attempts>=6 and lease_until<now()','attempts>=6 and (status=''Failed'' or lease_until<now())');execute definition;
end $$;
create or replace function finish_website_push(job uuid,result text) returns void language plpgsql security definer set search_path=public as $$begin
 perform 1 from website_push_jobs where id=job and status='Sending' and lease_token is null for update;
 if found then perform finish_website_push_legacy(job,result);end if;
end $$;
create or replace function finish_website_email(mail_id uuid,provider text,error_text text) returns void language plpgsql security definer set search_path=public as $$begin
 perform 1 from website_email_outbox where id=mail_id and status='Sending' and lease_token is null for update;
 if found then perform finish_website_email_legacy(mail_id,provider,error_text);end if;
end $$;
revoke all on function finish_website_push_legacy(uuid,text),finish_website_email_legacy(uuid,text,text) from public,anon,authenticated,service_role;
revoke all on function finish_website_push(uuid,text),finish_website_email(uuid,text,text) from public,anon,authenticated;
grant execute on function finish_website_push(uuid,text),finish_website_email(uuid,text,text) to service_role;
commit;
