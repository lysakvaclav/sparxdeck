-- Part 4: device types and inspection checklist templates.
--
-- * What is inspected and how often is data, not code: every organization gets
--   its own editable copy of the defaults (fire extinguisher, 12 months, a sample
--   checklist), clearly flagged as a sample to verify with an inspection technician.
-- * Templates are versioned: saving creates a new version and makes it the active
--   one; older versions stay untouched for inspections that used them.
-- * Everyone in the organization can read; only owners and admins change types,
--   and templates change only through save_checklist_template().

create type public.checklist_item_type as enum ('pass_fail', 'number', 'text');

-- ---------------------------------------------------------------------------
-- device_types
-- ---------------------------------------------------------------------------

create table public.device_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  code text not null check (code ~ '^[a-z][a-z0-9_]{1,40}$'),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  -- Default interval between inspections: a value to verify, never a legal claim.
  inspection_interval_months integer not null check (inspection_interval_months between 1 and 120),
  -- Seeded values stay flagged until an owner or admin saves the type.
  is_sample boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code),
  unique (id, organization_id)
);

create trigger device_types_set_updated_at
  before update on public.device_types
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- checklist_templates (one row per version)
-- ---------------------------------------------------------------------------

create table public.checklist_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  device_type_id uuid not null,
  version integer not null check (version >= 1),
  name text not null check (char_length(btrim(name)) between 1 and 160),
  is_sample boolean not null default false,
  active boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (device_type_id, version),
  unique (id, organization_id),
  foreign key (device_type_id, organization_id)
    references public.device_types (id, organization_id) on delete cascade
);

-- Exactly one active version per device type.
create unique index checklist_templates_one_active
  on public.checklist_templates (device_type_id) where active;

create table public.checklist_template_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  template_id uuid not null,
  sort_order integer not null check (sort_order >= 1),
  label text not null check (char_length(btrim(label)) between 1 and 200),
  item_type public.checklist_item_type not null,
  required boolean not null default true,
  -- A failed yes/no answer opens a defect automatically (only yes/no items can fail).
  fail_creates_defect boolean not null default false,
  check (not fail_creates_defect or item_type = 'pass_fail'),
  unique (template_id, sort_order),
  foreign key (template_id, organization_id)
    references public.checklist_templates (id, organization_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.device_types enable row level security;
alter table public.checklist_templates enable row level security;
alter table public.checklist_template_items enable row level security;

create policy device_types_select on public.device_types
  for select to authenticated using (public.is_member(organization_id));
create policy device_types_update on public.device_types
  for update to authenticated
  using (public.has_role(organization_id, array['owner', 'admin']::public.member_role[]))
  with check (public.has_role(organization_id, array['owner', 'admin']::public.member_role[]));

create policy checklist_templates_select on public.checklist_templates
  for select to authenticated using (public.is_member(organization_id));
create policy checklist_template_items_select on public.checklist_template_items
  for select to authenticated using (public.is_member(organization_id));

-- Types: only the editable columns; custom types arrive later (P2).
revoke insert, update, delete on public.device_types from authenticated;
grant update (name, inspection_interval_months, is_sample) on public.device_types to authenticated;
-- Templates: read only; versions are written by save_checklist_template().
revoke insert, update, delete on public.checklist_templates, public.checklist_template_items from authenticated;
revoke all on public.device_types, public.checklist_templates, public.checklist_template_items from anon;

-- ---------------------------------------------------------------------------
-- Saving a template = a new active version (or nothing, if unchanged)
-- ---------------------------------------------------------------------------

-- p_items: [{ "label": text, "type": "pass_fail"|"number"|"text", "required": bool,
--             "failCreatesDefect": bool }, ...] in display order.
-- p_verified: the items were checked by an inspection technician (clears the sample flag).
create or replace function public.save_checklist_template(
  p_device_type uuid,
  p_name text,
  p_items jsonb,
  p_verified boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_current public.checklist_templates%rowtype;
  v_old jsonb;
  v_new jsonb;
  v_version integer;
  v_id uuid;
  v_item jsonb;
begin
  select organization_id into v_org from public.device_types where id = p_device_type;
  if v_org is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if not public.has_role(v_org, array['owner', 'admin']::public.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Validate the whole template before writing anything.
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 160
     or jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) not between 1 and 100 then
    raise exception 'invalid_template' using errcode = 'P0001';
  end if;
  for v_item in select * from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) is distinct from 'object'
       or char_length(btrim(coalesce(v_item ->> 'label', ''))) not between 1 and 200
       or coalesce(v_item ->> 'type', '') not in ('pass_fail', 'number', 'text')
       or jsonb_typeof(v_item -> 'required') is distinct from 'boolean'
       or jsonb_typeof(v_item -> 'failCreatesDefect') is distinct from 'boolean'
       or ((v_item ->> 'failCreatesDefect')::boolean and v_item ->> 'type' <> 'pass_fail') then
      raise exception 'invalid_template' using errcode = 'P0001';
    end if;
  end loop;

  -- Serialise saves of the same type.
  perform 1 from public.device_types where id = p_device_type for update;

  select * into v_current
  from public.checklist_templates
  where device_type_id = p_device_type and active;

  select coalesce(jsonb_agg(jsonb_build_object(
           'label', btrim(e ->> 'label'),
           'type', e ->> 'type',
           'required', (e ->> 'required')::boolean,
           'failCreatesDefect', (e ->> 'failCreatesDefect')::boolean) order by ord), '[]'::jsonb)
    into v_new
  from jsonb_array_elements(p_items) with ordinality as t(e, ord);

  if v_current.id is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
             'label', label,
             'type', item_type::text,
             'required', required,
             'failCreatesDefect', fail_creates_defect) order by sort_order), '[]'::jsonb)
      into v_old
    from public.checklist_template_items
    where template_id = v_current.id;

    -- Nothing changed: keep the current version.
    if v_old = v_new and v_current.name = btrim(p_name) and (not p_verified or not v_current.is_sample) then
      return v_current.id;
    end if;
  end if;

  select coalesce(max(version), 0) + 1 into v_version
  from public.checklist_templates where device_type_id = p_device_type;

  update public.checklist_templates set active = false
  where device_type_id = p_device_type and active;

  insert into public.checklist_templates
    (organization_id, device_type_id, version, name, is_sample, active, created_by)
  values
    (v_org, p_device_type, v_version, btrim(p_name),
     coalesce(v_current.is_sample, false) and not p_verified, true, (select auth.uid()))
  returning id into v_id;

  insert into public.checklist_template_items
    (organization_id, template_id, sort_order, label, item_type, required, fail_creates_defect)
  select v_org, v_id, ord, e ->> 'label', (e ->> 'type')::public.checklist_item_type,
         (e ->> 'required')::boolean, (e ->> 'failCreatesDefect')::boolean
  from jsonb_array_elements(v_new) with ordinality as t(e, ord);

  return v_id;
