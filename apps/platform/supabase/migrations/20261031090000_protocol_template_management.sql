-- Part 22, stage D: managing protocol templates. Owners and admins set the
-- company's default, archive and restore a template, copy one, import one
-- from a file, restore an older version as the draft, and assign a template
-- to customers and device types. Every such change is in the template's
-- history (protocol_template_events); a rename and an assignment are recorded
-- by triggers, whatever makes them.
--
-- Additive only (functions and triggers). Rollback:
--   drop trigger protocol_templates_renamed on public.protocol_templates;
--   drop trigger protocol_template_assignments_logged on public.protocol_template_assignments;
--   drop function public.log_protocol_template_rename(), public.log_protocol_template_assignment(),
--     public.set_default_protocol_template(uuid), public.archive_protocol_template(uuid),
--     public.unarchive_protocol_template(uuid), public.copy_protocol_template(uuid, text),
--     public.import_protocol_template(text, text, jsonb), public.restore_protocol_template_version(uuid),
--     public.set_protocol_template_assignments(uuid, uuid[], uuid[]),
--     public.managed_protocol_template(uuid);

-- ---------------------------------------------------------------------------
-- History kept by triggers: renames and assignments.
-- ---------------------------------------------------------------------------

create or replace function public.log_protocol_template_rename()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.name is distinct from old.name then
    insert into public.protocol_template_events (organization_id, template_id, kind, note, actor)
    values (new.organization_id, new.id, 'renamed', left(old.name || ' → ' || new.name, 500), (select auth.uid()));
  end if;
  return new;
end;
$$;

create trigger protocol_templates_renamed
  after update of name on public.protocol_templates
  for each row execute function public.log_protocol_template_rename();

create or replace function public.log_protocol_template_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.protocol_template_assignments%rowtype;
  v_target text;
begin
  v_row := case when tg_op = 'DELETE' then old else new end;
  -- Deleting a whole company or template removes these too: nothing to tell then.
  if not exists (select 1 from public.protocol_templates where id = v_row.template_id) then
    return null;
  end if;
  if v_row.customer_id is not null then
    select name into v_target from public.customers where id = v_row.customer_id;
  else
    select name into v_target from public.device_types where id = v_row.device_type_id;
  end if;
  insert into public.protocol_template_events (organization_id, template_id, kind, note, actor)
  values (
    v_row.organization_id, v_row.template_id, 'assigned',
    left((case when tg_op = 'DELETE' then '− ' else '+ ' end) || coalesce(v_target, ''), 500),
    (select auth.uid())
  );
  return null;
end;
$$;

create trigger protocol_template_assignments_logged
  after insert or delete on public.protocol_template_assignments
  for each row execute function public.log_protocol_template_assignment();

-- ---------------------------------------------------------------------------
-- A template of the caller's company that an owner or admin may manage.
-- ---------------------------------------------------------------------------

create or replace function public.managed_protocol_template(p_template uuid)
returns public.protocol_templates
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_template public.protocol_templates%rowtype;
begin
  select * into v_template from public.protocol_templates where id = p_template for update;
  if v_template.id is null
    or not public.has_role(v_template.organization_id, array['owner', 'admin']::public.member_role[]) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  return v_template;
end;
$$;

revoke all on function public.managed_protocol_template(uuid) from public, anon, authenticated;

