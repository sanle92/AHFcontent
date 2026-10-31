-- WEBSITE CONTENT PROJECT ONLY. Do not apply to the private management project.
begin;
create table public.website_profiles(id uuid primary key references auth.users(id),name text not null,roles text[] not null check(roles<@array['administrator','editor','publisher','enquiry_coordinator']),active boolean not null default true);
alter table public.website_profiles enable row level security;
create function public.website_role(wanted text[]) returns boolean language sql stable security definer set search_path=public as $$select coalesce(auth.jwt()->>'aal'='aal2',false) and exists(select 1 from website_profiles where id=auth.uid() and active and roles&&wanted)$$;
create policy staff_read on website_profiles for select to authenticated using(website_role(array['administrator','editor','publisher','enquiry_coordinator']));
create table public.website_media(id uuid primary key default gen_random_uuid(),object_path text not null unique,filename text not null,mime text not null check(mime in ('image/jpeg','image/png','application/pdf')),alt_text text not null default '',caption text not null default '',shows_children boolean not null default true,rights_confirmed boolean not null default false,guardian_consent boolean not null default false,consent_reference text not null default '',status text not null default 'Draft',created_by uuid references website_profiles(id),reviewed_by uuid references website_profiles(id),version integer not null default 1,created_at timestamptz not null default now());
alter table website_media enable row level security;
create policy media_staff on website_media for select to authenticated using(website_role(array['administrator','editor','publisher']));
create table public.website_media_audit(id uuid primary key default gen_random_uuid(),media_id uuid not null references website_media(id),actor_id uuid references website_profiles(id),snapshot jsonb not null,created_at timestamptz not null default now());
alter table website_media_audit enable row level security;
create policy media_audit_read on website_media_audit for select to authenticated using(website_role(array['administrator','publisher']));
create function public.audit_website_media() returns trigger language plpgsql security definer set search_path=public as $$begin insert into website_media_audit(media_id,actor_id,snapshot) values(new.id,auth.uid(),to_jsonb(new));return new;end $$;
create trigger media_audit after insert or update on website_media for each row execute function audit_website_media();
revoke all on website_media_audit from anon,authenticated;
grant select on website_media_audit to authenticated;
revoke all on function audit_website_media() from public,anon,authenticated;
create table public.content_items(id uuid primary key default gen_random_uuid(),kind text not null check(kind in ('page','programme','story','event','report','campaign','product')),slug text not null check(slug~'^[a-z0-9]+(-[a-z0-9]+)*$'),title text not null check(length(title) between 3 and 180),summary text not null default '' check(length(summary)<=1000),body text not null default '' check(length(body)<=30000),details jsonb not null default '{}',cover_id uuid references website_media(id),status text not null default 'Draft' check(status in ('Draft','Review','Approved','Published','Scheduled','Returned','Archived')),created_by uuid references website_profiles(id),approved_by uuid references website_profiles(id),review_note text not null default '',version integer not null default 1,updated_at timestamptz not null default now(),unique(kind,slug));
alter table content_items enable row level security;
create policy editorial_read on content_items for select to authenticated using(website_role(array['administrator','editor','publisher']));
create table public.content_revisions(id uuid primary key default gen_random_uuid(),content_id uuid not null references content_items(id),version integer not null,snapshot jsonb not null,actor_id uuid references website_profiles(id),created_at timestamptz not null default now());
alter table content_revisions enable row level security;
create policy revision_read on content_revisions for select to authenticated using(website_role(array['administrator','editor','publisher']));
create table public.publications(id uuid primary key default gen_random_uuid(),content_id uuid not null references content_items(id),version integer not null,publish_at timestamptz not null default now(),archived boolean not null default false,snapshot jsonb not null,unique(content_id,version));
alter table publications enable row level security;
-- Only the currently effective approved snapshot is public. Prior and future
-- publications remain inaccessible even through direct REST table requests.
create function public.website_publication_visible(pid uuid) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from publications p where p.id=pid and not p.archived and p.publish_at<=now() and not exists(select 1 from publications newer where newer.content_id=p.content_id and not newer.archived and newer.publish_at<=now() and (newer.publish_at>p.publish_at or (newer.publish_at=p.publish_at and newer.version>p.version))))$$;
create policy published_read on publications for select to anon,authenticated using(website_publication_visible(id));
create view public.published_content with(security_invoker=true) as
 select distinct on(content_id) content_id as id,snapshot->>'kind' kind,snapshot->>'slug' slug,snapshot->>'title' title,snapshot->>'summary' summary,snapshot->>'body' body,(snapshot->>'cover_id')::uuid cover_id,snapshot->'details' details from publications where not archived and publish_at<=now() order by content_id,publish_at desc,version desc;
