-- Part 8: defects, tracked until resolved.
--
-- * A defect belongs to a device. It is found in an inspection (automatically
--   when it is completed) or reported by hand, has a severity and a status, and
--   is closed with a note on how it was resolved.
-- * Every change is a row in defect_events: the history shows who did what.
-- * Automatic defects come from failed yes/no answers: questions marked
--   "failure = defect" always, others when the technician chose a severity. An
--   unresolved defect of the same device and question isn't duplicated; the
--   inspection is added to its history instead.
-- * Members (technicians included) report, comment and resolve; everything is
--   written through the functions below.

create type public.defect_severity as enum ('minor', 'major', 'critical');
create type public.defect_status as enum ('open', 'in_progress', 'resolved');

-- The technician's severity for a failed answer (a defect is created on completion).
alter table public.inspection_answers
  add column defect_severity public.defect_severity,
  add constraint inspection_answers_severity_on_fail
    check (defect_severity is null or value_pass is false);

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.defects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  number integer not null check (number > 0),
  device_id uuid not null,
  -- Where it was found (none for defects reported by hand).
  inspection_id uuid references public.inspections (id) on delete set null,
  inspection_item_id uuid references public.inspection_items (id) on delete set null,
  template_item_id uuid references public.checklist_template_items (id),
  description text not null check (char_length(btrim(description)) between 1 and 2000),
  severity public.defect_severity not null,
  status public.defect_status not null default 'open',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null,
  resolution_note text check (char_length(resolution_note) <= 2000),
  unique (organization_id, number),
  unique (id, organization_id),
  foreign key (device_id, organization_id) references public.devices (id, organization_id),
  check ((status = 'resolved') = (resolved_at is not null))
);

create index defects_org_status_idx on public.defects (organization_id, status, created_at desc);
create index defects_device_idx on public.defects (device_id);

create trigger defects_set_updated_at
  before update on public.defects
  for each row execute function public.set_updated_at();

-- Numbers per organization, like label numbers (never reused).
create or replace function public.assign_defect_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.organization_counters (organization_id, name, value)
  values (new.organization_id, 'defect', 1)
  on conflict (organization_id, name)
    do update set value = public.organization_counters.value + 1
  returning value into new.number;
  return new;
end;
$$;

create trigger defects_assign_number
  before insert on public.defects
  for each row execute function public.assign_defect_number();

create table public.defect_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  defect_id uuid not null,
  kind text not null
    check (kind in ('created', 'status', 'severity', 'description', 'comment', 'observed')),
  actor uuid references auth.users (id) on delete set null,
  from_value text,
  to_value text,
  note text check (char_length(note) <= 2000),
  inspection_id uuid references public.inspections (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (defect_id, organization_id)
    references public.defects (id, organization_id) on delete cascade
);

create index defect_events_defect_idx on public.defect_events (defect_id, created_at);

create table public.defect_photos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  defect_id uuid not null,
  storage_path text not null unique,
  content_type text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes integer not null check (size_bytes between 1 and 2097152),
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (defect_id, organization_id)
    references public.defects (id, organization_id) on delete cascade
);

create index defect_photos_defect_idx on public.defect_photos (defect_id);

alter table public.defects enable row level security;
alter table public.defect_events enable row level security;
alter table public.defect_photos enable row level security;

create policy defects_select on public.defects
  for select to authenticated using (public.is_member(organization_id));
create policy defect_events_select on public.defect_events
  for select to authenticated using (public.is_member(organization_id));
create policy defect_photos_select on public.defect_photos
  for select to authenticated using (public.is_member(organization_id));

revoke insert, update, delete on public.defects, public.defect_events, public.defect_photos
  from authenticated;
revoke all on public.defects, public.defect_events, public.defect_photos from anon;

-- ---------------------------------------------------------------------------
-- Reporting and changing defects
-- ---------------------------------------------------------------------------

-- The defect for a change by a member of its organization.
create or replace function public.member_defect(p_defect uuid)
returns public.defects
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_defect public.defects%rowtype;
begin
  select * into v_defect from public.defects where id = p_defect for update;
  if v_defect.id is null or not public.is_member(v_defect.organization_id) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  return v_defect;
end;
$$;

