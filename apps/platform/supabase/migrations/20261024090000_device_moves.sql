-- Moving devices between buildings and locations, with history.
--
-- * device_moves records every change of a device's building or location, by
--   whatever path (the move function, the edit form, bulk edits, a deleted
--   location). Location names are copied at the time, so a later rename or
--   delete doesn't rewrite the history.
-- * move_device() is the only way to change a device's building (the column
--   stays without an update privilege): owners and admins, within the
--   organization, not while the device is being checked in a running
--   inspection, and not between sample data and real data (the sample has its
--   own label numbering and is deleted as a whole).

-- ---------------------------------------------------------------------------
-- History
-- ---------------------------------------------------------------------------

create table public.device_moves (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  device_id uuid not null,
  from_site_id uuid not null,
  to_site_id uuid not null,
  from_location_name text,
  to_location_name text,
  note text check (char_length(note) <= 500),
  moved_by uuid references auth.users (id) on delete set null,
  moved_at timestamptz not null default now(),
  foreign key (device_id, organization_id)
    references public.devices (id, organization_id) on delete cascade,
  foreign key (from_site_id, organization_id)
    references public.sites (id, organization_id) on delete cascade,
  foreign key (to_site_id, organization_id)
    references public.sites (id, organization_id) on delete cascade
);

create index device_moves_device_idx on public.device_moves (device_id, moved_at desc);

alter table public.device_moves enable row level security;

create policy device_moves_select on public.device_moves
  for select to authenticated using (public.is_member(organization_id));

-- Written only by the trigger below.
revoke insert, update, delete on public.device_moves from authenticated;
revoke all on public.device_moves from anon;

create or replace function public.log_device_move()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_note text := nullif(current_setting('sparxdeck.move_note', true), '');
begin
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

create trigger devices_log_move
  after update of site_id, location_id on public.devices
  for each row
  when (old.site_id is distinct from new.site_id or old.location_id is distinct from new.location_id)
  execute function public.log_device_move();

-- Deleting a location clears it from its devices. The foreign key would do it
-- only after the location is gone, and the history would lose its name; here it
-- happens first, while the name can still be read.
create or replace function public.clear_location_from_devices()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.devices set location_id = null where location_id = old.id;
  return old;
end;
$$;

create trigger locations_clear_devices
  before delete on public.locations
  for each row execute function public.clear_location_from_devices();

-- ---------------------------------------------------------------------------
-- Moving a device
-- ---------------------------------------------------------------------------

create or replace function public.move_device(
  p_device uuid,
  p_site uuid,
  p_location uuid,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_device public.devices%rowtype;
  v_site public.sites%rowtype;
begin
  select * into v_device from public.devices
  where id = p_device and deleted_at is null
  for update;
  if v_device.id is null
     or not public.has_role(v_device.organization_id, array['owner', 'admin']::public.member_role[]) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  select * into v_site from public.sites
  where id = p_site and organization_id = v_device.organization_id and deleted_at is null;
  if v_site.id is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if p_location is not null and not exists (
    select 1 from public.locations where id = p_location and site_id = p_site
  ) then
    raise exception 'locations_mismatch' using errcode = 'P0001';
  end if;
  if v_device.site_id = p_site and v_device.location_id is not distinct from p_location then
    raise exception 'no_change' using errcode = 'P0001';
  end if;

  if v_device.site_id <> p_site then
    -- A check of the device in a running inspection belongs to the old building.
    if exists (
      select 1
      from public.inspection_items i
      join public.inspections n on n.id = i.inspection_id
      where i.device_id = p_device and n.status = 'in_progress'
    ) then
      raise exception 'device_in_inspection' using errcode = 'P0001';
    end if;
    if public.is_sample_site(v_device.site_id) is distinct from public.is_sample_site(p_site) then
      raise exception 'sample_mismatch' using errcode = 'P0001';
    end if;
    -- A spot on a floor plan belongs to the old building.
    delete from public.device_placements where device_id = p_device;
  end if;

  perform set_config('sparxdeck.move_note', coalesce(btrim(p_note), ''), true);
  update public.devices set site_id = p_site, location_id = p_location where id = p_device;
  perform set_config('sparxdeck.move_note', '', true);
end;
$$;

revoke all on function public.log_device_move() from public, anon, authenticated;
revoke all on function public.clear_location_from_devices() from public, anon, authenticated;
revoke all on function public.move_device(uuid, uuid, uuid, text) from public, anon;
grant execute on function public.move_device(uuid, uuid, uuid, text) to authenticated;
