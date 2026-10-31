begin;
create or replace function website_publication_state(p_ids uuid[]) returns table(content_id uuid,publish_at timestamptz,version integer) language plpgsql security invoker set search_path=public as $$begin
 if not website_role(array['administrator','editor','publisher']) then raise exception 'Access denied.';end if;
 if cardinality(p_ids)>200 then raise exception 'Invalid content.';end if;
 return query select distinct on(p.content_id) p.content_id,p.publish_at,p.version from publications p where p.content_id=any(p_ids) and not p.archived and p.publish_at<=now() order by p.content_id,p.publish_at desc,p.version desc;
end $$;
revoke all on function website_publication_state(uuid[]) from public,anon,authenticated;
grant execute on function website_publication_state(uuid[]) to authenticated;
-- Filter by effective state, without changing stored workflow or approval versions.
do $$declare definition text;begin
 select pg_get_functiondef('website_workspace(text,integer,text,text,text,text,text)'::regprocedure) into definition;
 definition:=replace(definition,$old$select * from content_items where (p_kind='All' or kind=p_kind) and (p_status='All' or status=p_status)$old$,$new$select * from content_items where (p_kind='All' or kind=p_kind) and (p_status='All' or
 (p_status='Published' and (status='Published' or status='Scheduled' and exists(select 1 from publications effective where effective.content_id=content_items.id and effective.version=content_items.version and not effective.archived and effective.publish_at<=now()))) or
 (p_status='Scheduled' and status='Scheduled' and not exists(select 1 from publications effective where effective.content_id=content_items.id and effective.version=content_items.version and not effective.archived and effective.publish_at<=now())) or
 (p_status not in ('Published','Scheduled') and status=p_status))$new$);
 execute definition;
end $$;
create index if not exists website_content_workspace_idx on content_items(kind,status,updated_at desc,id);
create index if not exists website_media_workspace_idx on website_media(created_at desc,id);
create index if not exists website_enquiry_retention_idx on website_enquiries(created_at) where status='Closed' and not retention_hold and anonymized_at is null;
commit;
