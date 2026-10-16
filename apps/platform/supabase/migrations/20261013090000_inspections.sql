-- Part 7: inspections in the field.
--
-- * An inspection covers one building. At most one is in progress per building;
--   several technicians can work on it together (each on a different device).
-- * inspection_items is one device's check: the checklist version it uses, the
--   answers, photos and the outcome. A technician "holds" a check while filling
--   it in; somebody else can take it over after 10 minutes without activity or
--   explicitly, and the first person's later saves are then refused.
-- * Everything is written through the functions below (several tables, checks).
-- * Completing the inspection records "not checked" for devices nobody looked at
--   and moves the last inspection date of the devices that passed (the devices
--   trigger computes the next due date). A failed check leaves the date alone.

create type public.inspection_status as enum ('in_progress', 'completed');
create type public.check_outcome as enum ('passed', 'failed', 'not_checked');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.inspections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  site_id uuid not null,
  status public.inspection_status not null default 'in_progress',
  started_by uuid references auth.users (id) on delete set null,
  started_at timestamptz not null default now(),
  completed_by uuid references auth.users (id) on delete set null,
  completed_at timestamptz,
  notes text check (char_length(notes) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (site_id, organization_id) references public.sites (id, organization_id),
  check ((status = 'completed') = (completed_at is not null))
);

create unique index inspections_one_open_per_site
  on public.inspections (site_id) where status = 'in_progress';
create index inspections_org_idx on public.inspections (organization_id, started_at desc);

create trigger inspections_set_updated_at
  before update on public.inspections
  for each row execute function public.set_updated_at();

create table public.inspection_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  inspection_id uuid not null,
  device_id uuid not null,
  -- The checklist version this check uses (none for devices never checked).
  template_id uuid,
  -- Null while the check is being filled in.
  outcome public.check_outcome,
  notes text check (char_length(notes) <= 2000),
  checked_by uuid references auth.users (id) on delete set null,
  checked_at timestamptz,
  -- Who is filling the check in right now, and when they last saved.
  editing_by uuid references auth.users (id) on delete set null,
  editing_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (inspection_id, device_id),
  unique (id, organization_id),
  foreign key (inspection_id, organization_id)
    references public.inspections (id, organization_id) on delete cascade,
  foreign key (device_id, organization_id) references public.devices (id, organization_id),
  foreign key (template_id, organization_id)
    references public.checklist_templates (id, organization_id)
);

create index inspection_items_device_idx on public.inspection_items (device_id);

create trigger inspection_items_set_updated_at
  before update on public.inspection_items
  for each row execute function public.set_updated_at();

create table public.inspection_answers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  item_id uuid not null,
  template_item_id uuid not null references public.checklist_template_items (id),
  value_pass boolean,
  value_number numeric,
  value_text text check (char_length(value_text) <= 2000),
  note text check (char_length(note) <= 2000),
  answered_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (item_id, template_item_id),
  foreign key (item_id, organization_id)
    references public.inspection_items (id, organization_id) on delete cascade
);

create table public.inspection_photos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  item_id uuid not null,
  -- The checklist question the photo belongs to, or null for the device as a whole.
  template_item_id uuid references public.checklist_template_items (id),
  storage_path text not null unique,
  content_type text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes integer not null check (size_bytes between 1 and 2097152),
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (item_id, organization_id)
    references public.inspection_items (id, organization_id) on delete cascade
);

create index inspection_photos_item_idx on public.inspection_photos (item_id);

-- ---------------------------------------------------------------------------
-- Row Level Security: members read; writes only through the functions below.
-- ---------------------------------------------------------------------------

alter table public.inspections enable row level security;
alter table public.inspection_items enable row level security;
alter table public.inspection_answers enable row level security;
alter table public.inspection_photos enable row level security;

create policy inspections_select on public.inspections
  for select to authenticated using (public.is_member(organization_id));
create policy inspection_items_select on public.inspection_items
  for select to authenticated using (public.is_member(organization_id));
create policy inspection_answers_select on public.inspection_answers
  for select to authenticated using (public.is_member(organization_id));
create policy inspection_photos_select on public.inspection_photos
  for select to authenticated using (public.is_member(organization_id));

