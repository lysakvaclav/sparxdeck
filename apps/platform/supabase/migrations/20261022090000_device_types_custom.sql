-- Part 17: custom device types and per-type fields, device photos, end of life.
--
-- * Custom types: device_types already allowed owners and admins to edit the
--   seeded type's name and interval; now they can also add their own types
--   (hydrant, emergency lighting...) the same way customers and sites are
--   created, through RLS, not a function.
-- * Custom fields: devices.attributes already held free-form key/value pairs
--   (used only for the seeded type's "agent"/"size"). Which keys apply to a
--   type is now data (device_types.custom_fields), not a hardcoded lookup by
--   type code, so any type can have its own fields. Validation of the field
--   list stays where the rest of this type's fields are validated: the same
--   Zod schema in the browser and the server action.
-- * Device photos follow inspection_photos/defect_photos: a private path under
--   org-assets, checked and registered by a function, not a plain insert.

-- ---------------------------------------------------------------------------
-- Custom fields on a type: a short list of {key, label}
-- ---------------------------------------------------------------------------

alter table public.device_types add column custom_fields jsonb not null default '[]'::jsonb
  check (jsonb_typeof(custom_fields) = 'array' and jsonb_array_length(custom_fields) <= 8);

-- Types: custom ones arrive the same way as customers and sites (RLS, not a
-- function); the server action generates a unique code and validates the
-- field list with the same schema as save_checklist_template's items.
create policy device_types_insert on public.device_types
  for insert to authenticated
  with check (public.has_role(organization_id, array['owner', 'admin']::public.member_role[]));

grant insert (organization_id, code, name, inspection_interval_months, custom_fields)
  on public.device_types to authenticated;
grant update (custom_fields) on public.device_types to authenticated;

-- Existing organizations: the seeded fire extinguisher type keeps its two
-- fields, now as data instead of a hardcoded lookup by code.
update public.device_types dt
set custom_fields = case when o.default_locale = 'en'
  then '[{"key": "agent", "label": "Extinguishing agent"}, {"key": "size", "label": "Size / capacity"}]'::jsonb
  else '[{"key": "agent", "label": "Hasivo"}, {"key": "size", "label": "Velikost / náplň"}]'::jsonb end
from public.organizations o
where dt.organization_id = o.id and dt.code = 'fire_extinguisher' and dt.custom_fields = '[]'::jsonb;

-- seed_organization_defaults sets it for new organizations the same way.
create or replace function public.seed_organization_defaults(p_org uuid, p_locale text default 'cs')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type uuid;
  v_template uuid;
  v_en boolean := p_locale = 'en';
begin
  if exists (select 1 from public.device_types where organization_id = p_org) then
    return;
  end if;

  insert into public.device_types
    (organization_id, code, name, inspection_interval_months, is_sample, custom_fields)
  values (p_org, 'fire_extinguisher',
    case when v_en then 'Fire extinguisher' else 'Hasicí přístroj' end, 12, true,
    case when v_en
      then '[{"key": "agent", "label": "Extinguishing agent"}, {"key": "size", "label": "Size / capacity"}]'::jsonb
      else '[{"key": "agent", "label": "Hasivo"}, {"key": "size", "label": "Velikost / náplň"}]'::jsonb end)
  returning id into v_type;

  insert into public.checklist_templates (organization_id, device_type_id, version, name, is_sample, active)
  values (p_org, v_type, 1,
          case when v_en then 'Fire extinguisher check' else 'Kontrola hasicího přístroje' end,
          true, true)
  returning id into v_template;

  insert into public.checklist_template_items
    (organization_id, template_id, sort_order, label, item_type, required, fail_creates_defect)
  select p_org, v_template, ord, case when v_en then en else cs end, kind::public.checklist_item_type, req, defect
  from (values
    (1, 'Štítek a návod jsou čitelné', 'Label and instructions are legible', 'pass_fail', true, true),
    (2, 'Plomba a pojistka jsou neporušené', 'Seal and safety pin are intact', 'pass_fail', true, true),
    (3, 'Hadice a tryska jsou bez poškození', 'Hose and nozzle are undamaged', 'pass_fail', true, true),
    (4, 'Tlakoměr je v pořádku', 'Pressure gauge is in order', 'pass_fail', true, true),
    (5, 'Bez viditelného poškození a koroze', 'No visible damage or corrosion', 'pass_fail', true, true),
    (6, 'Přístroj je přístupný a správně umístěný', 'Extinguisher is accessible and correctly placed', 'pass_fail', true, true),
    (7, 'Poznámka technika', 'Technician''s note', 'text', false, false)
  ) as items(ord, cs, en, kind, req, defect);
end;
$$;

-- ---------------------------------------------------------------------------
-- End of life: a date to plan replacement around, same warning rule as due dates
-- ---------------------------------------------------------------------------

alter table public.devices add column end_of_life_on date
  check (end_of_life_on >= date '1950-01-01');

grant insert (end_of_life_on) on public.devices to authenticated;
grant update (end_of_life_on) on public.devices to authenticated;

-- ---------------------------------------------------------------------------
-- Device photos (not tied to one inspection, unlike inspection_photos)
-- ---------------------------------------------------------------------------

create table public.device_photos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  device_id uuid not null,
  storage_path text not null unique,
  content_type text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes integer not null check (size_bytes between 1 and 2097152),
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (device_id, organization_id)
    references public.devices (id, organization_id) on delete cascade
);

