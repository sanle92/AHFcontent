-- Upgrade the WEBSITE CONTENT project after 001 and 002. Never the private NGO project.
begin;
alter table content_items drop constraint content_items_kind_check;
alter table content_items add constraint content_items_kind_check check(kind in ('page','programme','story','event','report','campaign','product','album'));
alter function validate_website_content(jsonb) rename to validate_website_content_v1;
create function validate_website_content(p jsonb) returns void language plpgsql set search_path=public as $$
declare d jsonb:=p->'details';base jsonb; k text;v text;g jsonb;x jsonb;mid uuid;
extras text[]:=array['scope','activity','programme_id','campaign_id','programme_status','objectives','activities','participation','video_id','gallery','campaign_status','button_label','pillar_url','spotfund_url','gofundme_url','target','raised','figures_date','updates','end_date','event_status','capacity','registration_url','category','reporting_period','document_version','variants','availability','fulfilment','proceeds','seo_title','seo_description','contact_email','contact_phone','contact_address','facebook_url','instagram_url','linkedin_url','confirmation_message'];
begin
 if jsonb_typeof(d) is distinct from 'object' or coalesce(p->>'kind','') not in ('page','programme','story','event','report','campaign','product','album') or p->>'title' is null or p->>'slug' is null or p->>'summary' is null or p->>'body' is null then raise exception 'Invalid content.';end if;
 base:=p; if p->>'kind'='album' then base:=jsonb_set(base,'{kind}','"story"');end if;
 perform validate_website_content_v1(jsonb_set(base,'{details}',d-extras));
 for k,v in select key,value #>> '{}' from jsonb_each(d) where key=any(extras) loop
  if jsonb_typeof(d->k)<>'string' or length(v)>(case when k='updates' then 6000 else 3000 end) then raise exception 'Invalid content.';end if;
 end loop;
 if coalesce(d->>'scope','foundation') not in ('foundation','aminia-kids') then raise exception 'Invalid content.';end if;
 if coalesce(d->>'pillar_url','')<>'' and d->>'pillar_url'!~'^https://([a-zA-Z0-9-]+\.)*pillar\.io(/|$)' then raise exception 'Invalid content.';end if;
 if coalesce(d->>'spotfund_url','')<>'' and d->>'spotfund_url'!~'^https://([a-zA-Z0-9-]+\.)*spotfund\.com(/|$)' then raise exception 'Invalid content.';end if;
 if coalesce(d->>'gofundme_url','')<>'' and d->>'gofundme_url'!~'^https://([a-zA-Z0-9-]+\.)*gofundme\.com(/|$)' then raise exception 'Invalid content.';end if;
 foreach k in array array['registration_url','facebook_url','instagram_url','linkedin_url'] loop if coalesce(d->>k,'')<>'' and d->>k!~'^https://' then raise exception 'Invalid content.';end if;end loop;
 foreach k in array array['price','target','raised','capacity'] loop if coalesce(d->>k,'')<>'' and (d->>k!~'^[0-9]+(\.[0-9]{1,2})?$' or (d->>k)::numeric>1e12) then raise exception 'Invalid content.';end if;end loop;
 foreach k in array array['date','end_date','figures_date'] loop if coalesce(d->>k,'')<>'' then perform (d->>k)::timestamptz;end if;end loop;
 if coalesce(d->>'end_date','')<>'' and coalesce(d->>'date','')<>'' and (d->>'end_date')::timestamptz<=(d->>'date')::timestamptz then raise exception 'Invalid content.';end if;
 foreach k in array array['programme_id','campaign_id','video_id'] loop if coalesce(d->>k,'')<>'' then mid:=(d->>k)::uuid;
  if k='video_id' then if not exists(select 1 from website_media where id=mid and status='Approved' and mime='video/external') then raise exception 'Choose approved media before publication.';end if;
  elsif not exists(select 1 from content_items where id=mid and kind=(case when k='programme_id' then 'programme' else 'campaign' end)) then raise exception 'Invalid content.';end if;
 end if;end loop;
 if coalesce(d->>'gallery','')<>'' then g:=(d->>'gallery')::jsonb;if jsonb_typeof(g)<>'array' or jsonb_array_length(g)>40 then raise exception 'Invalid content.';end if;
  for x in select * from jsonb_array_elements(g) loop mid:=(x #>> '{}')::uuid;
   if not exists(select 1 from website_media where id=mid and status='Approved' and mime in ('image/jpeg','image/png')) then raise exception 'Choose approved media before publication.';end if;
  end loop;
 end if;
 if coalesce(d->>'updates','')<>'' then g:=(d->>'updates')::jsonb;if jsonb_typeof(g)<>'array' or jsonb_array_length(g)>12 then raise exception 'Invalid content.';end if;
 for x in select * from jsonb_array_elements(g) loop if jsonb_typeof(x->'date') is distinct from 'string' or jsonb_typeof(x->'text') is distinct from 'string' or length(x->>'text')>1500 then raise exception 'Invalid content.';end if;perform (x->>'date')::date;end loop;end if;
end $$;
create policy publications_editorial_read on publications for select to authenticated using(website_role(array['administrator','editor','publisher']));
revoke all on function validate_website_content(jsonb) from public,anon,authenticated;
alter table website_media drop constraint website_media_mime_check;
alter table website_media add constraint website_media_mime_check check(mime in ('image/jpeg','image/png','application/pdf','video/external'));
alter table website_media add column external_url text not null default '';
create function register_website_video(video_url text,title text) returns website_media language plpgsql security definer set search_path=public as $$declare r website_media;begin
 if not website_role(array['administrator','editor']) then raise exception 'Access denied.';end if;
 if length(title) not between 3 and 180 or length(video_url)>500 or video_url!~'^https://(www\.)?(youtube\.com/watch\?v=[a-zA-Z0-9_-]{11}|youtube\.com/shorts/[a-zA-Z0-9_-]{11}|youtu\.be/[a-zA-Z0-9_-]{11}|vimeo\.com/[0-9]{5,12})$' then raise exception 'Invalid content.';end if;
 insert into website_media(object_path,filename,mime,created_by,external_url) values('external/'||gen_random_uuid(),title,'video/external',auth.uid(),video_url) returning * into r;return r;
end $$;
create function website_public_video(media_id uuid) returns table(external_url text,alt_text text,caption text) language sql stable security definer set search_path=public as $$select m.external_url,m.alt_text,m.caption from website_media m where m.id=media_id and m.mime='video/external' and m.status='Approved' and m.rights_confirmed and (not m.shows_children or (m.guardian_consent and length(m.consent_reference)>2))$$;
create function website_public_assets(media_ids uuid[]) returns table(id uuid,mime text,alt_text text,caption text) language sql stable security definer set search_path=public as $$select m.id,m.mime,m.alt_text,m.caption from website_media m where m.id=any(media_ids[1:200]) and m.status='Approved' and m.rights_confirmed and (not m.shows_children or (m.guardian_consent and length(m.consent_reference)>2))$$;
create function website_public_caption(media_id uuid) returns table(alt_text text,caption text) language sql stable security definer set search_path=public as $$select m.alt_text,m.caption from website_media m where m.id=media_id and m.status='Approved' and m.rights_confirmed and (not m.shows_children or (m.guardian_consent and length(m.consent_reference)>2))$$;
revoke all on function register_website_video(text,text) from public,anon,authenticated;grant execute on function register_website_video(text,text) to authenticated;

alter table website_enquiries drop constraint website_enquiries_kind_check;
alter table website_enquiries add constraint website_enquiries_kind_check check(kind in ('contact','volunteer','partner','aminia-kids','support','merchandise','event'));
alter table website_enquiries add column assigned_to uuid references website_profiles(id);
alter table website_enquiries add column follow_up_at timestamptz;
create function assign_website_enquiry(record_id uuid,expected_version integer,assignee uuid,due_at timestamptz) returns website_enquiries language plpgsql security definer set search_path=public as $$declare r website_enquiries;begin
 if not website_role(array['administrator','enquiry_coordinator']) then raise exception 'Access denied.';end if;
 if assignee is not null and not exists(select 1 from website_profiles where id=assignee and active and roles&&array['administrator','enquiry_coordinator']) then raise exception 'Access denied.';end if;
 select * into r from website_enquiries where id=record_id for update;if not found or r.version is distinct from expected_version then raise exception 'Record changed; reload.';end if;
 update website_enquiries set assigned_to=assignee,follow_up_at=due_at,version=version+1 where id=record_id returning * into r;
 insert into enquiry_audit(enquiry_id,actor_id,status,note) values(r.id,auth.uid(),r.status,'Assignment / follow-up updated');return r;
end $$;
revoke all on function assign_website_enquiry(uuid,integer,uuid,timestamptz) from public,anon,authenticated;grant execute on function assign_website_enquiry(uuid,integer,uuid,timestamptz) to authenticated;

create table website_email_outbox(id uuid primary key default gen_random_uuid(),enquiry_id uuid not null references website_enquiries(id),kind text not null check(kind in ('confirmation','staff')),status text not null default 'Pending' check(status in ('Pending','Sending','Accepted','Failed','Needs review')),attempts integer not null default 0,lease_until timestamptz,first_attempt_at timestamptz,provider_id text,message text not null default '',last_error text not null default '',created_at timestamptz not null default now(),unique(enquiry_id,kind));
alter table website_email_outbox enable row level security;
create policy email_staff_read on website_email_outbox for select to authenticated using(website_role(array['administrator','enquiry_coordinator']));
revoke all on website_email_outbox from anon,authenticated;grant select on website_email_outbox to authenticated;
create function enqueue_website_email() returns trigger language plpgsql security definer set search_path=public as $$begin insert into website_email_outbox(enquiry_id,kind) values(new.id,'confirmation'),(new.id,'staff'); update website_email_outbox set message=coalesce((select details->>'confirmation_message' from published_content where kind='page' and slug='site-settings' limit 1),'') where enquiry_id=new.id and kind='confirmation';return new;end $$;
create trigger website_enquiry_email after insert on website_enquiries for each row execute function enqueue_website_email();
create function claim_website_email(enquiry uuid) returns setof website_email_outbox language plpgsql security definer set search_path=public as $$begin
 update website_email_outbox set status='Needs review',last_error='Retry window expired; check provider records before resending.' where enquiry_id=enquiry and status in ('Sending','Failed') and first_attempt_at<now()-interval '23 hours';
 return query update website_email_outbox set status='Sending',lease_until=now()+interval '2 minutes',attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,now()) where enquiry_id=enquiry and attempts<6 and (status in ('Pending','Failed') or (status='Sending' and lease_until<now())) returning *;
end $$;
create function finish_website_email(mail_id uuid,provider text,error_text text) returns void language sql security definer set search_path=public as $$update website_email_outbox set status=case when provider is not null then 'Accepted' else 'Failed' end,provider_id=provider,last_error=left(coalesce(error_text,''),300),lease_until=null where id=mail_id and status='Sending'$$;
revoke all on function enqueue_website_email(),claim_website_email(uuid),finish_website_email(uuid,text,text) from public,anon,authenticated;
grant execute on function claim_website_email(uuid),finish_website_email(uuid,text,text) to service_role;
grant select on website_enquiries,website_email_outbox to service_role;
commit;
