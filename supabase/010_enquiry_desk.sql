begin;
alter table website_enquiries add column priority text not null default 'Normal' check(priority in ('Normal','High','Urgent'));
create function set_website_enquiry_priority(record_id uuid,expected_version integer,level text) returns website_enquiries language plpgsql security definer set search_path=public as $$declare r website_enquiries;begin
 if not website_role(array['administrator','enquiry_coordinator']) then raise exception 'Access denied.';end if;
 select * into r from website_enquiries where id=record_id for update;if not found or r.version is distinct from expected_version then raise exception 'Record changed; reload.';end if;
 if level not in ('Normal','High','Urgent') then raise exception 'Invalid content.';end if;
 update website_enquiries set priority=level,version=version+1 where id=record_id returning * into r;
 insert into enquiry_audit(enquiry_id,actor_id,status,note) values(r.id,auth.uid(),r.status,'Priority changed to '||level);return r;
end $$;
create function test_website_notice() returns void language plpgsql security definer set search_path=public as $$begin
 if not website_role(array['administrator','editor','publisher','enquiry_coordinator']) then raise exception 'Access denied.';end if;
 perform website_notice(array['administrator','editor','publisher','enquiry_coordinator'],'test/'||auth.uid()||'/'||to_char(now(),'YYYYMMDDHH24MI'),'test','Your AHF website notifications are working.',auth.uid());
end $$;
revoke all on function set_website_enquiry_priority(uuid,integer,text),test_website_notice() from public,anon,authenticated;
grant execute on function set_website_enquiry_priority(uuid,integer,text),test_website_notice() to authenticated;
commit;
