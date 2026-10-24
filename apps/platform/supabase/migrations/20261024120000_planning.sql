-- Part 19: planning inspections, and defects with a person and a deadline.
--
-- * A defect can be assigned to a member of its organization and get a date by
--   which it should be fixed. Both are changed through functions (any member,
--   like the rest of a defect) and written to the defect's history. Removing a
--   member clears their assignments (the key refers to the membership).
-- * inspection_plans: a building, a day, optionally a technician and a note.
--   Owners and admins plan, every member sees the plans. Starting an inspection
--   at a building links it to that building's earliest open plan from the last
--   60 days to the next 14 (late or a little early still counts as that visit);
--   cancelling the inspection frees the plan again.

-- ---------------------------------------------------------------------------
-- Defects: who fixes it and by when
-- ---------------------------------------------------------------------------

alter table public.defects
  add column assigned_to uuid,
  add column due_on date check (due_on >= date '2000-01-01'),
  add constraint defects_assigned_member
    foreign key (organization_id, assigned_to)
    references public.memberships (organization_id, user_id)
    on delete set null (assigned_to);

create index defects_assigned_idx on public.defects (organization_id, assigned_to)
  where status <> 'resolved' and assigned_to is not null;
create index defects_due_idx on public.defects (organization_id, due_on)
  where status <> 'resolved' and due_on is not null;

alter table public.defect_events drop constraint defect_events_kind_check;
alter table public.defect_events add constraint defect_events_kind_check
  check (kind in ('created', 'status', 'severity', 'description', 'comment', 'observed',
                  'assignee', 'due'));

-- Assigns the defect to a member of its organization (null = nobody).
create or replace function public.assign_defect(p_defect uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_defect public.defects%rowtype;
begin
  v_defect := public.member_defect(p_defect);
  if p_user is not null and not exists (
    select 1 from public.memberships
    where organization_id = v_defect.organization_id and user_id = p_user
  ) then
    raise exception 'member_not_found' using errcode = 'P0001';
  end if;
  if v_defect.assigned_to is not distinct from p_user then
    return;
  end if;
  update public.defects set assigned_to = p_user where id = p_defect;
  insert into public.defect_events
    (organization_id, defect_id, kind, actor, from_value, to_value)
  values
    (v_defect.organization_id, p_defect, 'assignee', (select auth.uid()),
     v_defect.assigned_to::text, p_user::text);
end;
$$;

-- Sets the date by which the defect should be fixed (null = no deadline).
create or replace function public.set_defect_due(p_defect uuid, p_due date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_defect public.defects%rowtype;
begin
  v_defect := public.member_defect(p_defect);
  if p_due is not null and p_due < date '2000-01-01' then
    raise exception 'invalid_defect' using errcode = 'P0001';
  end if;
  if v_defect.due_on is not distinct from p_due then
    return;
  end if;
  update public.defects set due_on = p_due where id = p_defect;
  insert into public.defect_events
    (organization_id, defect_id, kind, actor, from_value, to_value)
  values
    (v_defect.organization_id, p_defect, 'due', (select auth.uid()),
     v_defect.due_on::text, p_due::text);
end;
$$;

revoke all on function public.assign_defect(uuid, uuid) from public, anon;
grant execute on function public.assign_defect(uuid, uuid) to authenticated;
revoke all on function public.set_defect_due(uuid, date) from public, anon;
grant execute on function public.set_defect_due(uuid, date) to authenticated;

-- ---------------------------------------------------------------------------
-- Planned inspections
-- ---------------------------------------------------------------------------

create table public.inspection_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  site_id uuid not null,
  planned_on date not null check (planned_on >= date '2000-01-01'),
  technician_id uuid,
  note text check (char_length(note) <= 1000),
  -- The inspection that carried out this visit (set when one is started).
  inspection_id uuid references public.inspections (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (site_id, organization_id)
    references public.sites (id, organization_id) on delete cascade,
  foreign key (organization_id, technician_id)
    references public.memberships (organization_id, user_id) on delete set null (technician_id)
);

create index inspection_plans_org_day_idx on public.inspection_plans (organization_id, planned_on);
create index inspection_plans_site_idx on public.inspection_plans (site_id, planned_on)
  where inspection_id is null;
create index inspection_plans_inspection_idx on public.inspection_plans (inspection_id)
  where inspection_id is not null;

create trigger inspection_plans_set_updated_at
  before update on public.inspection_plans
  for each row execute function public.set_updated_at();

alter table public.inspection_plans enable row level security;

create policy inspection_plans_select on public.inspection_plans
  for select to authenticated using (public.is_member(organization_id));
create policy inspection_plans_insert on public.inspection_plans
  for insert to authenticated
  with check (public.has_role(organization_id, array['owner', 'admin']::public.member_role[]));
create policy inspection_plans_update on public.inspection_plans
  for update to authenticated
  using (public.has_role(organization_id, array['owner', 'admin']::public.member_role[]))
  with check (public.has_role(organization_id, array['owner', 'admin']::public.member_role[]));
create policy inspection_plans_delete on public.inspection_plans
  for delete to authenticated
  using (public.has_role(organization_id, array['owner', 'admin']::public.member_role[]));

-- The inspection link is set by the database only.
revoke insert, update, delete on public.inspection_plans from authenticated;
grant insert (organization_id, site_id, planned_on, technician_id, note, created_by)
  on public.inspection_plans to authenticated;
grant update (site_id, planned_on, technician_id, note) on public.inspection_plans to authenticated;
grant delete on public.inspection_plans to authenticated;
revoke all on public.inspection_plans from anon;

-- No plans for a deleted building.
create or replace function public.prevent_plan_in_deleted_site()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.sites where id = new.site_id and deleted_at is not null) then
    raise exception 'site_deleted' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger inspection_plans_prevent_deleted_site
  before insert or update of site_id on public.inspection_plans
  for each row execute function public.prevent_plan_in_deleted_site();

-- Soft-deleting a building drops its open plans (done ones stay with their inspection).
create or replace function public.drop_plans_of_deleted_site()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    delete from public.inspection_plans where site_id = new.id and inspection_id is null;
  end if;
  return new;
end;
$$;

create trigger sites_drop_open_plans
  after update of deleted_at on public.sites
  for each row execute function public.drop_plans_of_deleted_site();

-- A started inspection carries out the building's earliest open plan around today.
create or replace function public.link_inspection_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date;
begin
  select (now() at time zone timezone)::date into v_today
  from public.organizations where id = new.organization_id;
  update public.inspection_plans set inspection_id = new.id
  where id = (
    select id from public.inspection_plans
    where site_id = new.site_id
      and inspection_id is null
      and planned_on between v_today - 60 and v_today + 14
    order by planned_on, created_at
    limit 1
  );
  return new;
end;
$$;

create trigger inspections_link_plan
  after insert on public.inspections
  for each row execute function public.link_inspection_plan();

revoke all on function public.prevent_plan_in_deleted_site() from public, anon, authenticated;
revoke all on function public.drop_plans_of_deleted_site() from public, anon, authenticated;
revoke all on function public.link_inspection_plan() from public, anon, authenticated;
