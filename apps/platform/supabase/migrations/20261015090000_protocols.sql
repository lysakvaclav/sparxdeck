-- Part 9: inspection protocols.
--
-- Completing an inspection numbers its protocol ("2026-0001": a sequence per
-- organization and year, counted in organization_counters under a row lock, so
-- concurrent completions never share or skip a number). The PDF is rendered on
-- the server and stored under "<organization_id>/protocols/" by the service
-- role only: members read it, nobody in the app can replace it.

create table public.protocols (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  inspection_id uuid not null unique,
  year integer not null check (year between 2000 and 2999),
  number integer not null check (number > 0),
  -- The language it is written in (the organization's default when numbered).
  locale text not null check (locale in ('cs', 'en')),
  pdf_path text unique,
  pdf_size integer check (pdf_size > 0),
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, year, number),
  unique (id, organization_id),
  foreign key (inspection_id, organization_id)
    references public.inspections (id, organization_id) on delete cascade,
  check ((pdf_path is null) = (generated_at is null))
);

create table public.protocol_emails (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  protocol_id uuid not null,
  recipient text not null check (char_length(recipient) between 3 and 320),
  sent_by uuid references auth.users (id) on delete set null,
  sent_at timestamptz not null default now(),
  foreign key (protocol_id, organization_id)
    references public.protocols (id, organization_id) on delete cascade
);

create index protocol_emails_protocol_idx on public.protocol_emails (protocol_id, sent_at);

alter table public.protocols enable row level security;
alter table public.protocol_emails enable row level security;

create policy protocols_select on public.protocols
  for select to authenticated using (public.is_member(organization_id));
create policy protocol_emails_select on public.protocol_emails
  for select to authenticated using (public.is_member(organization_id));

-- ---------------------------------------------------------------------------
-- Numbering
-- ---------------------------------------------------------------------------

-- The inspection's protocol, numbered in the year it was completed (in the
-- organization's time zone). Callers hold the inspection's row lock.
create or replace function public.assign_protocol(p_inspection uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inspection public.inspections%rowtype;
  v_organization public.organizations%rowtype;
  v_year integer;
  v_number integer;
  v_id uuid;
begin
  select id into v_id from public.protocols where inspection_id = p_inspection;
  if v_id is not null then
    return v_id;
  end if;
  select * into v_inspection from public.inspections where id = p_inspection;
  select * into v_organization from public.organizations where id = v_inspection.organization_id;
  v_year := extract(year from (v_inspection.completed_at at time zone v_organization.timezone));

  insert into public.organization_counters (organization_id, name, value)
  values (v_organization.id, 'protocol_' || v_year, 1)
  on conflict (organization_id, name)
    do update set value = public.organization_counters.value + 1
  returning value into v_number;

  insert into public.protocols (organization_id, inspection_id, year, number, locale)
  values (v_organization.id, p_inspection, v_year, v_number, v_organization.default_locale)
  returning id into v_id;
  return v_id;
end;
$$;

-- For inspections completed before protocols existed: numbers one on request.
create or replace function public.ensure_protocol(p_inspection uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inspection public.inspections%rowtype;
begin
  select * into v_inspection from public.inspections where id = p_inspection for update;
  if v_inspection.id is null or not public.is_member(v_inspection.organization_id) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_inspection.status <> 'completed' then
    raise exception 'inspection_open' using errcode = 'P0001';
  end if;
  return public.assign_protocol(p_inspection);
end;
$$;

-- A protocol sent by e-mail: the server sends it, then records who sent it where.
create or replace function public.record_protocol_email(p_protocol uuid, p_recipient text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_protocol public.protocols%rowtype;
  v_id uuid;
begin
  select * into v_protocol from public.protocols where id = p_protocol;
  if v_protocol.id is null or not public.is_member(v_protocol.organization_id) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_protocol.pdf_path is null then
    raise exception 'protocol_missing' using errcode = 'P0001';
  end if;
  insert into public.protocol_emails (organization_id, protocol_id, recipient, sent_by)
  values (v_protocol.organization_id, p_protocol, btrim(p_recipient), (select auth.uid()))
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Completing an inspection numbers its protocol
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

  -- Failed answers: added to the open defect of the same question on the device
  -- (whether or not the answer asked for a defect), otherwise a new defect when
  -- the question always records one or a severity was chosen.
  for v_found in
    select i.id as item_id, i.device_id, i.checked_by, t.id as question, t.label,
           a.note, coalesce(a.defect_severity, 'major'::public.defect_severity) as severity,
           (t.fail_creates_defect or a.defect_severity is not null) as records
    from public.inspection_items i
    join public.inspection_answers a on a.item_id = i.id
    join public.checklist_template_items t on t.id = a.template_item_id
    where i.inspection_id = p_inspection
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
    'defects', v_created,
    'protocol', v_protocol
  ) into v_result
  from public.inspection_items where inspection_id = p_inspection;
  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Storage: protocol PDFs are written by the server only
-- ---------------------------------------------------------------------------

drop policy org_assets_insert on storage.objects;
drop policy org_assets_update on storage.objects;
drop policy org_assets_delete on storage.objects;

create policy org_assets_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'org-assets'
    and (storage.foldername(name))[2] is distinct from 'protocols'
    and public.has_role(public.storage_organization_id(name), array['owner', 'admin']::public.member_role[])
  );

create policy org_assets_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'org-assets'
    and (storage.foldername(name))[2] is distinct from 'protocols'
    and public.has_role(public.storage_organization_id(name), array['owner', 'admin']::public.member_role[])
  )
  with check (
    bucket_id = 'org-assets'
    and (storage.foldername(name))[2] is distinct from 'protocols'
    and public.has_role(public.storage_organization_id(name), array['owner', 'admin']::public.member_role[])
  );

create policy org_assets_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'org-assets'
    and (storage.foldername(name))[2] is distinct from 'protocols'
    and public.has_role(public.storage_organization_id(name), array['owner', 'admin']::public.member_role[])
  );

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function public.assign_protocol(uuid) from public, anon, authenticated;
revoke all on function public.ensure_protocol(uuid) from public, anon;
revoke all on function public.record_protocol_email(uuid, text) from public, anon;
grant execute on function public.ensure_protocol(uuid) to authenticated;
grant execute on function public.record_protocol_email(uuid, text) to authenticated;
