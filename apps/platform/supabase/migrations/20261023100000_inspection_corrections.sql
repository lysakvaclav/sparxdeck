-- Part 18: a correction of a completed inspection must not change what really
-- happened on site.
--
-- * Due dates: reopening takes back the dates the inspection moved (unless
--   something moved them since); completing again applies them from the
--   original check dates, not from the day of the correction.
-- * The protocol keeps the original inspection date and technicians.
-- * Defects: what the inspection already recorded isn't recorded twice.
-- * While a correction is open, nobody starts a new inspection into it by
--   accident, and it can't be cancelled (that would delete the original).

-- ---------------------------------------------------------------------------
-- What a completion builds on, kept per check
-- ---------------------------------------------------------------------------

alter table public.inspection_items
  -- The first finished result of the check: a correction keeps its date and
  -- technician for due dates and the protocol.
  add column original_checked_at timestamptz,
  add column original_checked_by uuid references auth.users (id) on delete set null,
  -- The device's last inspection date just before this inspection applied its
  -- own, so a reopening can take it back. Unknown for older inspections.
  add column device_last_before date,
  add column device_last_known boolean not null default false;

update public.inspection_items i
set original_checked_at = i.checked_at, original_checked_by = i.checked_by
from public.inspections s
where s.id = i.inspection_id and s.status = 'completed' and i.outcome in ('passed', 'failed');

alter table public.inspection_reopenings
  -- The completion the reopening interrupted (restored when it completes again).
  add column previous_completed_at timestamptz,
  add column previous_completed_by uuid references auth.users (id) on delete set null,
  -- When and by whom the correction was completed.
  add column completed_at timestamptz,
  add column completed_by uuid references auth.users (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Reopening: records the interrupted completion and takes back due dates
-- ---------------------------------------------------------------------------

create or replace function public.reopen_inspection(p_inspection uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inspection public.inspections%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  select * into v_inspection from public.inspections where id = p_inspection for update;
  if v_inspection.id is null or not public.is_member(v_inspection.organization_id) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if not public.has_role(v_inspection.organization_id, array['owner', 'admin']::public.member_role[]) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if v_inspection.status <> 'completed' then
    raise exception 'inspection_open' using errcode = 'P0001';
  end if;
  if v_reason = '' or char_length(v_reason) > 1000 then
    raise exception 'invalid_answer' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.inspections
    where site_id = v_inspection.site_id and status = 'in_progress'
  ) then
    raise exception 'another_inspection_open' using errcode = 'P0001';
  end if;

  insert into public.inspection_reopenings
    (organization_id, inspection_id, reopened_by, reason, previous_completed_at, previous_completed_by)
  values
    (v_inspection.organization_id, p_inspection, (select auth.uid()), v_reason,
     v_inspection.completed_at, v_inspection.completed_by);

  -- Devices whose date this inspection set (and nothing moved since) go back
  -- to the date they had before it.
  update public.devices d
  set last_inspection_on = applied.before
  from (
    select i.device_id, i.device_last_before as before,
           greatest(i.device_last_before,
                    (coalesce(i.original_checked_at, i.checked_at) at time zone o.timezone)::date) as after
    from public.inspection_items i
    join public.organizations o on o.id = i.organization_id
    where i.inspection_id = p_inspection and i.outcome = 'passed' and i.device_last_known
  ) as applied
  where d.id = applied.device_id and d.last_inspection_on is not distinct from applied.after;

  update public.inspections
  set status = 'in_progress',
      completed_at = null,
      completed_by = null,
      reopened_at = now()
  where id = p_inspection;
end;
$$;

-- ---------------------------------------------------------------------------
-- Completing
-- ---------------------------------------------------------------------------

create or replace function public.complete_inspection(
  p_inspection uuid,
  p_notes text default null,
  p_signature_path text default null,
  p_signer_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inspection public.inspections%rowtype;
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  v_signer_name text := nullif(btrim(coalesce(p_signer_name, '')), '');
  v_signs boolean;
  v_reopening public.inspection_reopenings%rowtype;
  v_found record;
  v_existing uuid;
  v_existing_inspection uuid;
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
  if char_length(v_signer_name) > 200 then
    raise exception 'invalid_answer' using errcode = 'P0001';
  end if;
  if p_signature_path is not null
     and p_signature_path not like v_inspection.organization_id::text || '/signatures/%' then
    raise exception 'invalid_answer' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.inspection_items where inspection_id = p_inspection and outcome is null
  ) then
    raise exception 'checks_unfinished' using errcode = 'P0001';
  end if;
  v_signs := p_signature_path is not null or v_signer_name is not null;
  if v_inspection.reopened_at is not null then
    select * into v_reopening from public.inspection_reopenings
    where inspection_id = p_inspection
    order by reopened_at desc
    limit 1;
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

  -- What this completion builds on: each check's first result (a correction
  -- keeps the original date and technician) and each device's date before.
  update public.inspection_items i
  set original_checked_at = coalesce(
        i.original_checked_at,
        case when i.outcome in ('passed', 'failed') then i.checked_at end),
      original_checked_by = case
        when i.original_checked_at is null and i.outcome in ('passed', 'failed') then i.checked_by
        else i.original_checked_by end,
      device_last_before = d.last_inspection_on,
      device_last_known = true
  from public.devices d
  where i.inspection_id = p_inspection and d.id = i.device_id;

  update public.devices d
  set last_inspection_on = greatest(coalesce(d.last_inspection_on, checked.day), checked.day)
  from (
    select i.device_id,
           (coalesce(i.original_checked_at, i.checked_at) at time zone o.timezone)::date as day
    from public.inspection_items i
    join public.organizations o on o.id = i.organization_id
    where i.inspection_id = p_inspection and i.outcome = 'passed'
  ) as checked
  where d.id = checked.device_id;

  -- Failed answers of failed checks: added to the open defect of the same
  -- question on the device (whether or not the answer asked for a defect),
  -- otherwise a new defect when the question always records one or a severity
  -- was chosen. A device left out (inaccessible, missing) records nothing.
  -- After a correction, only checks finished again since the reopening count,
  -- and what this inspection already recorded isn't recorded twice.
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
      and (v_inspection.reopened_at is null or i.checked_at >= v_inspection.reopened_at)
    order by i.device_id, t.sort_order
  loop
    select d.id, d.inspection_id into v_existing, v_existing_inspection
    from public.defects d
    join public.checklist_template_items q on q.id = d.template_item_id
    where d.device_id = v_found.device_id
      and d.status <> 'resolved'
      and q.label = v_found.label
    order by (d.inspection_id is not distinct from p_inspection) desc
    limit 1;
    if v_existing is not null then
      if v_existing_inspection is distinct from p_inspection
         and not exists (
           select 1 from public.defect_events e
           where e.defect_id = v_existing and e.inspection_id = p_inspection and e.kind = 'observed'
         ) then
        insert into public.defect_events
          (organization_id, defect_id, kind, actor, note, inspection_id)
        values
          (v_inspection.organization_id, v_existing, 'observed', v_found.checked_by, v_found.note,
           p_inspection);
      end if;
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

  -- A correction keeps the original completion; the reopening records who
  -- completed the correction and when. The customer's signature (drawing and
  -- name together) is replaced only when a new one is given.
  update public.inspections
  set status = 'completed',
      completed_at = case when v_reopening.id is null then now()
                          else coalesce(v_reopening.previous_completed_at, now()) end,
      completed_by = case when v_reopening.id is null then (select auth.uid())
                          else v_reopening.previous_completed_by end,
      notes = v_notes,
      customer_signature_path = case when v_signs then p_signature_path else customer_signature_path end,
      customer_signer_name = case when v_signs then v_signer_name else customer_signer_name end,
      customer_signed_at = case when v_signs then now() else customer_signed_at end
  where id = p_inspection;

  if v_reopening.id is not null then
    update public.inspection_reopenings
    set completed_at = now(), completed_by = (select auth.uid())
    where id = v_reopening.id;
  end if;

  -- The protocol's number is taken in the same transaction: no gaps, no
  -- duplicates. A correction reissues it instead: same number, new version.
  if v_inspection.reopened_at is not null then
    v_protocol := public.reissue_protocol(p_inspection);
  else
    v_protocol := public.assign_protocol(p_inspection);
  end if;

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

