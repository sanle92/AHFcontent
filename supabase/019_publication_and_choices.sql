begin;
create table if not exists website_slug_redirects(kind text not null,old_slug text not null,content_id uuid not null references content_items(id),primary key(kind,old_slug));
alter table website_slug_redirects enable row level security;
revoke all on website_slug_redirects from public,anon,authenticated;
create or replace function website_public_integrity() returns trigger language plpgsql security definer set search_path=public as $$begin
 if exists(select 1 from website_slug_redirects where kind=new.kind and old_slug=new.slug and content_id<>new.id) then raise exception 'That URL belongs to another publication.';end if;
 if tg_op='UPDATE' and old.slug<>new.slug then
  if old.kind='page' and old.slug in ('home','about','programmes','aminia-kids','stories','events','transparency','impact','get-involved','donate','contact','privacy','safeguarding','shop','site-settings') then raise exception 'Fixed foundation page URLs cannot be changed.';end if;
  if exists(select 1 from publications where content_id=old.id and snapshot->>'slug'=old.slug and not archived and publish_at<=now()) then
   insert into website_slug_redirects values(old.kind,old.slug,old.id) on conflict(kind,old_slug) do nothing;
  end if;
 end if;
 if new.status in ('Review','Approved','Published','Scheduled') and coalesce(new.details->>'campaign_id','')<>'' and not exists(select 1 from published_content where id=(new.details->>'campaign_id')::uuid and kind='campaign') then raise exception 'Publish the related giving campaign first.';end if;
 return new;
end $$;
drop trigger if exists website_public_integrity on content_items;
create trigger website_public_integrity before insert or update on content_items for each row execute function website_public_integrity();
revoke all on function website_public_integrity() from public,anon,authenticated;
create or replace function resolve_website_redirect(p_kind text,p_slug text) returns text language sql stable security definer set search_path=public as $$
 select case when c.kind='programme' and c.slug='aminia-kids' then '/aminia-kids' else (case c.kind when 'page' then '' when 'programme' then '/programmes' when 'story' then '/stories' when 'event' then '/events' when 'report' then '/reports' when 'campaign' then '/campaigns' when 'product' then '/shop' when 'album' then '/albums' end)||'/'||c.slug end
 from website_slug_redirects r join published_content c on c.id=r.content_id where r.kind=p_kind and r.old_slug=p_slug and c.slug<>p_slug limit 1
$$;
revoke all on function resolve_website_redirect(text,text) from public,anon,authenticated;
grant execute on function resolve_website_redirect(text,text) to anon,authenticated;
create or replace function website_editor_choices(p_record uuid default null,p_query text default '',p_page integer default 0,p_selected uuid[] default '{}') returns jsonb language plpgsql security invoker set search_path=public as $$declare current_item content_items;media_ids uuid[];item_ids uuid[];result jsonb;begin
 if not website_role(array['administrator','editor','publisher']) then raise exception 'Access denied.';end if;
 if p_page<0 or p_page>10000 or length(p_query)>100 or cardinality(p_selected)>50 then raise exception 'Invalid content.';end if;
 if p_record is not null then select * into current_item from content_items where id=p_record;if not found then raise exception 'Access denied.';end if;end if;
 select array_agg(distinct id) into media_ids from(select current_item.cover_id id union select nullif(current_item.details->>'video_id','')::uuid union select value::uuid from jsonb_array_elements_text(coalesce(nullif(current_item.details->>'gallery',''),'[]')::jsonb) union select unnest(p_selected)) refs;
 item_ids:=array[current_item.id,nullif(current_item.details->>'programme_id','')::uuid,nullif(current_item.details->>'campaign_id','')::uuid]||p_selected;
 with matches as(select * from content_items where kind in ('programme','campaign') and position(lower(p_query) in lower(title||' '||slug))>0 order by title,id limit 50 offset p_page*50),chosen as(select * from content_items where id=any(item_ids) or id in(select id from matches))
 select jsonb_build_object('items',coalesce((select jsonb_agg(case when chosen.id=p_record then to_jsonb(chosen) else jsonb_build_object('id',id,'kind',kind,'title',title,'slug',slug,'summary','','body','','details','{}'::jsonb,'status',status,'version',version,'created_by',created_by) end) from chosen),'[]'::jsonb),'media',coalesce((select jsonb_agg(m) from website_media m where id=any(media_ids) or id in(select id from website_media where position(lower(p_query) in lower(filename||' '||alt_text||' '||caption))>0 order by created_at desc,id limit 50 offset p_page*50)),'[]'::jsonb),'has_more',exists(select 1 from content_items where kind in ('programme','campaign') and position(lower(p_query) in lower(title||' '||slug))>0 limit 1 offset (p_page+1)*50) or exists(select 1 from website_media where position(lower(p_query) in lower(filename||' '||alt_text||' '||caption))>0 limit 1 offset (p_page+1)*50)) into result;
 return result;
end $$;
revoke all on function website_editor_choices(uuid,text,integer,uuid[]) from public,anon,authenticated;
grant execute on function website_editor_choices(uuid,text,integer,uuid[]) to authenticated;
commit;
