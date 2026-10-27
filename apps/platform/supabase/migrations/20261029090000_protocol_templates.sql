-- Part 22, stage A: protocol templates. What the protocol PDF shows and how
-- it looks is a template stored as data (JSON checked by the app's schema,
-- src/lib/protocol-template/schema.ts, never markup). Templates are edited
-- as a draft and published as numbered versions that never change; every
-- protocol records the version it was drawn by and a snapshot of its data,
-- so it can be drawn again exactly as issued.
--
-- Additive only: four tables, two columns on protocols, functions and
-- triggers. Rollback:
--   drop trigger protocols_template_version on public.protocols;
--   drop trigger organizations_protocol_template on public.organizations;
--   drop trigger protocol_templates_stamp_draft on public.protocol_templates;
--   alter table public.protocols drop column snapshot, drop column template_version_id;
--   drop function public.stamp_protocol_template(), public.stamp_protocol_template_draft(),
--     public.seed_new_organization_protocol_template(),
--     public.publish_protocol_template(uuid, jsonb, text), public.protocol_template_version_for(uuid),
--     public.seed_protocol_template(uuid), public.default_protocol_template(),
--     public.protocol_template_versions_immutable();
--   drop table public.protocol_template_events, public.protocol_template_assignments;
--   alter table public.protocol_templates drop column current_version_id;
--   drop table public.protocol_template_versions, public.protocol_templates;
--   drop type public.protocol_template_status, public.protocol_template_usage;

create type public.protocol_template_usage as enum ('inspection', 'summary');
create type public.protocol_template_status as enum ('draft', 'published', 'archived');

-- ---------------------------------------------------------------------------
-- Templates and their versions
-- ---------------------------------------------------------------------------

create table public.protocol_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text check (char_length(description) <= 500),
  usage public.protocol_template_usage not null default 'inspection',
  -- The language of protocols drawn by it; null = the company's language.
  locale text check (locale in ('cs', 'en')),
  status public.protocol_template_status not null default 'draft',
  -- The company's template for its usage (one at most, only a published one).
  is_default boolean not null default false,
  -- The work in progress (validated by the app before it is stored).
  draft jsonb check (draft is null or (jsonb_typeof(draft) = 'object' and pg_column_size(draft) <= 524288)),
  draft_updated_by uuid references auth.users (id) on delete set null,
  draft_updated_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  check (not is_default or status = 'published')
);

create unique index protocol_templates_default_idx
  on public.protocol_templates (organization_id, usage) where is_default;
create index protocol_templates_org_idx on public.protocol_templates (organization_id, status);

create trigger protocol_templates_set_updated_at
  before update on public.protocol_templates
  for each row execute function public.set_updated_at();

create table public.protocol_template_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  template_id uuid not null,
  version integer not null check (version > 0),
  content jsonb not null check (jsonb_typeof(content) = 'object' and pg_column_size(content) <= 524288),
  note text not null check (char_length(btrim(note)) between 1 and 500),
  published_by uuid references auth.users (id) on delete set null,
  published_at timestamptz not null default now(),
  unique (template_id, version),
  unique (id, organization_id),
  foreign key (template_id, organization_id)
    references public.protocol_templates (id, organization_id) on delete cascade
);

alter table public.protocol_templates
  add column current_version_id uuid,
  add foreign key (current_version_id, organization_id)
    references public.protocol_template_versions (id, organization_id);

-- A published version is never changed: protocols drawn by it must stay as issued.
create or replace function public.protocol_template_versions_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'version_immutable' using errcode = 'P0001';
end;
$$;

create trigger protocol_template_versions_no_update
  before update on public.protocol_template_versions
  for each row execute function public.protocol_template_versions_immutable();

-- ---------------------------------------------------------------------------
-- Which template a protocol uses: one per customer or device type (else the
-- company's default).
-- ---------------------------------------------------------------------------

create table public.protocol_template_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  template_id uuid not null,
  customer_id uuid,
  device_type_id uuid,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (num_nonnulls(customer_id, device_type_id) = 1),
  foreign key (template_id, organization_id)
    references public.protocol_templates (id, organization_id) on delete cascade,
  foreign key (customer_id, organization_id)
    references public.customers (id, organization_id) on delete cascade,
  foreign key (device_type_id, organization_id)
    references public.device_types (id, organization_id) on delete cascade
);