-- ---------------------------------------------------------------------------
-- Starting: a building with a correction open gets no new inspection mixed
-- into it (the correction is opened from the inspection itself).
-- ---------------------------------------------------------------------------

create or replace function public.start_inspection(p_site uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_id uuid;
  v_reopened timestamptz;
begin
  select organization_id into v_org from public.sites where id = p_site and deleted_at is null;
  if v_org is null or not public.is_member(v_org) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  select id, reopened_at into v_id, v_reopened
  from public.inspections where site_id = p_site and status = 'in_progress';
  if v_id is null then
    insert into public.inspections (organization_id, site_id, started_by)
    values (v_org, p_site, (select auth.uid()))
    on conflict (site_id) where status = 'in_progress' do nothing
    returning id into v_id;
    -- Somebody started it at the same moment: join theirs.
    if v_id is null then
      select id, reopened_at into v_id, v_reopened
      from public.inspections where site_id = p_site and status = 'in_progress';
    end if;
  end if;
  if v_reopened is not null then
    raise exception 'correction_in_progress' using errcode = 'P0001';
  end if;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Cancelling deletes the inspection: never a correction (it would delete the
-- completed original and its protocols).
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
  if v_inspection.reopened_at is not null then
    raise exception 'correction_not_cancellable' using errcode = 'P0001';
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
-- Sending a check from the phone: after a reopening, a check can't claim to
-- have been finished before it (the clock of a phone may run behind), so the
-- completion recognizes it as part of the correction.
-- ---------------------------------------------------------------------------

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

  select greatest(started_at, coalesce(reopened_at, started_at)) into v_started
  from public.inspections where id = v_item.inspection_id;
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
