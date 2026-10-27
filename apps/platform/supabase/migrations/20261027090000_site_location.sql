-- Part 20: where a building is. Coordinates of its point and the radius that
-- counts as "at the building", for the location of a QR scan (and later the map
-- of buildings and technicians' routes). Coordinates are entered as numbers or
-- taken from the phone on site; no address is sent to any outside service.
--
-- Rollback (nothing else depends on these yet):
--   drop trigger sites_location_stamp on public.sites;
--   drop function public.stamp_site_location();
--   alter table public.sites drop column location, drop column latitude,
--     drop column longitude, drop column location_radius_m, drop column location_source,
--     drop column location_set_by, drop column location_set_at;
--   drop function public.scan_location_rules();
--   (PostGIS can stay installed.)

create extension if not exists postgis with schema extensions;

-- ---------------------------------------------------------------------------
-- The rules of the scan-location check in one place (src/lib/scan-location.ts
-- holds the same numbers; tests compare them).
-- ---------------------------------------------------------------------------

create or replace function public.scan_location_rules()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    -- A reading less precise than this tells nothing about the building.
    'maxAccuracyM', 100,
    -- The radius a building gets until someone sets its own.
    'defaultRadiusM', 150,
    'minRadiusM', 10,
    'maxRadiusM', 5000
  );
$$;

-- ---------------------------------------------------------------------------
-- Building coordinates
-- ---------------------------------------------------------------------------

alter table public.sites
  add column latitude double precision check (latitude between -90 and 90),
  add column longitude double precision check (longitude between -180 and 180),
  add column location_radius_m integer not null
    default ((public.scan_location_rules() ->> 'defaultRadiusM')::integer)
    check (location_radius_m between (public.scan_location_rules() ->> 'minRadiusM')::integer
                                 and (public.scan_location_rules() ->> 'maxRadiusM')::integer),
  -- How the point was set: picked on the map, typed in, or the phone's position.
  add column location_source text check (location_source in ('map', 'manual', 'device')),
  add column location_set_by uuid references auth.users (id) on delete set null,
  add column location_set_at timestamptz,
  add constraint sites_location_pair check ((latitude is null) = (longitude is null));

-- The same point for PostGIS (distances, and a spatial index for the map).
alter table public.sites
  add column location extensions.geography(Point, 4326)
    generated always as (
      case
        when latitude is null or longitude is null then null
        else extensions.st_setsrid(extensions.st_makepoint(longitude, latitude), 4326)::extensions.geography
      end
    ) stored;

create index sites_location_idx on public.sites using gist (location) where deleted_at is null;

-- Who set the point and when: stamped by the database, not taken from the client.
create or replace function public.stamp_site_location()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.latitude is null then
    new.location_source := null;
    new.location_set_by := null;
    new.location_set_at := null;
  elsif tg_op = 'INSERT'
     or new.latitude is distinct from old.latitude
     or new.longitude is distinct from old.longitude
     or new.location_source is distinct from old.location_source then
    new.location_source := coalesce(new.location_source, 'manual');
    new.location_set_by := (select auth.uid());
    new.location_set_at := now();
  else
    new.location_set_by := old.location_set_by;
    new.location_set_at := old.location_set_at;
  end if;
  return new;
end;
$$;

create trigger sites_location_stamp
  before insert or update on public.sites
  for each row execute function public.stamp_site_location();

revoke all on function public.stamp_site_location() from public, anon, authenticated;
grant execute on function public.scan_location_rules() to authenticated;
