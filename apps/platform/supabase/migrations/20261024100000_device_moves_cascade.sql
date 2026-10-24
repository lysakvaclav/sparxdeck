-- Deleting a whole organization (or a building with its locations) must not
-- write location history: the building row is already gone by the time its
-- locations are deleted, and a history row pointing at it would fail its key.
-- Only a location deleted on its own, from a building that stays, is recorded.

create or replace function public.clear_location_from_devices()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.sites where id = old.site_id) then
    update public.devices set location_id = null where location_id = old.id;
  end if;
  return old;
end;
$$;

create or replace function public.log_device_move()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_note text := nullif(current_setting('sparxdeck.move_note', true), '');
begin
  if not exists (select 1 from public.sites where id = old.site_id)
     or not exists (select 1 from public.sites where id = new.site_id) then
    return new;
  end if;
  insert into public.device_moves
    (organization_id, device_id, from_site_id, to_site_id,
     from_location_name, to_location_name, note, moved_by)
  values (
    new.organization_id, new.id, old.site_id, new.site_id,
    (select name from public.locations where id = old.location_id),
    (select name from public.locations where id = new.location_id),
    v_note,
    (select auth.uid())
  );
  return new;
end;
$$;

revoke all on function public.clear_location_from_devices() from public, anon, authenticated;
revoke all on function public.log_device_move() from public, anon, authenticated;