create function public.website_revision() returns trigger language plpgsql security definer set search_path=public as $$begin insert into content_revisions(content_id,version,snapshot,actor_id) values(new.id,new.version,to_jsonb(new),auth.uid());return new;end $$;
create trigger revision_event after insert or update on content_items for each row execute function website_revision();
create function public.validate_website_content(p jsonb) returns void language plpgsql set search_path=public as $$declare k text;begin
 if p->>'kind' not in ('page','programme','story','event','report','campaign','product') or p->>'slug'!~'^[a-z0-9]+(-[a-z0-9]+)*$' or length(p->>'slug')>100 or length(p->>'title') not between 3 and 180 or length(p->>'summary')>1000 or length(p->>'body')>30000 or jsonb_typeof(p->'details')<>'object' then raise exception 'Invalid content.';end if;
 for k in select jsonb_object_keys(p->'details') loop if k not in ('vision','mission','date','location','link','price','currency','caption','image') or jsonb_typeof(p->'details'->k)<>'string' or length(p->'details'->>k)>3000 then raise exception 'Invalid content.';end if;end loop;
 if p->'details'->>'link' is not null and p->'details'->>'link'!~'^https://' then raise exception 'Invalid content.';end if;
 if p->'details'->>'image' is not null and p->'details'->>'image' not in ('/images/team-collaboration.jpeg','/images/working-together.jpeg') then raise exception 'Invalid content.';end if;
 if p->'details'->>'date' is not null and p->'details'->>'date'<>'' then perform (p->'details'->>'date')::timestamptz;end if;
end $$;
create function public.save_website_content(payload jsonb,record_id uuid default null,expected_version integer default null) returns content_items language plpgsql security definer set search_path=public as $$declare r content_items;begin
 if not website_role(array['administrator','editor']) then raise exception 'Access denied.';end if;perform validate_website_content(payload);
 if record_id is null then insert into content_items(kind,slug,title,summary,body,details,cover_id,created_by) values(payload->>'kind',payload->>'slug',payload->>'title',payload->>'summary',payload->>'body',payload->'details',(payload->>'cover_id')::uuid,auth.uid()) returning * into r;
 else select * into r from content_items where id=record_id for update;
 if not found or not (r.created_by=auth.uid() or website_role(array['administrator'])) then raise exception 'Access denied.';end if;
 if r.kind='page' and r.slug in ('home','about') and (payload->>'kind'<>'page' or payload->>'slug'<>r.slug) then raise exception 'Invalid content.';end if;
 if r.version is distinct from expected_version then raise exception 'Record changed; reload.';end if;if r.status not in ('Draft','Returned') then raise exception 'Return a record to draft before editing.';end if;
 update content_items set kind=payload->>'kind',slug=payload->>'slug',title=payload->>'title',summary=payload->>'summary',body=payload->>'body',details=payload->'details',cover_id=(payload->>'cover_id')::uuid,version=version+1,updated_at=now() where id=record_id returning * into r;end if;return r;
end $$;
create function public.transition_website_content(record_id uuid,target text,expected_version integer,note text default '',scheduled_at timestamptz default null) returns content_items language plpgsql security definer set search_path=public as $$declare r content_items;allowed boolean:=false;begin
 select * into r from content_items where id=record_id for update;if not found or not website_role(array['administrator','editor','publisher']) then raise exception 'Access denied.';end if;if r.version is distinct from expected_version then raise exception 'Record changed; reload.';end if;
 if target='Draft' and r.status in ('Published','Scheduled','Approved','Archived') then allowed:=website_role(array['administrator','editor']);update publications set archived=true where content_id=r.id and publish_at>now();r.created_by:=auth.uid();r.approved_by:=null;
 elsif target='Review' and r.status in ('Draft','Returned') then allowed:=website_role(array['administrator','editor']) and (r.created_by=auth.uid() or website_role(array['administrator']));
 elsif target in ('Approved','Returned') and r.status='Review' then allowed:=website_role(array['administrator','publisher']);if r.created_by=auth.uid() then raise exception 'A different publisher must approve this item.';end if;if target='Returned' and length(btrim(note))<3 then raise exception 'Explain the requested changes.';end if;r.approved_by:=case when target='Approved' then auth.uid() else null end;
 elsif target in ('Published','Scheduled') and r.status='Approved' then allowed:=website_role(array['administrator','publisher']) and r.approved_by is not null and r.approved_by<>r.created_by;if target='Scheduled' and (scheduled_at is null or scheduled_at<=now()) then raise exception 'Invalid content.';end if;
 elsif target='Archived' and r.status in ('Published','Scheduled','Approved') then allowed:=website_role(array['administrator','publisher']);end if;
 if not allowed then raise exception 'Transition not permitted.';end if;
 if target in ('Review','Approved','Published','Scheduled') then
  perform validate_website_content(to_jsonb(r));if r.kind='event' and coalesce(r.details->>'date','')='' then raise exception 'Invalid content.';end if;
  if r.cover_id is not null and not exists(select 1 from website_media where id=r.cover_id and status='Approved' and rights_confirmed and (not shows_children or (guardian_consent and length(consent_reference)>2))) then raise exception 'Choose approved media before publication.';end if;
 end if;
 update content_items set status=target,created_by=r.created_by,approved_by=r.approved_by,review_note=left(note,5000),version=version+1,updated_at=now() where id=r.id returning * into r;
 if target in ('Published','Scheduled') then insert into publications(content_id,version,publish_at,snapshot) values(r.id,r.version,case when target='Scheduled' then scheduled_at else now() end,jsonb_build_object('kind',r.kind,'slug',r.slug,'title',r.title,'summary',r.summary,'body',r.body,'details',r.details,'cover_id',r.cover_id));end if;
 if target='Archived' then update publications set archived=true where content_id=r.id;end if;return r;
