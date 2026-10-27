-- Part 20: the phone's position when a technician scans a device's QR label
-- during an inspection. The phone sends the raw reading (or why there is none);
-- the server decides whether it matches the building. An indication for the
-- protocol, never a condition: nothing here blocks a check.
--
-- Only the moment of a scan is stored: no tracking, no trail of a technician.
-- A company can switch it off (organizations.scan_location_enabled).
--
-- Rollback:
--   drop function public.explain_scan_location(uuid, text);
--   drop function public.record_scan_location(uuid, uuid, double precision,
--     double precision, real, timestamptz, public.scan_location_error);
--   drop function public.evaluate_scan_location(uuid, double precision, double precision, real);
--   drop function public.scan_location_verdict(double precision, double precision, integer);
--   drop function public.scan_location_distance(double precision, double precision,
--     double precision, double precision);
--   alter table public.inspection_items drop column scan_latitude, drop column scan_longitude,
--     drop column scan_accuracy_m, drop column scan_captured_at, drop column scan_location_error,
--     drop column location_state, drop column location_distance_m, drop column location_note,
--     drop column location_note_by, drop column location_note_at;
--   alter table public.organizations drop column scan_location_enabled;
--   drop type public.scan_location_state; drop type public.scan_location_error;

create type public.scan_location_state as enum ('matches', 'mismatch', 'unknown');
create type public.scan_location_error as enum ('denied', 'unavailable', 'timeout', 'unsupported');

alter table public.organizations
  add column scan_location_enabled boolean not null default true;

alter table public.inspection_items
  add column scan_latitude double precision check (scan_latitude between -90 and 90),
  add column scan_longitude double precision check (scan_longitude between -180 and 180),
  add column scan_accuracy_m real check (scan_accuracy_m >= 0),
  add column scan_captured_at timestamptz,
  -- Why the phone has no position (permission refused, no fix, too slow, no GPS).
  add column scan_location_error public.scan_location_error,
  -- Decided by the server when the reading arrives (null: the device was not scanned).
  add column location_state public.scan_location_state,
  add column location_distance_m integer,
  -- A word from the technician or a manager ("basement, no GPS"), shown in the protocol.
  add column location_note text check (char_length(location_note) <= 500),
  add column location_note_by uuid references auth.users (id) on delete set null,
  add column location_note_at timestamptz,
  add constraint inspection_items_scan_pair check ((scan_latitude is null) = (scan_longitude is null));

create index inspection_items_location_mismatch_idx
  on public.inspection_items (inspection_id) where location_state = 'mismatch';

-- ---------------------------------------------------------------------------
-- The rule (src/lib/scan-location.ts mirrors it; tests compare the two)
-- ---------------------------------------------------------------------------

-- Great-circle distance in metres on the sphere PostGIS uses for geography
-- without the spheroid (mean radius 6 371 008.7714 m).
create or replace function public.scan_location_distance(
  p_latitude_a double precision,
  p_longitude_a double precision,
  p_latitude_b double precision,
  p_longitude_b double precision
)
returns double precision
language sql
immutable
set search_path = ''
as $$
  select extensions.st_distance(
    extensions.st_setsrid(extensions.st_makepoint(p_longitude_a, p_latitude_a), 4326)::extensions.geography,
    extensions.st_setsrid(extensions.st_makepoint(p_longitude_b, p_latitude_b), 4326)::extensions.geography,
    false
  );
$$;

-- unknown: no distance (no reading, no building point) or a reading less
-- precise than the limit; matches: the building's radius reaches the reading's
-- circle of uncertainty; mismatch: otherwise.
create or replace function public.scan_location_verdict(
  p_distance_m double precision,
  p_accuracy_m double precision,
  p_radius_m integer
)
returns public.scan_location_state
language sql
immutable
set search_path = ''
as $$
  select case
    when p_distance_m is null or p_accuracy_m is null or p_radius_m is null
      or p_accuracy_m > (public.scan_location_rules() ->> 'maxAccuracyM')::double precision
      then 'unknown'::public.scan_location_state
    when p_distance_m - p_accuracy_m <= p_radius_m then 'matches'::public.scan_location_state
    else 'mismatch'::public.scan_location_state
  end;
$$;

