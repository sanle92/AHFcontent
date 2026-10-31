begin;
create or replace function website_device_enabled(endpoint text) returns boolean language plpgsql security definer set search_path=public as $$begin
 if not website_role(array['administrator','editor','publisher','enquiry_coordinator']) then raise exception 'Access denied.';end if;
 return exists(select 1 from website_push_subscriptions s where s.user_id=auth.uid() and s.endpoint=$1 and s.enabled);
end $$;
revoke all on function website_device_enabled(text) from public,anon,authenticated;
grant execute on function website_device_enabled(text) to authenticated;
create or replace function website_test_delivery(notice uuid,endpoint text) returns boolean language plpgsql security definer set search_path=public as $$begin
 if not website_role(array['administrator','editor','publisher','enquiry_coordinator']) then raise exception 'Access denied.';end if;
 return exists(select 1 from website_push_jobs j join website_notifications n on n.id=j.notification_id join website_push_subscriptions s on s.id=j.subscription_id where n.id=$1 and n.user_id=auth.uid() and s.user_id=auth.uid() and s.endpoint=$2 and j.status='Sent');
end $$;
revoke all on function website_test_delivery(uuid,text) from public,anon,authenticated;
grant execute on function website_test_delivery(uuid,text) to authenticated;
commit;
