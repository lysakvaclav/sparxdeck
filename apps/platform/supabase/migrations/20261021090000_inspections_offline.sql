-- Part 16: inspections without a signal.
--
-- A phone fills in checks without a connection and sends them later. Two calls
-- make that safe:
-- * claim_device_check: opens (or creates) the device's check for the phone and
--   says whether a colleague checked it in the meantime (a conflict the
--   technician decides) or is filling it in right now.
-- * submit_device_check: writes everything the phone has for the check at once
--   (answers, the device note, finishing or leaving it out) with the time it was
--   actually done, not the time the signal came back.

-- ---------------------------------------------------------------------------
-- Claiming a check
-- ---------------------------------------------------------------------------

-- Returns {"item", "template"} when the current user now holds the check,
-- {"item", "heldBy"} while a colleague fills it in, and {"item", "conflict"}
-- when it was checked (or left out) by a colleague after the phone saw it
-- (p_seen: the checked_at the phone knew, null for none) or answered on another
-- checklist version. p_template is the version the phone answered (any version
-- of the device's type); p_take_over takes the check anyway, replacing a
-- colleague's version.
create or replace function public.claim_device_check(
  p_inspection uuid,
  p_device uuid,
  p_template uuid default null,
  p_seen timestamptz default null,
  p_take_over boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_inspection public.inspections%rowtype;
  v_device public.devices%rowtype;
  v_item public.inspection_items%rowtype;
  v_template uuid;
  v_conflict boolean := false;
  v_by uuid;
  v_name text;
begin
  select * into v_inspection from public.inspections where id = p_inspection;
  if v_inspection.id is null or not public.is_member(v_inspection.organization_id) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_inspection.status <> 'in_progress' then
    raise exception 'inspection_closed' using errcode = 'P0001';
  end if;
  select * into v_device from public.devices
  where id = p_device and site_id = v_inspection.site_id and deleted_at is null;
  if v_device.id is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if p_template is not null then
    select id into v_template from public.checklist_templates
    where id = p_template
      and device_type_id = v_device.device_type_id
      and organization_id = v_inspection.organization_id;
    if v_template is null then
      raise exception 'not_found' using errcode = 'P0001';
    end if;
  end if;

  select * into v_item from public.inspection_items
  where inspection_id = p_inspection and device_id = p_device
  for update;

  if v_item.id is null then
    if v_device.status <> 'active' then
      raise exception 'device_inactive' using errcode = 'P0001';
    end if;
    if v_template is null then
      select id into v_template from public.checklist_templates
      where device_type_id = v_device.device_type_id and active;
      if v_template is null then
        raise exception 'no_template' using errcode = 'P0001';
      end if;
    end if;
    insert into public.inspection_items (organization_id, inspection_id, device_id, template_id)
    values (v_inspection.organization_id, p_inspection, p_device, v_template)
    on conflict (inspection_id, device_id) do nothing;
    select * into v_item from public.inspection_items
    where inspection_id = p_inspection and device_id = p_device
    for update;
  end if;

  if not p_take_over then
    -- Checked or left out by a colleague since the phone looked.
    if v_item.checked_at is not null
       and v_item.checked_by is distinct from v_user
       and v_item.checked_at is distinct from p_seen then
      v_conflict := true;
      v_by := v_item.checked_by;
    -- Answered by a colleague on another checklist version.
    elsif v_template is not null and v_template <> v_item.template_id then
      select answered_by into v_by from public.inspection_answers
      where item_id = v_item.id
      order by updated_at desc
      limit 1;
      v_conflict := found and v_by is distinct from v_user;
    end if;
    if v_conflict then
      select display_name into v_name from public.memberships
      where user_id = v_by and organization_id = v_item.organization_id;
      return jsonb_build_object(
        'item', v_item.id,
        'conflict', jsonb_build_object(
          'name', coalesce(v_name, '?'),
          'outcome', v_item.outcome,
          'skipReason', v_item.skip_reason,
          'checkedAt', v_item.checked_at
        )
      );
    end if;

    if v_item.editing_by is not null
       and v_item.editing_by <> v_user
       and not public.check_hold_expired(v_item.editing_at) then
      select display_name into v_name from public.memberships
      where user_id = v_item.editing_by and organization_id = v_item.organization_id;
      return jsonb_build_object('item', v_item.id, 'heldBy', coalesce(v_name, '?'));
    end if;
  end if;

  -- The phone's checklist version: answers on another version don't apply to
  -- its questions, so they go; photos stay, as photos of the whole device.
  if v_template is not null and v_template <> v_item.template_id then
    delete from public.inspection_answers where item_id = v_item.id;
    update public.inspection_photos set template_item_id = null where item_id = v_item.id;
    update public.inspection_items
    set template_id = v_template, outcome = null, skip_reason = null,
        checked_at = null, checked_by = null
    where id = v_item.id;
    v_item.template_id := v_template;
  end if;

  update public.inspection_items
  set editing_by = v_user, editing_at = now()
  where id = v_item.id;
  return jsonb_build_object('item', v_item.id, 'template', v_item.template_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Submitting a check
-- ---------------------------------------------------------------------------

-- Writes the phone's state of a check in one transaction: answers by question
-- id ({"pass", "number", "text", "note", "severity"}), the device note when
-- p_set_notes, then p_action: 'save' (keep it open; p_release lets go of it),
-- 'finish' or 'skip' (with p_skip_reason). p_replace drops answers the phone
-- doesn't have (a colleague's, after a conflict). The time it was done is
-- p_checked_at, kept between the inspection's start and now.
create or replace function public.submit_device_check(
  p_item uuid,
  p_answers jsonb default '{}'::jsonb,
  p_notes text default null,
  p_set_notes boolean default false,
  p_action text default 'save',
  p_skip_reason public.check_skip_reason default null,
  p_checked_at timestamptz default null,
  p_replace boolean default false,
  p_release boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_item public.inspection_items%rowtype;
  v_started timestamptz;
  v_answers jsonb := coalesce(p_answers, '{}'::jsonb);
  v_entry record;
  v_at timestamptz;
  v_outcome public.check_outcome;
begin
  v_item := public.held_check(p_item);
  if p_action not in ('save', 'finish', 'skip')
     or jsonb_typeof(v_answers) <> 'object'
     or (p_action = 'skip' and p_skip_reason is null) then
    raise exception 'invalid_answer' using errcode = 'P0001';
  end if;

  if p_replace then
    delete from public.inspection_answers a
    where a.item_id = p_item
      and not exists (select 1 from jsonb_object_keys(v_answers) k where k = a.template_item_id::text);
  end if;
  for v_entry in select key, value from jsonb_each(v_answers) loop
    if jsonb_typeof(v_entry.value) <> 'object' then
      raise exception 'invalid_answer' using errcode = 'P0001';
    end if;
    perform public.save_answer(
      p_item,
      v_entry.key::uuid,
      (v_entry.value ->> 'pass')::boolean,
      (v_entry.value ->> 'number')::numeric,
      v_entry.value ->> 'text',
      v_entry.value ->> 'note',
      (v_entry.value ->> 'severity')::public.defect_severity
    );
  end loop;
  if p_set_notes then
    perform public.save_check_note(p_item, p_notes);
  end if;

  select started_at into v_started from public.inspections where id = v_item.inspection_id;
  v_at := least(now(), greatest(coalesce(p_checked_at, now()), v_started));

  if p_action = 'finish' then
    if not public.check_answers_complete(p_item) then
      raise exception 'check_incomplete' using errcode = 'P0001';
    end if;
    v_outcome := public.check_outcome_of(p_item);
    update public.inspection_items
    set outcome = v_outcome, skip_reason = null, checked_at = v_at, checked_by = v_user,
        editing_by = null, editing_at = null
    where id = p_item;
  elsif p_action = 'skip' then
    v_outcome := 'not_checked';
    update public.inspection_items
    set outcome = v_outcome, skip_reason = p_skip_reason, checked_at = v_at, checked_by = v_user,
        editing_by = null, editing_at = null
    where id = p_item;
  elsif p_release then
    update public.inspection_items set editing_by = null, editing_at = null where id = p_item;
  end if;

  return jsonb_build_object(
    'outcome', v_outcome,
    'checkedAt', case when v_outcome is null then null else v_at end
  );
end;
$$;

revoke all on function public.claim_device_check(uuid, uuid, uuid, timestamptz, boolean) from public, anon;
grant execute on function public.claim_device_check(uuid, uuid, uuid, timestamptz, boolean) to authenticated;
revoke all on function public.submit_device_check(uuid, jsonb, text, boolean, text, public.check_skip_reason, timestamptz, boolean, boolean) from public, anon;
grant execute on function public.submit_device_check(uuid, jsonb, text, boolean, text, public.check_skip_reason, timestamptz, boolean, boolean) to authenticated;
