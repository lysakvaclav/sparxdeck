-- Part 15: inspections in the field, round two.
--
-- * A device that can't be checked (inaccessible, missing) is left out with a
--   reason: it counts as handled, its due date doesn't move and it records no
--   defects. Answering it again reopens the check and drops the reason.
-- * A device found in the building that isn't on the list is added during the
--   inspection by whoever does it (also a technician), and checked right away.
-- * An inspection started by mistake is cancelled by whoever started it or by
--   an owner or admin; its photos are returned for the server to delete.

create type public.check_skip_reason as enum ('inaccessible', 'missing');

alter table public.inspection_items add column skip_reason public.check_skip_reason;
alter table public.inspection_items add constraint inspection_items_skip_reason_check
  check (skip_reason is null or outcome = 'not_checked');

-- Reopening or answering a left-out check makes it an ordinary one again.
create or replace function public.clear_skip_reason()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.outcome is distinct from 'not_checked' then
    new.skip_reason := null;
  end if;
  return new;
end;
$$;

create trigger inspection_items_clear_skip_reason
  before update of outcome on public.inspection_items
  for each row execute function public.clear_skip_reason();

-- The inspection a device was added in (to print its label afterwards).
alter table public.devices add column added_in_inspection uuid;
alter table public.devices add constraint devices_added_in_inspection_fkey
  foreign key (added_in_inspection, organization_id)
  references public.inspections (id, organization_id) on delete set null (added_in_inspection);
create index devices_added_in_inspection_idx on public.devices (added_in_inspection)
  where added_in_inspection is not null;

-- ---------------------------------------------------------------------------
-- Leaving a device out
-- ---------------------------------------------------------------------------

