-- Website content project only; requires migrations 001–006.
begin;
do $$begin if to_regclass('public.website_media') is null then raise exception 'Wrong project or missing migrations: install website migrations 001–006 first.';end if;end $$;
alter table public.website_media drop constraint website_media_mime_check;
alter table public.website_media add constraint website_media_mime_check check(mime in ('image/jpeg','image/png','image/webp','application/pdf','video/external','video/mp4'));
update storage.buckets set file_size_limit=20971520,allowed_mime_types=array['image/jpeg','image/png','image/webp','application/pdf','video/mp4'] where id='website-media';
-- Private files may be attached to drafts. Review/publication still checks approval.
do $$declare source text;begin
 select pg_get_functiondef('public.validate_website_content(jsonb)'::regprocedure) into source;
 source:=replace(source,'mime=''video/external''','mime in (''video/external'',''video/mp4'')');
 source:=replace(source,'mime in (''image/jpeg'',''image/png'')','mime in (''image/jpeg'',''image/png'',''image/webp'')');
 source:=replace(source,'and status=''Approved'' and mime','and mime');
 execute source;
end $$;
create function public.validate_portfolio_publication() returns trigger language plpgsql security definer set search_path=public as $$declare mid uuid;begin
 if new.status in ('Review','Approved','Published','Scheduled') then
  for mid in select value::uuid from jsonb_array_elements_text(coalesce(nullif(new.details->>'gallery',''),'[]')::jsonb) union select nullif(new.details->>'video_id','')::uuid loop
   if mid is not null and not exists(select 1 from public.website_public_media(mid)) then raise exception 'Choose approved media before publication.';end if;
  end loop;
 end if;return new;
end $$;
create trigger portfolio_publication before insert or update on public.content_items for each row execute function public.validate_portfolio_publication();
revoke all on function public.validate_portfolio_publication() from public,anon,authenticated;
create function public.website_playable_video(media_id uuid) returns table(mime text,alt_text text,caption text,external_url text) language sql stable security definer set search_path=public as $$select m.mime,m.alt_text,m.caption,m.external_url from website_media m where m.id=media_id and m.mime in ('video/mp4','video/external') and m.status='Approved' and m.rights_confirmed and (not m.shows_children or (m.guardian_consent and length(m.consent_reference)>2))$$;
commit;