revoke insert, update, delete on public.inspections, public.inspection_items,
  public.inspection_answers, public.inspection_photos from authenticated;
revoke all on public.inspections, public.inspection_items, public.inspection_answers,
  public.inspection_photos from anon;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- A check held by someone who hasn't saved for this long is free to take.
create or replace function public.check_hold_expired(p_editing_at timestamptz)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_editing_at is null or p_editing_at < now() - interval '10 minutes';
$$;

-- The check (and its inspection) for a write by the current user, who must hold it.
create or replace function public.held_check(p_item uuid)
returns public.inspection_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.inspection_items%rowtype;
  v_status public.inspection_status;
begin
  select * into v_item from public.inspection_items where id = p_item;
  if v_item.id is null or not public.is_member(v_item.organization_id) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  select status into v_status from public.inspections where id = v_item.inspection_id;
  if v_status <> 'in_progress' then
    raise exception 'inspection_closed' using errcode = 'P0001';
  end if;
  if v_item.editing_by is distinct from (select auth.uid()) then
    raise exception 'check_taken_over' using errcode = 'P0001';
  end if;
  return v_item;
end;
$$;

-- Every required question of the check has an answer.
create or replace function public.check_answers_complete(p_item uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
    from public.inspection_items i
    join public.checklist_template_items t on t.template_id = i.template_id
    left join public.inspection_answers a
      on a.item_id = i.id and a.template_item_id = t.id
    where i.id = p_item
      and t.required
      and case t.item_type
        when 'pass_fail' then a.value_pass is null
        when 'number' then a.value_number is null
        else coalesce(a.value_text, '') = ''
      end
  );
$$;

-- Failed as soon as one yes/no question is answered "no".
create or replace function public.check_outcome_of(p_item uuid)
returns public.check_outcome
language sql
stable
security definer
set search_path = ''
as $$
  select case when exists (
    select 1 from public.inspection_answers a
    join public.checklist_template_items t on t.id = a.template_item_id
    where a.item_id = p_item and t.item_type = 'pass_fail' and a.value_pass = false
  ) then 'failed'::public.check_outcome else 'passed'::public.check_outcome end;
$$;

-- ---------------------------------------------------------------------------
-- Starting an inspection and opening a device's check
-- ---------------------------------------------------------------------------

