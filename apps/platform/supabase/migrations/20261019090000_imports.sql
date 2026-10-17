-- Part 14: import from Excel or CSV.
--
-- A company brings its existing records in one go: each row is a device with
-- its customer, building and (optionally) location; rows without a device only
-- add the customer and building. Existing customers (by company ID, else name),
-- buildings and locations (by name) are reused; a device whose serial number is
-- already in the building is skipped (importing a file again doubles no device
-- that has a serial number; devices without one are added again).
-- Everything happens in one transaction. An import can be undone while nothing
-- it created has been used (inspected, defects, plans, added to).

create table public.imports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  file_name text not null check (char_length(file_name) between 1 and 255),
  customers_created integer not null default 0,
  sites_created integer not null default 0,
  locations_created integer not null default 0,
  devices_created integer not null default 0,
  devices_skipped integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  undone_at timestamptz,
  undone_by uuid references auth.users (id) on delete set null,
  unique (id, organization_id)
);

create index imports_org_idx on public.imports (organization_id, created_at desc);

-- What each import created (null for records made in the app).
alter table public.customers add column import_id uuid;
alter table public.sites add column import_id uuid;
alter table public.locations add column import_id uuid;
alter table public.devices add column import_id uuid;

alter table public.customers add constraint customers_import_fkey
  foreign key (import_id, organization_id) references public.imports (id, organization_id)
  on delete set null (import_id);
alter table public.sites add constraint sites_import_fkey
  foreign key (import_id, organization_id) references public.imports (id, organization_id)
  on delete set null (import_id);
alter table public.locations add constraint locations_import_fkey
  foreign key (import_id, organization_id) references public.imports (id, organization_id)
  on delete set null (import_id);
alter table public.devices add constraint devices_import_fkey
  foreign key (import_id, organization_id) references public.imports (id, organization_id)
  on delete set null (import_id);

create index customers_import_idx on public.customers (import_id) where import_id is not null;
create index sites_import_idx on public.sites (import_id) where import_id is not null;
create index locations_import_idx on public.locations (import_id) where import_id is not null;
create index devices_import_idx on public.devices (import_id) where import_id is not null;
create index devices_site_serial_idx on public.devices (site_id, lower(serial_number))
  where deleted_at is null and serial_number is not null;

-- ---------------------------------------------------------------------------
-- import_records: the rows, already validated by the app, checked again here
-- ---------------------------------------------------------------------------