create or replace function public.evaluate_scan_location(
  p_site uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_m real,
  out state public.scan_location_state,
  out distance_m integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_site public.sites%rowtype;
  v_distance double precision;
begin
  select * into v_site from public.sites where id = p_site;
  if p_latitude is not null and v_site.latitude is not null then
    v_distance := public.scan_location_distance(
      p_latitude, p_longitude, v_site.latitude, v_site.longitude
    );
  end if;
  state := public.scan_location_verdict(v_distance, p_accuracy_m, v_site.location_radius_m);
  distance_m := round(v_distance)::integer;
end;
$$;

-- ---------------------------------------------------------------------------
-- The phone sends the reading of a scan (in the sync queue, also later after
-- work without a signal). The latest scan of a check wins. Refused only when
-- the check is someone else's right now; ignored when the company switched
-- the feature off.
-- ---------------------------------------------------------------------------

create or replace function public.record_scan_location(
  p_inspection uuid,
  p_device uuid,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_accuracy_m real default null,
  p_captured_at timestamptz default null,
  p_error public.scan_location_error default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_item public.inspection_items%rowtype;
  v_inspection public.inspections%rowtype;
  v_enabled boolean;
  v_result record;
  v_at timestamptz;
begin
  select * into v_item from public.inspection_items
  where inspection_id = p_inspection and device_id = p_device;
  if v_item.id is null or not public.is_member(v_item.organization_id) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  select * into v_inspection from public.inspections where id = v_item.inspection_id;
  if v_inspection.status <> 'in_progress' then
    raise exception 'inspection_closed' using errcode = 'P0001';
  end if;
  if v_item.editing_by is not null and v_item.editing_by <> v_user then
    raise exception 'check_taken_over' using errcode = 'P0001';
  end if;
  if (p_latitude is null) <> (p_longitude is null)
     or (p_latitude is null and p_error is null)
     or p_latitude not between -90 and 90
     or p_longitude not between -180 and 180
     or p_accuracy_m < 0 then
    raise exception 'invalid_location' using errcode = 'P0001';
  end if;

  select scan_location_enabled into v_enabled
  from public.organizations where id = v_item.organization_id;
  if not v_enabled then
    return jsonb_build_object('state', null, 'distanceM', null);
  end if;

  -- The phone's clock: kept between the start of the inspection and now.
  v_at := least(now(), greatest(coalesce(p_captured_at, now()), v_inspection.started_at));
  select * into v_result from public.evaluate_scan_location(
    v_inspection.site_id,
    p_latitude,
    p_longitude,
    case when p_latitude is null then null else p_accuracy_m end
  );

  update public.inspection_items
  set scan_latitude = p_latitude,
      scan_longitude = p_longitude,
      scan_accuracy_m = case when p_latitude is null then null else p_accuracy_m end,
      scan_captured_at = v_at,
      scan_location_error = case when p_latitude is null then p_error end,
      location_state = v_result.state,
      location_distance_m = v_result.distance_m
  where id = v_item.id;

  return jsonb_build_object('state', v_result.state, 'distanceM', v_result.distance_m);
end;
$$;

-- An explanation of the location ("basement, no GPS"): by any member, as with
-- defects; while the inspection runs, so the protocol it issues says the same.
create or replace function public.explain_scan_location(p_item uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_item public.inspection_items%rowtype;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  select * into v_item from public.inspection_items where id = p_item;
  if v_item.id is null or not public.is_member(v_item.organization_id) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if (select status from public.inspections where id = v_item.inspection_id) <> 'in_progress' then
    raise exception 'inspection_closed' using errcode = 'P0001';
  end if;
  if char_length(v_note) > 500 then
    raise exception 'invalid_location' using errcode = 'P0001';
  end if;
  update public.inspection_items
  set location_note = v_note,
      location_note_by = case when v_note is null then null else v_user end,
      location_note_at = case when v_note is null then null else now() end
  where id = p_item;
end;
$$;

revoke all on function public.evaluate_scan_location(uuid, double precision, double precision, real)
  from public, anon, authenticated;
revoke all on function public.record_scan_location(uuid, uuid, double precision, double precision,
  real, timestamptz, public.scan_location_error) from public, anon;
grant execute on function public.record_scan_location(uuid, uuid, double precision, double precision,
  real, timestamptz, public.scan_location_error) to authenticated;
revoke all on function public.explain_scan_location(uuid, text) from public, anon;
grant execute on function public.explain_scan_location(uuid, text) to authenticated;
grant execute on function public.scan_location_distance(double precision, double precision,
  double precision, double precision) to authenticated;
grant execute on function public.scan_location_verdict(double precision, double precision, integer)
  to authenticated;