-- Starts the building's inspection, or returns the one already in progress.
create or replace function public.start_inspection(p_site uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_id uuid;
begin
  select organization_id into v_org from public.sites where id = p_site and deleted_at is null;
  if v_org is null or not public.is_member(v_org) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  select id into v_id from public.inspections where site_id = p_site and status = 'in_progress';
  if v_id is not null then
    return v_id;
  end if;
  insert into public.inspections (organization_id, site_id, started_by)
  values (v_org, p_site, (select auth.uid()))
  on conflict (site_id) where status = 'in_progress' do nothing
  returning id into v_id;
  -- Somebody started it at the same moment: join theirs.
  if v_id is null then
    select id into v_id from public.inspections where site_id = p_site and status = 'in_progress';
  end if;
  return v_id;
end;
$$;

-- Opens a device's check for the current user. Returns {"item": id} when the
-- user now holds it, or {"item": id, "heldBy": name} when a colleague is filling
-- it in; p_take_over takes it from them.
create or replace function public.open_device_check(
  p_inspection uuid,
  p_device uuid,
  p_take_over boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inspection public.inspections%rowtype;
  v_device public.devices%rowtype;
  v_item public.inspection_items%rowtype;
  v_template uuid;
  v_name text;
begin
  select * into v_inspection from public.inspections where id = p_inspection;
  if v_inspection.id is null or not public.is_member(v_inspection.organization_id) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_inspection.status <> 'in_progress' then
    raise exception 'inspection_closed' using errcode = 'P0001';
  end if;

  select * into v_item from public.inspection_items
  where inspection_id = p_inspection and device_id = p_device;

  if v_item.id is null then
    select * into v_device from public.devices
    where id = p_device and site_id = v_inspection.site_id and deleted_at is null;
    if v_device.id is null then
      raise exception 'not_found' using errcode = 'P0001';
    end if;
    if v_device.status <> 'active' then
      raise exception 'device_inactive' using errcode = 'P0001';
    end if;
    select id into v_template from public.checklist_templates
    where device_type_id = v_device.device_type_id and active;
    if v_template is null then
      raise exception 'no_template' using errcode = 'P0001';
    end if;
    insert into public.inspection_items (organization_id, inspection_id, device_id, template_id)
    values (v_inspection.organization_id, p_inspection, p_device, v_template)
    on conflict (inspection_id, device_id) do nothing;
    select * into v_item from public.inspection_items
    where inspection_id = p_inspection and device_id = p_device;
  end if;

  if v_item.editing_by is not null
     and v_item.editing_by <> (select auth.uid())
     and not public.check_hold_expired(v_item.editing_at)
     and not p_take_over then
    select display_name into v_name from public.memberships
    where user_id = v_item.editing_by and organization_id = v_item.organization_id;
    return jsonb_build_object('item', v_item.id, 'heldBy', coalesce(v_name, '?'));
  end if;

  update public.inspection_items
  set editing_by = (select auth.uid()), editing_at = now()
  where id = v_item.id;
  return jsonb_build_object('item', v_item.id);
end;
$$;

-- Lets go of a check (leaving the page); others can open it straight away.
create or replace function public.release_device_check(p_item uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.inspection_items
  set editing_by = null, editing_at = null
  where id = p_item and editing_by = (select auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Filling in a check
-- ---------------------------------------------------------------------------

-- Saves one answer (all values null clears it). Changing an answer of a finished
-- check reopens it: it has to be finished again.
create or replace function public.save_answer(
  p_item uuid,
  p_template_item uuid,
  p_value_pass boolean default null,
  p_value_number numeric default null,
  p_value_text text default null,
  p_note text default null
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
     or char_length(v_text) > 2000
     or char_length(v_note) > 2000 then
    raise exception 'invalid_answer' using errcode = 'P0001';
  end if;

  insert into public.inspection_answers
    (organization_id, item_id, template_item_id, value_pass, value_number, value_text, note,
     answered_by, updated_at)
  values
    (v_item.organization_id, p_item, p_template_item, p_value_pass, p_value_number, v_text,
     v_note, (select auth.uid()), v_now)
  on conflict (item_id, template_item_id) do update
    set value_pass = excluded.value_pass,
        value_number = excluded.value_number,
        value_text = excluded.value_text,
        note = excluded.note,
        answered_by = excluded.answered_by,
        updated_at = excluded.updated_at;

  update public.inspection_items
  set editing_at = v_now, outcome = null, checked_at = null, checked_by = null
  where id = p_item;
  return v_now;
end;
$$;

-- The note on the device as a whole.
create or replace function public.save_check_note(p_item uuid, p_notes text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.inspection_items%rowtype;
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
begin
  v_item := public.held_check(p_item);
  if char_length(v_notes) > 2000 then
    raise exception 'invalid_answer' using errcode = 'P0001';
  end if;
  update public.inspection_items set notes = v_notes, editing_at = now() where id = p_item;
end;
$$;

-- Finishes the check once every required question is answered; returns the outcome.
create or replace function public.finish_device_check(p_item uuid)
returns public.check_outcome
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.inspection_items%rowtype;
  v_outcome public.check_outcome;
begin
  v_item := public.held_check(p_item);
  if not public.check_answers_complete(p_item) then
    raise exception 'check_incomplete' using errcode = 'P0001';
  end if;
  v_outcome := public.check_outcome_of(p_item);
  update public.inspection_items
  set outcome = v_outcome,
      checked_at = now(),
      checked_by = (select auth.uid()),
      editing_by = null,
      editing_at = null
  where id = p_item;
  return v_outcome;
end;
$$;

-- ---------------------------------------------------------------------------
-- Photos (files in org-assets under <org>/inspections/<inspection>/<check>/)
-- ---------------------------------------------------------------------------

create or replace function public.add_inspection_photo(
  p_item uuid,
  p_template_item uuid,
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
  v_item public.inspection_items%rowtype;
  v_id uuid;
begin
  v_item := public.held_check(p_item);
  if p_path not like v_item.organization_id::text || '/inspections/'
       || v_item.inspection_id::text || '/' || v_item.id::text || '/%'
     or not exists (
       select 1 from storage.objects where bucket_id = 'org-assets' and name = p_path
     ) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if p_template_item is not null and not exists (
    select 1 from public.checklist_template_items
    where id = p_template_item and template_id = v_item.template_id
  ) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if (select count(*) from public.inspection_photos where item_id = p_item) >= 20 then
    raise exception 'too_many_photos' using errcode = 'P0001';
  end if;
  insert into public.inspection_photos
    (organization_id, item_id, template_item_id, storage_path, content_type, size_bytes,
     uploaded_by)
  values
    (v_item.organization_id, p_item, p_template_item, p_path, p_content_type, p_size,
     (select auth.uid()))
  returning id into v_id;
  update public.inspection_items set editing_at = now() where id = p_item;
  return v_id;
end;
$$;

-- Removes the photo's record and returns its file path (the app deletes the file).
create or replace function public.delete_inspection_photo(p_photo uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_photo public.inspection_photos%rowtype;
begin
  select * into v_photo from public.inspection_photos where id = p_photo;
  if v_photo.id is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  perform public.held_check(v_photo.item_id);
  delete from public.inspection_photos where id = p_photo;
  return v_photo.storage_path;
end;
$$;

-- ---------------------------------------------------------------------------
-- Completing the inspection
-- ---------------------------------------------------------------------------

-- Every started check must be finished first. Devices nobody checked are recorded
-- as "not checked"; devices that passed get the date of their check (in the
-- organization's time zone) as their last inspection.
create or replace function public.complete_inspection(p_inspection uuid, p_notes text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inspection public.inspections%rowtype;
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
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
    'notChecked', count(*) filter (where outcome = 'not_checked')
  ) into v_result
  from public.inspection_items where inspection_id = p_inspection;
  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Storage: photos of a check go to the check's folder of an inspection in
-- progress, by the person holding the check; they may also remove their own.
-- ---------------------------------------------------------------------------

create policy org_assets_inspection_photo_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'org-assets'
    and (storage.foldername(name))[2] = 'inspections'
    and exists (
      select 1
      from public.inspection_items i
      join public.inspections s on s.id = i.inspection_id
      where s.organization_id = public.storage_organization_id(name)
        and s.id::text = (storage.foldername(name))[3]
        and i.id::text = (storage.foldername(name))[4]
        and s.status = 'in_progress'
        and i.editing_by = (select auth.uid())
    )
  );

create policy org_assets_inspection_photo_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'org-assets'
    and (storage.foldername(name))[2] = 'inspections'
    and owner_id = (select auth.uid())::text
    and public.is_member(public.storage_organization_id(name))
  );

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function public.check_hold_expired(timestamptz) from public, anon;
revoke all on function public.held_check(uuid) from public, anon, authenticated;
revoke all on function public.check_answers_complete(uuid) from public, anon, authenticated;
revoke all on function public.check_outcome_of(uuid) from public, anon, authenticated;
revoke all on function public.start_inspection(uuid) from public, anon;
revoke all on function public.open_device_check(uuid, uuid, boolean) from public, anon;
revoke all on function public.release_device_check(uuid) from public, anon;
revoke all on function public.save_answer(uuid, uuid, boolean, numeric, text, text) from public, anon;
revoke all on function public.save_check_note(uuid, text) from public, anon;
revoke all on function public.finish_device_check(uuid) from public, anon;
revoke all on function public.add_inspection_photo(uuid, uuid, text, text, integer) from public, anon;
revoke all on function public.delete_inspection_photo(uuid) from public, anon;
revoke all on function public.complete_inspection(uuid, text) from public, anon;

grant execute on function public.check_hold_expired(timestamptz) to authenticated;
grant execute on function public.start_inspection(uuid) to authenticated;
grant execute on function public.open_device_check(uuid, uuid, boolean) to authenticated;
grant execute on function public.release_device_check(uuid) to authenticated;
grant execute on function public.save_answer(uuid, uuid, boolean, numeric, text, text) to authenticated;
grant execute on function public.save_check_note(uuid, text) to authenticated;
grant execute on function public.finish_device_check(uuid) to authenticated;
grant execute on function public.add_inspection_photo(uuid, uuid, text, text, integer) to authenticated;
grant execute on function public.delete_inspection_photo(uuid) to authenticated;
grant execute on function public.complete_inspection(uuid, text) to authenticated;