end;
$$;

revoke all on function public.save_checklist_template(uuid, text, jsonb, boolean) from public, anon;
grant execute on function public.save_checklist_template(uuid, text, jsonb, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Defaults for an organization: fire extinguisher with a SAMPLE checklist.
-- ---------------------------------------------------------------------------

-- The items are placeholders to verify with a real inspection technician; the UI
-- says so until an owner or admin confirms them. No regulation is implied.
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

  insert into public.device_types (organization_id, code, name, inspection_interval_months, is_sample)
  values (p_org, 'fire_extinguisher', case when v_en then 'Fire extinguisher' else 'Hasicí přístroj' end, 12, true)
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

revoke all on function public.seed_organization_defaults(uuid, text) from public, anon, authenticated;

-- Creating a company now also seeds its defaults, in the creator's language.
drop function public.create_organization(text, text);

create function public.create_organization(p_name text, p_display_name text, p_locale text default 'cs')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_email text;
  v_org uuid;
  v_locale text := case when p_locale = 'en' then 'en' else 'cs' end;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if exists (select 1 from public.memberships where user_id = v_user) then
    raise exception 'already_member' using errcode = 'P0001';
  end if;

  select email into v_email from auth.users where id = v_user;

  insert into public.organizations (name, default_locale)
  values (btrim(p_name), v_locale)
  returning id into v_org;

  insert into public.memberships (organization_id, user_id, role, display_name, email)
  values (v_org, v_user, 'owner', btrim(p_display_name), lower(v_email));

  perform public.seed_organization_defaults(v_org, v_locale);

  return v_org;
end;
$$;

revoke all on function public.create_organization(text, text, text) from public, anon;
grant execute on function public.create_organization(text, text, text) to authenticated;

-- Existing organizations get their defaults too.
select public.seed_organization_defaults(id, default_locale) from public.organizations;