-- Reports a defect by hand.
create or replace function public.create_defect(
  p_device uuid,
  p_description text,
  p_severity public.defect_severity
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_description text := btrim(coalesce(p_description, ''));
  v_id uuid;
begin
  select organization_id into v_org from public.devices where id = p_device and deleted_at is null;
  if v_org is null or not public.is_member(v_org) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if char_length(v_description) not between 1 and 2000 or p_severity is null then
    raise exception 'invalid_defect' using errcode = 'P0001';
  end if;
  insert into public.defects (organization_id, device_id, description, severity, created_by)
  values (v_org, p_device, v_description, p_severity, (select auth.uid()))
  returning id into v_id;
  insert into public.defect_events (organization_id, defect_id, kind, actor, to_value)
  values (v_org, v_id, 'created', (select auth.uid()), p_severity::text);
  return v_id;
end;
$$;

-- Moves a defect to another status. Resolving needs a note on what was done;
-- reopening a resolved defect clears its resolution.
create or replace function public.change_defect_status(
  p_defect uuid,
  p_status public.defect_status,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_defect public.defects%rowtype;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  v_defect := public.member_defect(p_defect);
  if v_defect.status = p_status then
    return;
  end if;
  if char_length(v_note) > 2000 then
    raise exception 'invalid_defect' using errcode = 'P0001';
  end if;
  if p_status = 'resolved' and v_note is null then
    raise exception 'resolution_required' using errcode = 'P0001';
  end if;
  update public.defects
  set status = p_status,
      resolved_at = case when p_status = 'resolved' then now() end,
      resolved_by = case when p_status = 'resolved' then (select auth.uid()) end,
      resolution_note = case when p_status = 'resolved' then v_note end
  where id = p_defect;
  insert into public.defect_events
    (organization_id, defect_id, kind, actor, from_value, to_value, note)
  values
    (v_defect.organization_id, p_defect, 'status', (select auth.uid()),
     v_defect.status::text, p_status::text, v_note);
end;
$$;

create or replace function public.change_defect_severity(
  p_defect uuid,
  p_severity public.defect_severity
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_defect public.defects%rowtype;
begin
  v_defect := public.member_defect(p_defect);
  if p_severity is null then
    raise exception 'invalid_defect' using errcode = 'P0001';
  end if;
  if v_defect.severity = p_severity then
    return;
  end if;
  update public.defects set severity = p_severity where id = p_defect;
  insert into public.defect_events
    (organization_id, defect_id, kind, actor, from_value, to_value)
  values
    (v_defect.organization_id, p_defect, 'severity', (select auth.uid()),
     v_defect.severity::text, p_severity::text);
end;
$$;

create or replace function public.edit_defect_description(p_defect uuid, p_description text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_defect public.defects%rowtype;
  v_description text := btrim(coalesce(p_description, ''));
begin
  v_defect := public.member_defect(p_defect);
  if char_length(v_description) not between 1 and 2000 then
    raise exception 'invalid_defect' using errcode = 'P0001';
  end if;
  if v_defect.description = v_description then
    return;
  end if;
  update public.defects set description = v_description where id = p_defect;
  insert into public.defect_events
    (organization_id, defect_id, kind, actor, from_value, to_value)
  values
    (v_defect.organization_id, p_defect, 'description', (select auth.uid()),
     v_defect.description, v_description);
end;
$$;

create or replace function public.comment_defect(p_defect uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_defect public.defects%rowtype;
  v_note text := btrim(coalesce(p_note, ''));
begin
  v_defect := public.member_defect(p_defect);
  if char_length(v_note) not between 1 and 2000 then
    raise exception 'invalid_defect' using errcode = 'P0001';
  end if;
  insert into public.defect_events (organization_id, defect_id, kind, actor, note)
  values (v_defect.organization_id, p_defect, 'comment', (select auth.uid()), v_note);
end;
$$;

-- Photos of a defect live in org-assets under <org>/defects/<defect>/.
create or replace function public.add_defect_photo(
  p_defect uuid,
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
  v_defect public.defects%rowtype;
  v_id uuid;
begin
  v_defect := public.member_defect(p_defect);
  if p_path not like v_defect.organization_id::text || '/defects/' || p_defect::text || '/%'
     or not exists (
       select 1 from storage.objects where bucket_id = 'org-assets' and name = p_path
     ) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if (select count(*) from public.defect_photos where defect_id = p_defect) >= 20 then
    raise exception 'too_many_photos' using errcode = 'P0001';
  end if;
  insert into public.defect_photos
    (organization_id, defect_id, storage_path, content_type, size_bytes, uploaded_by)
  values
    (v_defect.organization_id, p_defect, p_path, p_content_type, p_size, (select auth.uid()))
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Answers carry the technician's severity; completing creates the defects
-- ---------------------------------------------------------------------------

drop function public.save_answer(uuid, uuid, boolean, numeric, text, text);

create or replace function public.save_answer(
  p_item uuid,
  p_template_item uuid,
  p_value_pass boolean default null,
  p_value_number numeric default null,
  p_value_text text default null,
  p_note text default null,
  p_defect_severity public.defect_severity default null
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.inspection_items%rowtype;
  v_type public.checklist_item_type;
  v_text text := nullif(btrim(coalesce(p_value_text, '')), '');
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_now timestamptz := now();
begin
  v_item := public.held_check(p_item);
  select item_type into v_type from public.checklist_template_items
  where id = p_template_item and template_id = v_item.template_id;
  if v_type is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if (v_type = 'pass_fail' and (p_value_number is not null or v_text is not null))
     or (v_type = 'number' and (p_value_pass is not null or v_text is not null
       or p_value_number = 'NaN'::numeric or abs(p_value_number) >= 1000000000))
     or (v_type = 'text' and (p_value_pass is not null or p_value_number is not null))
     or (p_defect_severity is not null and p_value_pass is distinct from false)
     or char_length(v_text) > 2000
     or char_length(v_note) > 2000 then
    raise exception 'invalid_answer' using errcode = 'P0001';
  end if;

  insert into public.inspection_answers
    (organization_id, item_id, template_item_id, value_pass, value_number, value_text, note,
     defect_severity, answered_by, updated_at)
  values
    (v_item.organization_id, p_item, p_template_item, p_value_pass, p_value_number, v_text,
     v_note, p_defect_severity, (select auth.uid()), v_now)
  on conflict (item_id, template_item_id) do update
    set value_pass = excluded.value_pass,
        value_number = excluded.value_number,
        value_text = excluded.value_text,
        note = excluded.note,
        defect_severity = excluded.defect_severity,
        answered_by = excluded.answered_by,
        updated_at = excluded.updated_at;

  update public.inspection_items
  set editing_at = v_now, outcome = null, checked_at = null, checked_by = null
  where id = p_item;
  return v_now;
end;
$$;

-- Completing an inspection (as in part 7) now also records its defects.
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

  -- Defects from failed answers, unless the same one is still open on the device.
  for v_found in
    select i.id as item_id, i.device_id, i.checked_by, t.id as question, t.label,
           a.note, coalesce(a.defect_severity, 'major'::public.defect_severity) as severity
    from public.inspection_items i
    join public.inspection_answers a on a.item_id = i.id
    join public.checklist_template_items t on t.id = a.template_item_id
    where i.inspection_id = p_inspection
      and t.item_type = 'pass_fail'
      and a.value_pass = false
      and (t.fail_creates_defect or a.defect_severity is not null)
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
    else
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

  select jsonb_build_object(
    'passed', count(*) filter (where outcome = 'passed'),
    'failed', count(*) filter (where outcome = 'failed'),
    'notChecked', count(*) filter (where outcome = 'not_checked'),
    'defects', v_created
  ) into v_result
  from public.inspection_items where inspection_id = p_inspection;
  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Storage: members add photos to a defect; uploaders may remove their own.
-- ---------------------------------------------------------------------------

create policy org_assets_defect_photo_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'org-assets'
    and (storage.foldername(name))[2] = 'defects'
    and exists (
      select 1 from public.defects d
      where d.organization_id = public.storage_organization_id(name)
        and d.id::text = (storage.foldername(name))[3]
    )
  );

create policy org_assets_defect_photo_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'org-assets'
    and (storage.foldername(name))[2] = 'defects'
    and owner_id = (select auth.uid())::text
    and public.is_member(public.storage_organization_id(name))
  );

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function public.assign_defect_number() from public, anon, authenticated;
revoke all on function public.member_defect(uuid) from public, anon, authenticated;
revoke all on function public.create_defect(uuid, text, public.defect_severity) from public, anon;
revoke all on function public.change_defect_status(uuid, public.defect_status, text) from public, anon;
revoke all on function public.change_defect_severity(uuid, public.defect_severity) from public, anon;
revoke all on function public.edit_defect_description(uuid, text) from public, anon;
revoke all on function public.comment_defect(uuid, text) from public, anon;
revoke all on function public.add_defect_photo(uuid, text, text, integer) from public, anon;
revoke all on function public.save_answer(uuid, uuid, boolean, numeric, text, text, public.defect_severity)
  from public, anon;

grant execute on function public.create_defect(uuid, text, public.defect_severity) to authenticated;
grant execute on function public.change_defect_status(uuid, public.defect_status, text) to authenticated;
grant execute on function public.change_defect_severity(uuid, public.defect_severity) to authenticated;
grant execute on function public.edit_defect_description(uuid, text) to authenticated;
grant execute on function public.comment_defect(uuid, text) to authenticated;
grant execute on function public.add_defect_photo(uuid, text, text, integer) to authenticated;
grant execute on function public.save_answer(uuid, uuid, boolean, numeric, text, text, public.defect_severity)
  to authenticated;