end $$;
create function public.restore_website_draft(revision_id uuid,expected_version integer) returns content_items language plpgsql security definer set search_path=public as $$declare v content_revisions;r content_items;s jsonb;begin
 if not website_role(array['administrator','editor']) then raise exception 'Access denied.';end if;select * into v from content_revisions where id=revision_id;select * into r from content_items where id=v.content_id for update;if not found or not (website_role(array['administrator']) or r.created_by=auth.uid()) then raise exception 'Access denied.';end if;if r.version is distinct from expected_version then raise exception 'Record changed; reload.';end if;s:=v.snapshot;update publications set archived=true where content_id=r.id and publish_at>now();update content_items set title=s->>'title',summary=s->>'summary',body=s->>'body',details=s->'details',cover_id=(s->>'cover_id')::uuid,status='Draft',approved_by=null,created_by=auth.uid(),version=version+1,updated_at=now() where id=r.id returning * into r;return r;
end $$;
create function public.register_website_media(path text,file_name text,file_mime text) returns website_media language plpgsql security definer set search_path=public as $$declare r website_media;begin
 if not website_role(array['administrator','editor']) or split_part(path,'/',1)<>auth.uid()::text or not exists(select 1 from storage.objects where bucket_id='website-media' and name=path) then raise exception 'Access denied.';end if;
 insert into website_media(object_path,filename,mime,created_by) values(path,left(file_name,180),file_mime,auth.uid()) returning * into r;return r;
end $$;
create function public.review_website_media(media_id uuid,expected_version integer,payload jsonb,target text) returns website_media language plpgsql security definer set search_path=public as $$declare r website_media;begin
 select * into r from website_media where id=media_id for update;if not found or not website_role(array['administrator','editor','publisher']) then raise exception 'Access denied.';end if;if r.version is distinct from expected_version then raise exception 'Record changed; reload.';end if;
 if target='Review' and r.status in ('Draft','Rejected') and website_role(array['administrator','editor']) and (r.created_by=auth.uid() or website_role(array['administrator'])) then
  update website_media set alt_text=left(payload->>'alt_text',500),caption=left(payload->>'caption',1000),shows_children=(payload->>'shows_children')::boolean,rights_confirmed=(payload->>'rights_confirmed')::boolean,guardian_consent=(payload->>'guardian_consent')::boolean,consent_reference=left(payload->>'consent_reference',1000),status='Review',version=version+1 where id=r.id returning * into r;
 elsif target in ('Approved','Rejected') and r.status='Review' and website_role(array['administrator','publisher']) and r.created_by<>auth.uid() then
  if target='Approved' and (not r.rights_confirmed or length(r.alt_text)<3 or (r.shows_children and (not r.guardian_consent or length(r.consent_reference)<3))) then raise exception 'Choose approved media before publication.';end if;
  update website_media set status=target,reviewed_by=auth.uid(),version=version+1 where id=r.id returning * into r;
 elsif target='Withdrawn' and r.status='Approved' and website_role(array['administrator','publisher']) then
  update website_media set status='Withdrawn',reviewed_by=auth.uid(),version=version+1 where id=r.id returning * into r;
 else raise exception 'Transition not permitted.';end if;return r;
