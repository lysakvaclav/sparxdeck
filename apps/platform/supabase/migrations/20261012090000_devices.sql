-- Part 5: devices and due dates.
--
-- * A device lives in a site (building), optionally in one of its locations.
-- * Label numbers are allocated by the database from a per-organization counter,
--   so they never repeat, even when people add devices at the same time.
-- * public_token is the random, unguessable code behind the QR label (part 6).
-- * Due dates are calendar days: next_due_on = last_inspection_on + the type's
--   interval (end of month clamps: 31 Jan + 1 month = 28/29 Feb). The database
--   keeps it current; clients can't write it.

create extension if not exists pgcrypto with schema extensions;

create type public.device_status as enum ('active', 'out_of_service', 'removed');

-- ---------------------------------------------------------------------------
-- Per-organization counters (device labels now; protocol numbers later)
-- ---------------------------------------------------------------------------

create table public.organization_counters (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  value bigint not null default 0 check (value >= 0),
  primary key (organization_id, name)
);

alter table public.organization_counters enable row level security;
-- No policies: only the security definer functions below use it.
revoke all on public.organization_counters from anon, authenticated;

-- 12 characters of Crockford base32 (no I, L, O, U): 60 random bits.
create or replace function public.generate_device_token()
returns text
language sql
volatile
set search_path = ''
as $$
  select string_agg(substr('0123456789abcdefghjkmnpqrstvwxyz', (get_byte(r.bytes, i) % 32) + 1, 1), '' order by i)
  from (select extensions.gen_random_bytes(12) as bytes) as r, generate_series(0, 11) as i;
$$;

-- A device's location must belong to the device's site.
alter table public.locations add constraint locations_id_site_id_key unique (id, site_id);

-- ---------------------------------------------------------------------------
-- devices
-- ---------------------------------------------------------------------------

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  site_id uuid not null,
  location_id uuid,
  device_type_id uuid not null,
  label_number integer not null check (label_number > 0),
  public_token text not null default public.generate_device_token()
    check (public_token ~ '^[0-9a-hjkmnp-tv-z]{12}$'),
  serial_number text check (char_length(serial_number) <= 80),
  manufacturer text check (char_length(manufacturer) <= 120),
  model text check (char_length(model) <= 120),
  manufacture_year integer check (manufacture_year between 1900 and 2100),
  -- Type-specific details (fire extinguisher: agent, size).
  attributes jsonb not null default '{}'::jsonb
    check (jsonb_typeof(attributes) = 'object' and octet_length(attributes::text) <= 4000),
  installed_on date check (installed_on >= date '1950-01-01'),
  status public.device_status not null default 'active',
  last_inspection_on date check (last_inspection_on >= date '1990-01-01'),
  next_due_on date,
  notes text check (char_length(notes) <= 5000),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (organization_id, label_number),
  unique (public_token),
  unique (id, organization_id),
  foreign key (site_id, organization_id) references public.sites (id, organization_id),
  foreign key (location_id, site_id) references public.locations (id, site_id) on delete set null (location_id),
  foreign key (device_type_id, organization_id) references public.device_types (id, organization_id)
);

create index devices_site_idx on public.devices (site_id) where deleted_at is null;
create index devices_org_due_idx on public.devices (organization_id, next_due_on)
  where deleted_at is null and status = 'active';
create index devices_location_idx on public.devices (location_id) where location_id is not null;
create index devices_type_idx on public.devices (device_type_id);

create trigger devices_set_updated_at
  before update on public.devices
  for each row execute function public.set_updated_at();

-- Next label number of the organization (a row lock on the counter serialises
-- concurrent inserts, so numbers are unique and consecutive within one insert).
create or replace function public.assign_device_label()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.organization_counters (organization_id, name, value)
  values (new.organization_id, 'device_label', 1)
  on conflict (organization_id, name)
    do update set value = public.organization_counters.value + 1
  returning value into new.label_number;
  return new;
end;
$$;

create trigger devices_assign_label
  before insert on public.devices
  for each row execute function public.assign_device_label();

-- next_due_on always follows last_inspection_on and the type's interval.
create or replace function public.compute_device_due()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_interval integer;
begin
  if new.last_inspection_on is null then
    new.next_due_on := null;
  else
    select inspection_interval_months into v_interval
    from public.device_types where id = new.device_type_id;
    new.next_due_on := (new.last_inspection_on + make_interval(months => v_interval))::date;
  end if;
  return new;
end;
$$;

create trigger devices_compute_due
  before insert or update on public.devices
  for each row execute function public.compute_device_due();

-- Changing a type's interval moves the due dates of its devices.
create or replace function public.recompute_due_for_type()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.devices
  set next_due_on = (last_inspection_on + make_interval(months => new.inspection_interval_months))::date
  where device_type_id = new.id and last_inspection_on is not null;
  return new;
end;
$$;

create trigger device_types_recompute_due
  after update of inspection_interval_months on public.device_types
  for each row
  when (old.inspection_interval_months is distinct from new.inspection_interval_months)
  execute function public.recompute_due_for_type();

-- Soft-deleting a site hides its devices too (and so does deleting a customer,
-- which soft-deletes its sites).
create or replace function public.cascade_site_soft_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    update public.devices set deleted_at = new.deleted_at
    where site_id = new.id and deleted_at is null;
  end if;
  return new;
end;
$$;

create trigger sites_cascade_soft_delete
  after update of deleted_at on public.sites
  for each row execute function public.cascade_site_soft_delete();

-- No new devices in a deleted site.
create or replace function public.prevent_device_in_deleted_site()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.deleted_at is null and exists (
    select 1 from public.sites where id = new.site_id and deleted_at is not null
  ) then
    raise exception 'site_deleted' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger devices_prevent_deleted_site
  before insert or update of deleted_at on public.devices
  for each row execute function public.prevent_device_in_deleted_site();

-- ---------------------------------------------------------------------------
-- Row Level Security and column privileges
-- ---------------------------------------------------------------------------

alter table public.devices enable row level security;

create policy devices_select on public.devices
  for select to authenticated using (public.is_member(organization_id));
create policy devices_insert on public.devices
  for insert to authenticated
  with check (public.has_role(organization_id, array['owner', 'admin']::public.member_role[]));
create policy devices_update on public.devices
  for update to authenticated
  using (public.has_role(organization_id, array['owner', 'admin']::public.member_role[]))
  with check (public.has_role(organization_id, array['owner', 'admin']::public.member_role[]));

-- Label numbers, tokens and due dates come from the database; the site of a
-- device doesn't change (moving devices arrives later, with history).
revoke insert, update, delete on public.devices from authenticated;
grant insert (organization_id, site_id, location_id, device_type_id, serial_number, manufacturer,
  model, manufacture_year, attributes, installed_on, status, last_inspection_on, notes, created_by)
  on public.devices to authenticated;
grant update (location_id, device_type_id, serial_number, manufacturer, model, manufacture_year,
  attributes, installed_on, status, last_inspection_on, notes, deleted_at)
  on public.devices to authenticated;
revoke all on public.devices from anon;

revoke all on function public.generate_device_token() from public, anon;
grant execute on function public.generate_device_token() to authenticated;
revoke all on function public.assign_device_label() from public, anon, authenticated;
revoke all on function public.compute_device_due() from public, anon, authenticated;
revoke all on function public.recompute_due_for_type() from public, anon, authenticated;
revoke all on function public.cascade_site_soft_delete() from public, anon, authenticated;
revoke all on function public.prevent_device_in_deleted_site() from public, anon, authenticated;