create or replace function public.skip_device_check(
  p_item uuid,
  p_reason public.check_skip_reason,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.inspection_items%rowtype;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  v_item := public.held_check(p_item);
  if p_reason is null or char_length(v_note) > 2000 then
    raise exception 'invalid_answer' using errcode = 'P0001';
  end if;
  update public.inspection_items
  set outcome = 'not_checked',
      skip_reason = p_reason,
      notes = coalesce(v_note, notes),
      checked_at = now(),
      checked_by = (select auth.uid()),
      editing_by = null,
      editing_at = null
  where id = p_item;
end;
$$;

-- ---------------------------------------------------------------------------
-- Adding a device found during the inspection
-- ---------------------------------------------------------------------------

create or replace function public.add_inspection_device(
  p_inspection uuid,
  p_device_type uuid,
  p_location uuid default null,
  p_serial_number text default null,
  p_manufacturer text default null,
  p_model text default null,
  p_manufacture_year integer default null,
  p_attributes jsonb default '{}'::jsonb,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inspection public.inspections%rowtype;
  v_serial text := nullif(btrim(coalesce(p_serial_number, '')), '');
  v_id uuid;
begin
  select * into v_inspection from public.inspections where id = p_inspection;
  if v_inspection.id is null or not public.is_member(v_inspection.organization_id) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_inspection.status <> 'in_progress' then
    raise exception 'inspection_closed' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.device_types
    where id = p_device_type and organization_id = v_inspection.organization_id and active
  ) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.checklist_templates where device_type_id = p_device_type and active
  ) then
    raise exception 'no_template' using errcode = 'P0001';
  end if;
  if p_location is not null and not exists (
    select 1 from public.locations where id = p_location and site_id = v_inspection.site_id
  ) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_serial is not null and exists (
    select 1 from public.devices
    where site_id = v_inspection.site_id and deleted_at is null
      and lower(serial_number) = lower(v_serial)
  ) then
    raise exception 'device_exists' using errcode = 'P0001';
  end if;
  if jsonb_typeof(coalesce(p_attributes, '{}'::jsonb)) <> 'object' then
    raise exception 'invalid_answer' using errcode = 'P0001';
  end if;

  insert into public.devices
    (organization_id, site_id, location_id, device_type_id, serial_number, manufacturer, model,
     manufacture_year, attributes, status, notes, created_by, added_in_inspection)
  values (
    v_inspection.organization_id,
    v_inspection.site_id,
    p_location,
    p_device_type,
    v_serial,
    nullif(btrim(coalesce(p_manufacturer, '')), ''),
    nullif(btrim(coalesce(p_model, '')), ''),
    p_manufacture_year,
    coalesce(p_attributes, '{}'::jsonb),
    'active',
    nullif(btrim(coalesce(p_notes, '')), ''),
    (select auth.uid()),
    p_inspection
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Cancelling an inspection in progress
-- ---------------------------------------------------------------------------

create or replace function public.cancel_inspection(p_inspection uuid)
returns table (path text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inspection public.inspections%rowtype;
  v_paths text[];
begin
  select * into v_inspection from public.inspections where id = p_inspection for update;
  if v_inspection.id is null or not public.is_member(v_inspection.organization_id) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_inspection.status <> 'in_progress' then
    raise exception 'inspection_closed' using errcode = 'P0001';
  end if;
  if v_inspection.started_by is distinct from (select auth.uid())
     and not public.has_role(v_inspection.organization_id, array['owner', 'admin']::public.member_role[]) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  -- The photos, before their rows go (devices added in it stay, without the link).
  select coalesce(array_agg(p.storage_path), '{}') into v_paths
  from public.inspection_photos p
  join public.inspection_items i on i.id = p.item_id
  where i.inspection_id = p_inspection;

  delete from public.inspections where id = p_inspection;
  return query select unnest(v_paths);
end;
$$;

-- ---------------------------------------------------------------------------
-- Completing: defects only from failed checks; left-out devices counted
-- ---------------------------------------------------------------------------

create or replace function public.complete_inspection(p_inspection uuid, p_notes text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inspection public.inspections%rowtype;
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  v_found record;
  v_existing uuid;
  v_id uuid;
  v_created integer := 0;
  v_protocol uuid;
  v_result jsonb;
begin
  select * into v_inspection from public.inspections where id = p_inspection for update;
  if v_inspection.id is null or not public.is_member(v_inspection.organization_id) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_inspection.status <> 'in_progress' then
    raise exception 'inspection_closed' using errcode = 'P0001';
  end if;
  if char_length(v_notes) > 5000 then
    raise exception 'invalid_answer' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.inspection_items where inspection_id = p_inspection and outcome is null
  ) then
    raise exception 'checks_unfinished' using errcode = 'P0001';
  end if;

  insert into public.inspection_items (organization_id, inspection_id, device_id, outcome)
  select d.organization_id, p_inspection, d.id, 'not_checked'
  from public.devices d
  where d.site_id = v_inspection.site_id
    and d.deleted_at is null
    and d.status = 'active'
    and not exists (
      select 1 from public.inspection_items i
      where i.inspection_id = p_inspection and i.device_id = d.id
    );

  update public.devices d
  set last_inspection_on = greatest(coalesce(d.last_inspection_on, checked.day), checked.day)
  from (
    select i.device_id, (i.checked_at at time zone o.timezone)::date as day
    from public.inspection_items i
    join public.organizations o on o.id = i.organization_id
    where i.inspection_id = p_inspection and i.outcome = 'passed'
  ) as checked
  where d.id = checked.device_id;

  -- Failed answers of failed checks: added to the open defect of the same
  -- question on the device (whether or not the answer asked for a defect),
  -- otherwise a new defect when the question always records one or a severity
  -- was chosen. A device left out (inaccessible, missing) records nothing.
  for v_found in
    select i.id as item_id, i.device_id, i.checked_by, t.id as question, t.label,
           a.note, coalesce(a.defect_severity, 'major'::public.defect_severity) as severity,
           (t.fail_creates_defect or a.defect_severity is not null) as records
    from public.inspection_items i
    join public.inspection_answers a on a.item_id = i.id
    join public.checklist_template_items t on t.id = a.template_item_id
    where i.inspection_id = p_inspection
      and i.outcome = 'failed'
      and t.item_type = 'pass_fail'
      and a.value_pass = false
    order by i.device_id, t.sort_order
  loop
    select d.id into v_existing
    from public.defects d
    join public.checklist_template_items q on q.id = d.template_item_id
    where d.device_id = v_found.device_id
      and d.status <> 'resolved'
      and q.label = v_found.label
    limit 1;
    if v_existing is not null then
      insert into public.defect_events
        (organization_id, defect_id, kind, actor, note, inspection_id)
      values
        (v_inspection.organization_id, v_existing, 'observed', v_found.checked_by, v_found.note,
         p_inspection);
    elsif v_found.records then
      insert into public.defects
        (organization_id, device_id, inspection_id, inspection_item_id, template_item_id,
         description, severity, created_by)
      values
        (v_inspection.organization_id, v_found.device_id, p_inspection, v_found.item_id,
         v_found.question,
         left(v_found.label || coalesce(': ' || v_found.note, ''), 2000),
         v_found.severity, v_found.checked_by)
      returning id into v_id;
      insert into public.defect_events
        (organization_id, defect_id, kind, actor, to_value, inspection_id)
      values
        (v_inspection.organization_id, v_id, 'created', v_found.checked_by,
         v_found.severity::text, p_inspection);
      v_created := v_created + 1;
    end if;
  end loop;

  update public.inspection_items
  set editing_by = null, editing_at = null
  where inspection_id = p_inspection;

  update public.inspections
  set status = 'completed',
      completed_at = now(),
      completed_by = (select auth.uid()),
      notes = v_notes
  where id = p_inspection;

  -- The protocol's number is taken in the same transaction: no gaps, no duplicates.
  v_protocol := public.assign_protocol(p_inspection);

  select jsonb_build_object(
    'passed', count(*) filter (where outcome = 'passed'),
    'failed', count(*) filter (where outcome = 'failed'),
    'notChecked', count(*) filter (where outcome = 'not_checked'),
    'skipped', count(*) filter (where skip_reason is not null),
    'defects', v_created,
    'protocol', v_protocol
  ) into v_result
  from public.inspection_items where inspection_id = p_inspection;
  return v_result;
end;
$$;

revoke all on function public.clear_skip_reason() from public, anon, authenticated;
revoke all on function public.skip_device_check(uuid, public.check_skip_reason, text) from public, anon;
grant execute on function public.skip_device_check(uuid, public.check_skip_reason, text) to authenticated;
revoke all on function public.add_inspection_device(uuid, uuid, uuid, text, text, text, integer, jsonb, text) from public, anon;
grant execute on function public.add_inspection_device(uuid, uuid, uuid, text, text, text, integer, jsonb, text) to authenticated;
revoke all on function public.cancel_inspection(uuid) from public, anon;
grant execute on function public.cancel_inspection(uuid) to authenticated;
