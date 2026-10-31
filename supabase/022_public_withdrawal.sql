begin;
-- A publisher must be able to withdraw an older live snapshot while a new draft is being edited.
create or replace function withdraw_website_publication(record_id uuid,expected_version integer) returns content_items language plpgsql security definer set search_path=public as $$declare r content_items;begin
 if not website_role(array['administrator','publisher']) then raise exception 'Access denied.';end if;
 select * into r from content_items where id=record_id for update;
 if not found or r.version is distinct from expected_version then raise exception 'Record changed; reload.';end if;
 update publications set archived=true where content_id=r.id;
 update content_items set status='Archived',approved_by=null,version=version+1,updated_at=now() where id=r.id returning * into r;
 return r;
end $$;
revoke all on function withdraw_website_publication(uuid,integer) from public,anon,authenticated;
grant execute on function withdraw_website_publication(uuid,integer) to authenticated;
commit;