-- The company's template for its usage: published, one at a time.
create or replace function public.set_default_protocol_template(p_template uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_template public.protocol_templates%rowtype := public.managed_protocol_template(p_template);
begin
  if v_template.status <> 'published' then
    raise exception 'template_not_published' using errcode = 'P0001';
  end if;
  if v_template.is_default then
    return;
  end if;
  update public.protocol_templates set is_default = false
  where organization_id = v_template.organization_id and usage = v_template.usage and is_default;
  update public.protocol_templates set is_default = true where id = p_template;
  insert into public.protocol_template_events (organization_id, template_id, kind, actor)
  values (v_template.organization_id, p_template, 'default', (select auth.uid()));
end;
$$;

-- Archived: no new protocol uses it (its assignments go), issued ones stay as they are.
create or replace function public.archive_protocol_template(p_template uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_template public.protocol_templates%rowtype := public.managed_protocol_template(p_template);
begin
  if v_template.is_default then
    raise exception 'template_default' using errcode = 'P0001';
  end if;
  if v_template.status = 'archived' then
    return;
  end if;
  delete from public.protocol_template_assignments where template_id = p_template;
  update public.protocol_templates set status = 'archived' where id = p_template;
  insert into public.protocol_template_events (organization_id, template_id, kind, actor)
  values (v_template.organization_id, p_template, 'archived', (select auth.uid()));
end;
$$;

create or replace function public.unarchive_protocol_template(p_template uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_template public.protocol_templates%rowtype := public.managed_protocol_template(p_template);
begin
  if v_template.status <> 'archived' then
    return;
  end if;
  update public.protocol_templates
  set status = case when current_version_id is null then 'draft' else 'published' end::public.protocol_template_status
  where id = p_template;
  insert into public.protocol_template_events (organization_id, template_id, kind, actor)
  values (v_template.organization_id, p_template, 'restored', (select auth.uid()));
end;
$$;

-- A copy as a new draft: the source's draft, else its current version.
create or replace function public.copy_protocol_template(p_template uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_template public.protocol_templates%rowtype := public.managed_protocol_template(p_template);
  v_content jsonb;
  v_name text := btrim(coalesce(p_name, ''));
  v_id uuid;
begin
  if char_length(v_name) not between 1 and 120 then
    raise exception 'invalid_name' using errcode = 'P0001';
  end if;
  v_content := v_template.draft;
  if v_content is null then
    select content into v_content from public.protocol_template_versions where id = v_template.current_version_id;
  end if;
  insert into public.protocol_templates (organization_id, name, description, usage, locale, draft)
  values (v_template.organization_id, v_name, v_template.description, v_template.usage, v_template.locale, v_content)
  returning id into v_id;
  insert into public.protocol_template_events (organization_id, template_id, kind, note, actor)
  values (v_template.organization_id, v_id, 'copied', left(v_template.name, 500), (select auth.uid()));
  return v_id;
end;
$$;

-- A template from a file (checked by the app before; drawn only once it passes again).
create or replace function public.import_protocol_template(p_name text, p_description text, p_content jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_name text := btrim(coalesce(p_name, ''));
  v_id uuid;
begin
  select organization_id into v_org from public.memberships
  where user_id = (select auth.uid()) and role in ('owner', 'admin')
  order by created_at limit 1;
  if v_org is null then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if char_length(v_name) not between 1 and 120 then
    raise exception 'invalid_name' using errcode = 'P0001';
  end if;
  if p_content is null or jsonb_typeof(p_content) <> 'object' or (p_content ->> 'schema') is distinct from '1' then
    raise exception 'invalid_template' using errcode = 'P0001';
  end if;
  insert into public.protocol_templates (organization_id, name, description, draft)
  values (v_org, v_name, nullif(left(btrim(coalesce(p_description, '')), 500), ''), p_content)
  returning id into v_id;
  insert into public.protocol_template_events (organization_id, template_id, kind, actor)
  values (v_org, v_id, 'imported', (select auth.uid()));
  return v_id;
end;
$$;

-- An older version becomes the draft again (a new version once published).
create or replace function public.restore_protocol_template_version(p_version uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version public.protocol_template_versions%rowtype;
  v_template public.protocol_templates%rowtype;
begin
  select * into v_version from public.protocol_template_versions where id = p_version;
  if v_version.id is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  v_template := public.managed_protocol_template(v_version.template_id);
  if v_template.status = 'archived' then
    raise exception 'template_archived' using errcode = 'P0001';
  end if;
  update public.protocol_templates set draft = v_version.content where id = v_template.id;
  insert into public.protocol_template_events (organization_id, template_id, kind, version, actor)
  values (v_template.organization_id, v_template.id, 'restored', v_version.version, (select auth.uid()));
end;
$$;

-- The customers and device types a template is for. A customer or type
-- assigned to another template moves to this one (one template each).
create or replace function public.set_protocol_template_assignments(
  p_template uuid,
  p_customers uuid[],
  p_device_types uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_template public.protocol_templates%rowtype := public.managed_protocol_template(p_template);
  v_customers uuid[] := coalesce(p_customers, '{}');
  v_types uuid[] := coalesce(p_device_types, '{}');
begin
  if v_template.status <> 'published' or v_template.usage <> 'inspection' then
    raise exception 'template_not_published' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from unnest(v_customers) as c(id)
    where not exists (
      select 1 from public.customers where id = c.id and organization_id = v_template.organization_id
    )
  ) or exists (
    select 1 from unnest(v_types) as t(id)
    where not exists (
      select 1 from public.device_types where id = t.id and organization_id = v_template.organization_id
    )
  ) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  -- What this template no longer has, and what moves here from another template.
  delete from public.protocol_template_assignments
  where organization_id = v_template.organization_id
    and (
      (template_id = p_template and (
        (customer_id is not null and not customer_id = any (v_customers))
        or (device_type_id is not null and not device_type_id = any (v_types))
      ))
      or (template_id <> p_template and (customer_id = any (v_customers) or device_type_id = any (v_types)))
    );
  insert into public.protocol_template_assignments (organization_id, template_id, customer_id, created_by)
  select v_template.organization_id, p_template, c.id, (select auth.uid())
  from unnest(v_customers) as c(id)
  where not exists (
    select 1 from public.protocol_template_assignments where template_id = p_template and customer_id = c.id
  );
  insert into public.protocol_template_assignments (organization_id, template_id, device_type_id, created_by)
  select v_template.organization_id, p_template, t.id, (select auth.uid())
  from unnest(v_types) as t(id)
  where not exists (
    select 1 from public.protocol_template_assignments where template_id = p_template and device_type_id = t.id
  );
end;
$$;

revoke all on function public.set_default_protocol_template(uuid) from public, anon;
revoke all on function public.archive_protocol_template(uuid) from public, anon;
revoke all on function public.unarchive_protocol_template(uuid) from public, anon;
revoke all on function public.copy_protocol_template(uuid, text) from public, anon;
revoke all on function public.import_protocol_template(text, text, jsonb) from public, anon;
revoke all on function public.restore_protocol_template_version(uuid) from public, anon;
revoke all on function public.set_protocol_template_assignments(uuid, uuid[], uuid[]) from public, anon;
grant execute on function public.set_default_protocol_template(uuid) to authenticated;
grant execute on function public.archive_protocol_template(uuid) to authenticated;
grant execute on function public.unarchive_protocol_template(uuid) to authenticated;
grant execute on function public.copy_protocol_template(uuid, text) to authenticated;
grant execute on function public.import_protocol_template(text, text, jsonb) to authenticated;
grant execute on function public.restore_protocol_template_version(uuid) to authenticated;
grant execute on function public.set_protocol_template_assignments(uuid, uuid[], uuid[]) to authenticated;