create or replace function public.import_records(p_org uuid, p_file_name text, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_import uuid;
  v_row jsonb;
  v_customer jsonb;
  v_site jsonb;
  v_device jsonb;
  v_company text;
  v_location text;
  v_serial text;
  v_customer_id uuid;
  v_site_id uuid;
  v_location_id uuid;
  v_type_id uuid;
  v_sites uuid[] := '{}';
  c_customers integer := 0;
  c_sites integer := 0;
  c_locations integer := 0;
  c_devices integer := 0;
  c_skipped integer := 0;
begin
  if not public.has_role(p_org, array['owner', 'admin']::public.member_role[]) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'import_empty' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_rows) > 5000 then
    raise exception 'import_too_large' using errcode = 'P0001';
  end if;

  insert into public.imports (organization_id, file_name, created_by)
  values (p_org, left(coalesce(nullif(btrim(p_file_name), ''), 'import'), 255), v_user)
  returning id into v_import;

  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_customer := v_row -> 'customer';
    v_site := v_row -> 'site';
    if jsonb_typeof(v_customer) is distinct from 'object'
       or jsonb_typeof(v_site) is distinct from 'object'
       or nullif(btrim(v_customer ->> 'name'), '') is null
       or nullif(btrim(v_site ->> 'name'), '') is null then
      raise exception 'import_invalid_row' using errcode = 'P0001';
    end if;

    -- Customer: by company ID, else by name (when the IDs don't contradict).
    v_company := nullif(btrim(v_customer ->> 'company_id'), '');
    v_customer_id := null;
    if v_company is not null then
      select id into v_customer_id from public.customers
      where organization_id = p_org and deleted_at is null and company_id = v_company
      order by created_at limit 1;
    end if;
    if v_customer_id is null then
      select id into v_customer_id from public.customers
      where organization_id = p_org and deleted_at is null
        and lower(name) = lower(btrim(v_customer ->> 'name'))
        and (company_id is null or v_company is null or company_id = v_company)
      order by created_at limit 1;
    end if;
    if v_customer_id is null then
      insert into public.customers
        (organization_id, name, company_id, contact_person, email, phone, billing_address,
         created_by, import_id)
      values (
        p_org,
        btrim(v_customer ->> 'name'),
        v_company,
        nullif(btrim(v_customer ->> 'contact_person'), ''),
        nullif(lower(btrim(v_customer ->> 'email')), ''),
        nullif(btrim(v_customer ->> 'phone'), ''),
        nullif(btrim(v_customer ->> 'billing_address'), ''),
        v_user,
        v_import
      )
      returning id into v_customer_id;
      c_customers := c_customers + 1;
    end if;

    -- Building of that customer, by name.
    select id into v_site_id from public.sites
    where customer_id = v_customer_id and deleted_at is null
      and lower(name) = lower(btrim(v_site ->> 'name'))
    order by created_at limit 1;
    if v_site_id is null then
      insert into public.sites
        (organization_id, customer_id, name, address, access_notes, created_by, import_id)
      values (
        p_org,
        v_customer_id,
        btrim(v_site ->> 'name'),
        nullif(btrim(v_site ->> 'address'), ''),
        nullif(btrim(v_site ->> 'access_notes'), ''),
        v_user,
        v_import
      )
      returning id into v_site_id;
      c_sites := c_sites + 1;
    end if;
    if not v_site_id = any (v_sites) then
      v_sites := v_sites || v_site_id;
    end if;

    -- Location in that building, by name (added at the end of the route).
    v_location_id := null;
    v_location := nullif(btrim(v_row ->> 'location'), '');
    if v_location is not null then
      select id into v_location_id from public.locations
      where site_id = v_site_id and lower(name) = lower(v_location)
      order by sort_order limit 1;
      if v_location_id is null then
        insert into public.locations (organization_id, site_id, name, sort_order, import_id)
        values (
          p_org,
          v_site_id,
          v_location,
          coalesce((select max(sort_order) + 1 from public.locations where site_id = v_site_id), 1),
          v_import
        )
        returning id into v_location_id;
        c_locations := c_locations + 1;
      end if;
    end if;

    -- Device, unless its serial number is already in the building.
    v_device := v_row -> 'device';
    if jsonb_typeof(v_device) = 'object' then
      select id into v_type_id from public.device_types
      where id = (v_device ->> 'device_type_id')::uuid and organization_id = p_org and active;
      if v_type_id is null then
        raise exception 'import_invalid_type' using errcode = 'P0001';
      end if;
      v_serial := nullif(btrim(v_device ->> 'serial_number'), '');
      if v_serial is not null and exists (
        select 1 from public.devices
        where site_id = v_site_id and deleted_at is null and lower(serial_number) = lower(v_serial)
      ) then
        c_skipped := c_skipped + 1;
        continue;
      end if;
      insert into public.devices
        (organization_id, site_id, location_id, device_type_id, serial_number, manufacturer, model,
         manufacture_year, attributes, installed_on, status, last_inspection_on, notes, created_by,
         import_id)
      values (
        p_org,
        v_site_id,
        v_location_id,
        v_type_id,
        v_serial,
        nullif(btrim(v_device ->> 'manufacturer'), ''),
        nullif(btrim(v_device ->> 'model'), ''),
        (v_device ->> 'manufacture_year')::integer,
        coalesce(v_device -> 'attributes', '{}'::jsonb),
        (v_device ->> 'installed_on')::date,
        'active',
        (v_device ->> 'last_inspection_on')::date,
        nullif(btrim(v_device ->> 'notes'), ''),
        v_user,
        v_import
      );
      c_devices := c_devices + 1;
    end if;
  end loop;

  update public.imports
  set customers_created = c_customers,
      sites_created = c_sites,
      locations_created = c_locations,
      devices_created = c_devices,
      devices_skipped = c_skipped
  where id = v_import;

  return jsonb_build_object(
    'import_id', v_import,
    'customers', c_customers,
    'sites', c_sites,
    'locations', c_locations,
    'devices', c_devices,
    'skipped', c_skipped,
    'site_ids', to_jsonb(v_sites)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- undo_import: removes what the import created, while it hasn't been used
-- ---------------------------------------------------------------------------

create or replace function public.undo_import(p_import uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_import public.imports%rowtype;
begin
  select * into v_import from public.imports where id = p_import;
  if v_import.id is null
     or not public.has_role(v_import.organization_id, array['owner', 'admin']::public.member_role[]) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_import.undone_at is not null then
    raise exception 'import_undone' using errcode = 'P0001';
  end if;

  -- In use: inspected, with defects or plans, or something else added to it.
  if exists (
       select 1 from public.inspection_items i
       join public.devices d on d.id = i.device_id where d.import_id = p_import)
     or exists (
       select 1 from public.defects f
       join public.devices d on d.id = f.device_id where d.import_id = p_import)
     or exists (
       select 1 from public.inspections s
       join public.sites t on t.id = s.site_id where t.import_id = p_import)
     or exists (
       select 1 from public.floor_plans p
       join public.sites t on t.id = p.site_id where t.import_id = p_import)
     or exists (
       select 1 from public.devices d
       join public.sites t on t.id = d.site_id
       where t.import_id = p_import and d.deleted_at is null
         and d.import_id is distinct from p_import)
     or exists (
       select 1 from public.sites t
       join public.customers c on c.id = t.customer_id
       where c.import_id = p_import and t.deleted_at is null
         and t.import_id is distinct from p_import) then
    raise exception 'import_in_use' using errcode = 'P0001';
  end if;

  update public.devices set deleted_at = now()
  where import_id = p_import and deleted_at is null;
  -- Locations the import added to buildings that stay (their devices keep the building).
  delete from public.locations where import_id = p_import;
  update public.sites set deleted_at = now()
  where import_id = p_import and deleted_at is null;
  update public.customers set deleted_at = now()
  where import_id = p_import and deleted_at is null;

  update public.imports set undone_at = now(), undone_by = (select auth.uid())
  where id = p_import;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security and grants
-- ---------------------------------------------------------------------------

alter table public.imports enable row level security;

-- The history is for the people who import (owners and admins).
create policy imports_select on public.imports
  for select to authenticated
  using (public.has_role(organization_id, array['owner', 'admin']::public.member_role[]));

revoke all on public.imports from anon;
revoke insert, update, delete on public.imports from authenticated;
grant select on public.imports to authenticated;

revoke all on function public.import_records(uuid, text, jsonb) from public, anon;
grant execute on function public.import_records(uuid, text, jsonb) to authenticated;
revoke all on function public.undo_import(uuid) from public, anon;
grant execute on function public.undo_import(uuid) to authenticated;