end $$;
create function public.website_public_media(media_id uuid) returns table(object_path text,mime text,alt_text text) language sql stable security definer set search_path=public as $$select m.object_path,m.mime,m.alt_text from website_media m where m.id=media_id and m.status='Approved' and m.rights_confirmed and (not m.shows_children or (m.guardian_consent and length(m.consent_reference)>2))$$;
create table public.website_enquiries(id uuid primary key default gen_random_uuid(),kind text not null check(kind in ('contact','volunteer','partner','aminia-kids','support')),name text not null,email text not null,phone text not null default '',message text not null check(length(message)<=5000),consent boolean not null check(consent),status text not null default 'New',internal_note text not null default '',version integer not null default 1,ip_tag text not null,created_at timestamptz not null default now());
alter table website_enquiries enable row level security;
create policy enquiries_read on website_enquiries for select to authenticated using(website_role(array['administrator','enquiry_coordinator']));
create table public.enquiry_audit(id uuid primary key default gen_random_uuid(),enquiry_id uuid references website_enquiries(id),actor_id uuid references website_profiles(id),status text,note text,created_at timestamptz not null default now());
alter table enquiry_audit enable row level security;
create policy enquiry_audit_read on enquiry_audit for select to authenticated using(website_role(array['administrator','enquiry_coordinator']));
create function public.receive_website_enquiry(payload jsonb,request_tag text) returns uuid language plpgsql security definer set search_path=public as $$declare rid uuid;begin
 perform pg_advisory_xact_lock(hashtext(request_tag));if (select count(*) from website_enquiries where ip_tag=request_tag and created_at>now()-interval '1 hour')>=5 then raise exception 'Too many requests; please try again later.';end if;
 if length(payload->>'name') not between 2 and 150 or length(payload->>'email')>254 or payload->>'email'!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(payload->>'message') not between 5 and 5000 or payload->>'consent'<>'true' then raise exception 'Invalid content.';end if;
 insert into website_enquiries(kind,name,email,phone,message,consent,ip_tag) values(payload->>'kind',payload->>'name',payload->>'email',left(coalesce(payload->>'phone',''),50),payload->>'message',true,request_tag) returning id into rid;return rid;
end $$;
create function public.update_website_enquiry(record_id uuid,target text,note text,expected_version integer) returns website_enquiries language plpgsql security definer set search_path=public as $$declare r website_enquiries;begin
 if not website_role(array['administrator','enquiry_coordinator']) then raise exception 'Access denied.';end if;select * into r from website_enquiries where id=record_id for update;if r.version is distinct from expected_version then raise exception 'Record changed; reload.';end if;if target not in ('New','In review','Contacted','Closed') then raise exception 'Transition not permitted.';end if;update website_enquiries set status=target,internal_note=left(note,5000),version=version+1 where id=record_id returning * into r;insert into enquiry_audit(enquiry_id,actor_id,status,note) values(r.id,auth.uid(),target,left(note,5000));return r;
end $$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('website-media','website-media',false,10485760,array['image/jpeg','image/png','application/pdf']);
create policy website_files_insert on storage.objects for insert to authenticated with check(bucket_id='website-media' and split_part(name,'/',1)=auth.uid()::text and website_role(array['administrator','editor']));
create policy website_files_read on storage.objects for select to anon,authenticated using(bucket_id='website-media' and (website_role(array['administrator','editor','publisher']) or exists(select 1 from website_public_media((select id from website_media where object_path=name)))));
-- Public Storage predicate must not depend on media table RLS for visitors.
create or replace function public.website_file_public(path text) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from website_media where object_path=path and status='Approved' and rights_confirmed and (not shows_children or (guardian_consent and length(consent_reference)>2)))$$;
drop policy website_files_read on storage.objects;
create policy website_files_read on storage.objects for select to anon,authenticated using(bucket_id='website-media' and (website_role(array['administrator','editor','publisher']) or website_file_public(name)));
revoke all on website_profiles,content_items,content_revisions,website_media,website_enquiries,enquiry_audit,publications from anon,authenticated;
grant select on website_profiles,content_items,content_revisions,website_media,website_enquiries,enquiry_audit to authenticated;
grant select on publications,published_content to anon,authenticated;
revoke all on function validate_website_content(jsonb),website_revision(),save_website_content(jsonb,uuid,integer),transition_website_content(uuid,text,integer,text,timestamptz),restore_website_draft(uuid,integer),register_website_media(text,text,text),review_website_media(uuid,integer,jsonb,text),receive_website_enquiry(jsonb,text),update_website_enquiry(uuid,text,text,integer) from public,anon,authenticated;
grant execute on function save_website_content(jsonb,uuid,integer),transition_website_content(uuid,text,integer,text,timestamptz),restore_website_draft(uuid,integer),register_website_media(text,text,text),review_website_media(uuid,integer,jsonb,text),update_website_enquiry(uuid,text,text,integer) to authenticated;
grant execute on function receive_website_enquiry(jsonb,text) to service_role;
commit;
