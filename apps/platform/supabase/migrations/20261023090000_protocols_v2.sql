-- Part 18: protocol versions, customer signature, configurable numbering, and
-- correcting a completed inspection.
--
-- Correcting a mistake reopens the inspection (back to "in_progress", same
-- rules as the first time) instead of editing the finished record in place.
-- Completing it again reissues the protocol: same year and number, a new
-- version; the previous PDF is kept, never replaced or deleted.

-- ---------------------------------------------------------------------------
-- Protocol numbering format, chosen per organization; baked into each
-- protocol at the moment it is numbered, so changing the setting later never
-- changes how an already-issued protocol reads.
-- ---------------------------------------------------------------------------

create type public.protocol_number_format as enum ('year_number', 'number_year', 'year_slash_number');

alter table public.organizations
  add column protocol_number_format public.protocol_number_format not null default 'year_number';

-- ---------------------------------------------------------------------------
-- Protocols become versioned: one active row per inspection, superseded rows
-- kept for history. The same (year, number) carries across versions.
-- ---------------------------------------------------------------------------

alter table public.protocols drop constraint protocols_inspection_id_key;
alter table public.protocols drop constraint protocols_inspection_id_organization_id_key;
alter table public.protocols drop constraint protocols_organization_id_year_number_key;

alter table public.protocols
  add column version integer not null default 1 check (version >= 1),
  add column active boolean not null default true,
  add column superseded_at timestamptz,
  add column number_format public.protocol_number_format not null default 'year_number',
  add constraint protocols_superseded_matches_active check (active or superseded_at is not null),
  add constraint protocols_organization_id_year_number_version_key unique (organization_id, year, number, version);

create unique index protocols_one_active_per_inspection on public.protocols (inspection_id) where active;

-- ---------------------------------------------------------------------------
-- Inspections: when they were last reopened for a correction (unset once
-- there has been none), and the customer's signature.
-- ---------------------------------------------------------------------------

alter table public.inspections
  add column reopened_at timestamptz,
  add column customer_signature_path text,
  add column customer_signer_name text check (char_length(customer_signer_name) <= 200),
  add column customer_signed_at timestamptz,
  add constraint inspections_signature_path_own_folder
    check (customer_signature_path is null or customer_signature_path like organization_id::text || '/signatures/%');

create table public.inspection_reopenings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  inspection_id uuid not null,
  reopened_by uuid references auth.users (id) on delete set null,
  reopened_at timestamptz not null default now(),
  reason text not null check (char_length(btrim(reason)) between 1 and 1000),
  foreign key (inspection_id, organization_id)
    references public.inspections (id, organization_id) on delete cascade
);

create index inspection_reopenings_inspection_idx
  on public.inspection_reopenings (inspection_id, reopened_at);

alter table public.inspection_reopenings enable row level security;

create policy inspection_reopenings_select on public.inspection_reopenings
  for select to authenticated using (public.is_member(organization_id));

revoke insert, update, delete on public.inspection_reopenings from authenticated;
revoke all on public.inspection_reopenings from anon;

-- ---------------------------------------------------------------------------
-- Reopening a completed inspection: owner or admin, and only when nothing
-- else is already in progress at the same building (the one-open-per-site
-- rule would otherwise reject the update with a confusing error).
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

  insert into public.inspection_reopenings (organization_id, inspection_id, reopened_by, reason)
  values (v_inspection.organization_id, p_inspection, (select auth.uid()), v_reason);

  update public.inspections
  set status = 'in_progress',
      completed_at = null,
      completed_by = null,
      reopened_at = now()
  where id = p_inspection;
end;
$$;

revoke all on function public.reopen_inspection(uuid, text) from public, anon;
grant execute on function public.reopen_inspection(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Numbering: assign_protocol stays idempotent (ensure_protocol relies on
-- that); reissue_protocol is the explicit "make a new version" step, used
-- only when completing an inspection that was reopened for a correction.
-- ---------------------------------------------------------------------------

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
  select id into v_id from public.protocols where inspection_id = p_inspection and active;
  if v_id is not null then
    return v_id;
  end if;
  select * into v_inspection from public.inspections where id = p_inspection;
  select * into v_organization from public.organizations where id = v_inspection.organization_id;
  v_year := extract(year from (v_inspection.completed_at at time zone v_organization.timezone));

  if public.is_sample_site(v_inspection.site_id) then
    v_number := public.sample_number_base()
      + public.next_counter(v_organization.id, 'sample_protocol_' || v_year);
  else
    v_number := public.next_counter(v_organization.id, 'protocol_' || v_year);
  end if;

  insert into public.protocols
    (organization_id, inspection_id, year, number, version, active, locale, number_format)
  values
    (v_organization.id, p_inspection, v_year, v_number, 1, true, v_organization.default_locale,
     v_organization.protocol_number_format)
  returning id into v_id;
  return v_id;
end;
$$;

-- Supersedes the active protocol and inserts the next version with the same
-- year and number. The superseded row, and its PDF, are left untouched.
create or replace function public.reissue_protocol(p_inspection uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_active public.protocols%rowtype;
  v_version integer;
  v_id uuid;
begin
  select * into v_active from public.protocols where inspection_id = p_inspection and active for update;
  if v_active.id is null then
    return public.assign_protocol(p_inspection);
  end if;

  update public.protocols set active = false, superseded_at = now() where id = v_active.id;
  select coalesce(max(version), 0) + 1 into v_version
    from public.protocols where inspection_id = p_inspection;

  insert into public.protocols
    (organization_id, inspection_id, year, number, version, active, locale, number_format)
  values
    (v_active.organization_id, p_inspection, v_active.year, v_active.number, v_version, true,
     v_active.locale, v_active.number_format)
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.reissue_protocol(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Completing: the customer's signature (optional, kept across a correction
-- unless a new one is given) and reissuing after a correction. A correction
-- re-checks only the items touched since the reopening, so devices nobody
-- revisited don't get a spurious "observed again" on their open defects.
-- ---------------------------------------------------------------------------

drop function if exists public.complete_inspection(uuid, text);

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
  -- After a correction, only items checked again since the reopening count.
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
      notes = v_notes,
      customer_signature_path = coalesce(p_signature_path, customer_signature_path),
      customer_signer_name = coalesce(v_signer_name, customer_signer_name),
      customer_signed_at = case when p_signature_path is not null then now() else customer_signed_at end
  where id = p_inspection;

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

revoke all on function public.complete_inspection(uuid, text, text, text) from public, anon;
grant execute on function public.complete_inspection(uuid, text, text, text) to authenticated;
