begin;
-- Invoker privileges and existing table RLS remain authoritative.
create or replace function website_workspace(p_resource text,p_page integer default 0,p_query text default '',p_status text default 'All',p_kind text default 'All',p_scope text default '',p_assignee text default 'All') returns jsonb language plpgsql security invoker set search_path=public as $$declare result jsonb;begin
 if p_page<0 or p_page>100000 or length(p_query)>100 or p_resource not in ('content','media','enquiries') then raise exception 'Invalid content.';end if;
 if not website_role(array['administrator','editor','publisher','enquiry_coordinator']) then raise exception 'Access denied.';end if;
 if p_resource='content' then
  if not website_role(array['administrator','editor','publisher']) then raise exception 'Access denied.';end if;
  with filtered as(select * from content_items where (p_kind='All' or kind=p_kind) and (p_status='All' or status=p_status) and (p_scope='' or details->>'scope'=p_scope or slug='aminia-kids') and position(lower(p_query) in lower(title||' '||slug||' '||summary))>0), page as(select * from filtered order by updated_at desc,id limit 50 offset p_page*50)
  select jsonb_build_object('total',(select count(*) from filtered),'rows',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]')) into result;
 elsif p_resource='media' then
  if not website_role(array['administrator','editor','publisher']) then raise exception 'Access denied.';end if;
  with filtered as(select * from website_media where (p_status='All' or status=p_status) and position(lower(p_query) in lower(filename||' '||alt_text||' '||caption))>0),page as(select * from filtered order by created_at desc,id limit 50 offset p_page*50)
  select jsonb_build_object('total',(select count(*) from filtered),'rows',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]')) into result;
 else
  if not website_role(array['administrator','enquiry_coordinator']) then raise exception 'Access denied.';end if;
  with filtered as(select * from website_enquiries where (p_status='All' or p_status='Open' and status<>'Closed' or status=p_status) and (p_kind='All' or kind=p_kind) and (p_assignee='All' or p_assignee='Unassigned' and assigned_to is null or assigned_to::text=p_assignee) and position(lower(p_query) in lower(name||' '||email||' '||message))>0),page as(select * from filtered order by created_at desc,id limit 50 offset p_page*50)
  select jsonb_build_object('total',(select count(*) from filtered),'rows',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]')) into result;
 end if;return result;
end $$;
create or replace function website_workspace_summary() returns jsonb language plpgsql security invoker set search_path=public as $$begin
 if not website_role(array['administrator','editor','publisher','enquiry_coordinator']) then raise exception 'Access denied.';end if;
 return jsonb_build_object('content_review',(select count(*) from content_items where status='Review'),'media_review',(select count(*) from website_media where status='Review'),'open_enquiries',(select count(*) from website_enquiries where status<>'Closed'),'upcoming_events',(select count(*) from content_items where kind='event' and nullif(details->>'date','')::timestamptz>=now()),'email_failed',(select count(*) from website_email_outbox where status in ('Failed','Needs review')),'overdue',(select count(*) from website_enquiries where status<>'Closed' and follow_up_at<now()),'campaign_checks',(select count(*) from content_items where kind='campaign' and coalesce(details->>'campaign_status','')<>'Completed' and (nullif(details->>'figures_date','') is null or (details->>'figures_date')::timestamptz<now()-interval '30 days')));
end $$;
revoke all on function website_workspace(text,integer,text,text,text,text,text),website_workspace_summary() from public,anon,authenticated;
grant execute on function website_workspace(text,integer,text,text,text,text,text),website_workspace_summary() to authenticated;
commit;