create unique index protocol_template_assignments_customer_idx
  on public.protocol_template_assignments (customer_id) where customer_id is not null;
create unique index protocol_template_assignments_type_idx
  on public.protocol_template_assignments (device_type_id) where device_type_id is not null;
create index protocol_template_assignments_template_idx
  on public.protocol_template_assignments (template_id);

-- ---------------------------------------------------------------------------
-- History: who did what with a template, and when.
-- ---------------------------------------------------------------------------

create table public.protocol_template_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  template_id uuid not null,
  kind text not null check (kind in (
    'created', 'published', 'renamed', 'archived', 'restored', 'default', 'copied', 'imported', 'assigned'
  )),
  version integer,
  note text check (char_length(note) <= 500),
  actor uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (template_id, organization_id)
    references public.protocol_templates (id, organization_id) on delete cascade
);

create index protocol_template_events_template_idx
  on public.protocol_template_events (template_id, created_at);

-- ---------------------------------------------------------------------------
-- Protocols: the version they were drawn by, and their data.
-- ---------------------------------------------------------------------------

alter table public.protocols
  -- No action (not restrict): deleting a company removes both in one go.
  add column template_version_id uuid references public.protocol_template_versions (id),
  -- Everything the PDF was made from (src/lib/protocol.ts, ProtocolInput, and
  -- the paths of its images), written once with the PDF.
  add column snapshot jsonb check (snapshot is null or (jsonb_typeof(snapshot) = 'object' and pg_column_size(snapshot) <= 4194304));

create index protocols_template_version_idx
  on public.protocols (template_version_id) where template_version_id is not null;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.protocol_templates enable row level security;
alter table public.protocol_template_versions enable row level security;
alter table public.protocol_template_assignments enable row level security;
alter table public.protocol_template_events enable row level security;

create policy protocol_templates_select on public.protocol_templates
  for select to authenticated using (public.is_member(organization_id));
create policy protocol_templates_insert on public.protocol_templates
  for insert to authenticated
  with check (public.has_role(organization_id, array['owner', 'admin']::public.member_role[]));
create policy protocol_templates_update on public.protocol_templates
  for update to authenticated
  using (public.has_role(organization_id, array['owner', 'admin']::public.member_role[]))
  with check (public.has_role(organization_id, array['owner', 'admin']::public.member_role[]));

-- Status, default and the current version change only through functions.
revoke insert, update, delete on public.protocol_templates from authenticated;
grant insert (organization_id, name, description, usage, locale, draft, created_by)
  on public.protocol_templates to authenticated;
grant update (name, description, locale, draft) on public.protocol_templates to authenticated;

create policy protocol_template_versions_select on public.protocol_template_versions
  for select to authenticated using (public.is_member(organization_id));
revoke insert, update, delete on public.protocol_template_versions from authenticated;

create policy protocol_template_assignments_select on public.protocol_template_assignments
  for select to authenticated using (public.is_member(organization_id));
create policy protocol_template_assignments_insert on public.protocol_template_assignments
  for insert to authenticated
  with check (public.has_role(organization_id, array['owner', 'admin']::public.member_role[]));
create policy protocol_template_assignments_delete on public.protocol_template_assignments
  for delete to authenticated
  using (public.has_role(organization_id, array['owner', 'admin']::public.member_role[]));
revoke update on public.protocol_template_assignments from authenticated;

create policy protocol_template_events_select on public.protocol_template_events
  for select to authenticated using (public.is_member(organization_id));
revoke insert, update, delete on public.protocol_template_events from authenticated;

-- Who saved the draft is stamped here, never sent by the client.
create or replace function public.stamp_protocol_template_draft()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' and new.draft is not null)
    or (tg_op = 'UPDATE' and new.draft is distinct from old.draft) then
    new.draft_updated_by := (select auth.uid());
    new.draft_updated_at := now();
  end if;
  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid());
  end if;
  return new;
end;
$$;

create trigger protocol_templates_stamp_draft
  before insert or update on public.protocol_templates
  for each row execute function public.stamp_protocol_template_draft();