create index device_photos_device_idx on public.device_photos (device_id);

alter table public.device_photos enable row level security;

create policy device_photos_select on public.device_photos
  for select to authenticated using (public.is_member(organization_id));

revoke insert, update, delete on public.device_photos from authenticated;
revoke all on public.device_photos from anon;

-- The device, locked, for a member of its organization (not soft-deleted).
create or replace function public.member_device(p_device uuid)
returns public.devices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_device public.devices%rowtype;
begin
  select * into v_device from public.devices where id = p_device and deleted_at is null for update;
  if v_device.id is null or not public.is_member(v_device.organization_id) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  return v_device;
end;
$$;

-- Registers a photo already uploaded to org-assets under the device's folder.
-- Any member may add one (a technician photographing a newly placed device).
create or replace function public.add_device_photo(
  p_device uuid,
  p_path text,
  p_content_type text,
  p_size integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_device public.devices%rowtype;
  v_id uuid;
begin
  v_device := public.member_device(p_device);
  if p_path not like v_device.organization_id::text || '/devices/' || p_device::text || '/%'
     or not exists (
       select 1 from storage.objects where bucket_id = 'org-assets' and name = p_path
     ) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if (select count(*) from public.device_photos where device_id = p_device) >= 20 then
    raise exception 'too_many_photos' using errcode = 'P0001';
  end if;
  insert into public.device_photos
    (organization_id, device_id, storage_path, content_type, size_bytes, uploaded_by)
  values
    (v_device.organization_id, p_device, p_path, p_content_type, p_size, (select auth.uid()))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.delete_device_photo(p_photo uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_photo public.device_photos%rowtype;
begin
  select * into v_photo from public.device_photos where id = p_photo;
  if v_photo.id is null or not public.is_member(v_photo.organization_id) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  delete from public.device_photos where id = p_photo;
  return v_photo.storage_path;
end;
$$;

revoke all on function public.member_device(uuid) from public, anon, authenticated;
revoke all on function public.add_device_photo(uuid, text, text, integer) from public, anon;
revoke all on function public.delete_device_photo(uuid) from public, anon;
grant execute on function public.add_device_photo(uuid, text, text, integer) to authenticated;
grant execute on function public.delete_device_photo(uuid) to authenticated;

-- Storage: members add photos to a device; uploaders may remove their own.
create policy org_assets_device_photo_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'org-assets'
    and (storage.foldername(name))[2] = 'devices'
    and exists (
      select 1 from public.devices d
      where d.organization_id = public.storage_organization_id(name)
        and d.id::text = (storage.foldername(name))[3]
    )
  );

create policy org_assets_device_photo_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'org-assets'
    and (storage.foldername(name))[2] = 'devices'
    and owner_id = (select auth.uid())::text
    and public.is_member(public.storage_organization_id(name))
  );