-- ---------------------------------------------------------------------------
-- The default template (the protocol as it looked before templates). The
-- same JSON as DEFAULT_PROTOCOL_TEMPLATE; a test keeps them equal.
-- ---------------------------------------------------------------------------

create or replace function public.default_protocol_template()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select $json${
  "schema": 1,
  "page": {
    "size": "A4",
    "orientation": "portrait",
    "margins": {
      "top": 14,
      "right": 15,
      "bottom": 14,
      "left": 15
    }
  },
  "style": {
    "font": "noto-sans",
    "size": 8.5
  },
  "blocks": [
    {
      "id": "header",
      "type": "header",
      "logo": {
        "show": true,
        "position": "left",
        "heightMm": 15
      },
      "company": [
        "address",
        "ids",
        "contact"
      ],
      "title": null,
      "date": false
    },
    {
      "id": "parties",
      "type": "parties",
      "customer": {
        "show": true,
        "fields": [
          "billingAddress",
          "ids",
          "contact"
        ]
      },
      "site": {
        "show": true,
        "address": true
      },
      "facts": [
        "date",
        "technician",
        "issued",
        "version"
      ]
    },
    {
      "id": "devices",
      "type": "devices",
      "title": null,
      "summary": true,
      "columns": [
        {
          "key": "label",
          "width": 9
        },
        {
          "key": "type",
          "width": 23
        },
        {
          "key": "location",
          "width": 19
        },
        {
          "key": "serial",
          "width": 17
        },
        {
          "key": "result",
          "width": 16
        },
        {
          "key": "nextDue",
          "width": 16
        }
      ],
      "columnsWithScan": [
        {
          "key": "label",
          "width": 9
        },
        {
          "key": "type",
          "width": 19
        },
        {
          "key": "location",
          "width": 16
        },
        {
          "key": "serial",
          "width": 15
        },
        {
          "key": "result",
          "width": 14
        },
        {
          "key": "nextDue",
          "width": 14
        },
        {
          "key": "scan",
          "width": 13
        }
      ],
      "details": true
    },
    {
      "id": "defects",
      "type": "defects",
      "title": null,
      "photos": {
        "perDefect": 2,
        "widthMm": 28
      },
      "whenEmpty": "text"
    },
    {
      "id": "notes",
      "type": "notes",
      "title": null
    },
    {
      "id": "signatures",
      "type": "signatures",
      "fields": [
        {
          "role": "technician",
          "label": null
        },
        {
          "role": "customer",
          "label": null
        }
      ],
      "hint": true
    }
  ],
  "footer": {
    "text": "organization",
    "custom": "",
    "pageNumbers": true
  }
}$json$::jsonb
$$;

-- Gives a company its published default template, once.
create or replace function public.seed_protocol_template(p_org uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_locale text;
  v_template uuid;
  v_version uuid;
begin
  if exists (
    select 1 from public.protocol_templates where organization_id = p_org and usage = 'inspection'
  ) then
    return null;
  end if;
  select default_locale into v_locale from public.organizations where id = p_org;

  insert into public.protocol_templates (organization_id, name, description, usage, status)
  values (
    p_org,
    case when v_locale = 'en' then 'Default protocol' else 'Výchozí protokol' end,
    case when v_locale = 'en'
      then 'The protocol as SparxDeck draws it. Copy it to make your own.'
      else 'Protokol tak, jak ho kreslí SparxDeck. Zkopírujte ho a upravte podle sebe.' end,
    'inspection',
    'published'
  )
  returning id into v_template;

  insert into public.protocol_template_versions (organization_id, template_id, version, content, note)
  values (
    p_org, v_template, 1, public.default_protocol_template(),
    case when v_locale = 'en' then 'Default layout' else 'Výchozí vzhled' end
  )
  returning id into v_version;

  update public.protocol_templates
  set current_version_id = v_version, is_default = true
  where id = v_template;

  insert into public.protocol_template_events (organization_id, template_id, kind, version)
  values (p_org, v_template, 'created', null), (p_org, v_template, 'published', 1);
  return v_template;
end;
$$;

revoke all on function public.seed_protocol_template(uuid) from public, anon, authenticated;

create or replace function public.seed_new_organization_protocol_template()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.seed_protocol_template(new.id);
  return new;
end;
$$;

create trigger organizations_protocol_template
  after insert on public.organizations
  for each row execute function public.seed_new_organization_protocol_template();

-- Existing companies get theirs now.
select public.seed_protocol_template(id) from public.organizations;

-- ---------------------------------------------------------------------------
-- Publishing: a new version that never changes, from the app's checked JSON.
-- ---------------------------------------------------------------------------

create or replace function public.publish_protocol_template(p_template uuid, p_content jsonb, p_note text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_template public.protocol_templates%rowtype;
  v_note text := btrim(coalesce(p_note, ''));
  v_version integer;
  v_id uuid;
begin
  select * into v_template from public.protocol_templates where id = p_template for update;
  if v_template.id is null
    or not public.has_role(v_template.organization_id, array['owner', 'admin']::public.member_role[]) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_template.status = 'archived' then
    raise exception 'template_archived' using errcode = 'P0001';
  end if;
  if char_length(v_note) not between 1 and 500 then
    raise exception 'note_required' using errcode = 'P0001';
  end if;
  if p_content is null or jsonb_typeof(p_content) <> 'object'
    or (p_content ->> 'schema') is distinct from '1' then
    raise exception 'invalid_template' using errcode = 'P0001';
  end if;

  select coalesce(max(version), 0) + 1 into v_version
    from public.protocol_template_versions where template_id = p_template;
  insert into public.protocol_template_versions
    (organization_id, template_id, version, content, note, published_by)
  values (v_template.organization_id, p_template, v_version, p_content, v_note, (select auth.uid()))
  returning id into v_id;

  update public.protocol_templates
  set current_version_id = v_id, status = 'published', draft = null
  where id = p_template;

  insert into public.protocol_template_events (organization_id, template_id, kind, version, note, actor)
  values (v_template.organization_id, p_template, 'published', v_version, v_note, (select auth.uid()));
  return v_version;
end;
$$;

revoke all on function public.publish_protocol_template(uuid, jsonb, text) from public, anon;
grant execute on function public.publish_protocol_template(uuid, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- The version a new protocol is drawn by: the customer's template, else the
-- template of the device type when every device of the inspection is of that
-- one type, else the company's default. Fixed when the protocol is numbered.
-- ---------------------------------------------------------------------------

create or replace function public.protocol_template_version_for(p_inspection uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_customer uuid;
  v_type uuid;
  v_version uuid;
begin
  select i.organization_id, s.customer_id into v_org, v_customer
  from public.inspections i join public.sites s on s.id = i.site_id
  where i.id = p_inspection;

  select t.current_version_id into v_version
  from public.protocol_template_assignments a
  join public.protocol_templates t on t.id = a.template_id
  where a.customer_id = v_customer and t.status = 'published' and t.usage = 'inspection';
  if v_version is not null then
    return v_version;
  end if;

  select (array_agg(distinct d.device_type_id))[1] into v_type
  from public.inspection_items it join public.devices d on d.id = it.device_id
  where it.inspection_id = p_inspection
  having count(distinct d.device_type_id) = 1;
  if v_type is not null then
    select t.current_version_id into v_version
    from public.protocol_template_assignments a
    join public.protocol_templates t on t.id = a.template_id
    where a.device_type_id = v_type and t.status = 'published' and t.usage = 'inspection';
    if v_version is not null then
      return v_version;
    end if;
  end if;

  select current_version_id into v_version
  from public.protocol_templates
  where organization_id = v_org and usage = 'inspection' and is_default and status = 'published';
  return v_version;
end;
$$;

revoke all on function public.protocol_template_version_for(uuid) from public, anon, authenticated;

-- Every new protocol records its template version. A reissue after a
-- correction keeps the version of the protocol it replaces (its look must not
-- change); a protocol from before templates (none) stays with the default look.
create or replace function public.stamp_protocol_template()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.template_version_id is not null then
    return new;
  end if;
  if new.version > 1 then
    select template_version_id into new.template_version_id
    from public.protocols
    where inspection_id = new.inspection_id and version = new.version - 1;
  else
    new.template_version_id := public.protocol_template_version_for(new.inspection_id);
  end if;
  return new;
end;
$$;

create trigger protocols_template_version
  before insert on public.protocols
  for each row execute function public.stamp_protocol_template();
