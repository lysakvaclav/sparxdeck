-- Part 23 (Díl 4), stage A: routes for technicians.
--
-- * route_plans: a technician's day of visits with a start point and the
--   options of the ordering (return to the start, first or last stop kept).
--   The order itself is computed in the browser (src/lib/routes.ts, straight-line
--   distances); the database keeps what was saved. A route's state (planned,
--   under way, done) follows from its stops, it is not stored.
-- * route_plan_stops: a building in a route, its place in the order, minutes on
--   site, a note, and when it was visited. At most 30 stops per route.
-- * Every stop is a planned visit of the calendar (inspection_plans, part 19):
--   adding a stop links the building's open plan for that day or creates one,
--   so the calendar, "My work" and the link to the started inspection work as
--   before. A plan that belongs to a route is moved with the route only; the
--   calendar may delete it, which removes the stop. Completing the inspection
--   that carried out a stop's visit marks the stop visited.
-- * Start points: organizations.base_latitude/longitude (the company's seat,
--   owners and admins) and member_homes (each member's own home; only they and
--   the owners and admins see it, colleagues don't). A route copies the point
--   it starts from.
-- * Owners and admins see and plan routes of every member; a technician sees
--   and plans their own. Writes across tables go through the functions below.
--
-- Rollback (nothing else depends on it):
--   drop table public.route_plan_stops, public.route_plans, public.member_homes;
--   drop function public.route_editable(uuid), public.create_route_plan(uuid, date, uuid, text),
--     public.update_route_plan(uuid, date, uuid), public.add_route_stops(uuid, uuid[]),
--     public.remove_route_stop(uuid), public.reorder_route_stops(uuid, uuid[]),
--     public.set_route_stop_visited(uuid, boolean), public.route_plan_guard(),
--     public.route_stop_release_plan(), public.route_stops_visited();
--   drop type public.route_start_kind;
--   alter table public.organizations drop column base_latitude, drop column base_longitude;

-- ---------------------------------------------------------------------------
-- Start points
-- ---------------------------------------------------------------------------

alter table public.organizations
  add column base_latitude double precision check (base_latitude between -90 and 90),
  add column base_longitude double precision check (base_longitude between -180 and 180),
  add constraint organizations_base_pair check ((base_latitude is null) = (base_longitude is null));

-- Not a column of memberships: every member reads their colleagues' rows there.
create table public.member_homes (
  organization_id uuid not null,
  user_id uuid not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id),
  foreign key (organization_id, user_id)
    references public.memberships (organization_id, user_id) on delete cascade
);

create trigger member_homes_set_updated_at
  before update on public.member_homes
  for each row execute function public.set_updated_at();

alter table public.member_homes enable row level security;

create policy member_homes_select on public.member_homes
  for select to authenticated
  using (
    (user_id = (select auth.uid()) and public.is_member(organization_id))
    or public.has_role(organization_id, array['owner', 'admin']::public.member_role[])
  );
create policy member_homes_insert on public.member_homes
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_member(organization_id));
create policy member_homes_update on public.member_homes
  for update to authenticated
  using (user_id = (select auth.uid()) and public.is_member(organization_id))
  with check (user_id = (select auth.uid()) and public.is_member(organization_id));
create policy member_homes_delete on public.member_homes
  for delete to authenticated
  using (user_id = (select auth.uid()) and public.is_member(organization_id));

revoke all on public.member_homes from anon, authenticated;
grant select, insert, delete on public.member_homes to authenticated;
-- The keys too, for an upsert (the policies keep it to the member's own row).
grant update (organization_id, user_id, latitude, longitude) on public.member_homes to authenticated;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- company: the seat; home: the technician's home; here: the phone's position
-- when it was taken; custom: typed or pasted; none: from the first stop.
create type public.route_start_kind as enum ('company', 'home', 'here', 'custom', 'none');

create table public.route_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  technician_id uuid,
  planned_on date not null check (planned_on >= date '2000-01-01'),
  name text not null default '' check (char_length(name) <= 120),
  start_kind public.route_start_kind not null default 'none',
  start_latitude double precision check (start_latitude between -90 and 90),
  start_longitude double precision check (start_longitude between -180 and 180),
  return_to_start boolean not null default true,
  lock_first boolean not null default false,
  lock_last boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  check ((start_latitude is null) = (start_longitude is null)),
  check ((start_kind = 'none') = (start_latitude is null)),
  -- Removing a member keeps their routes, unassigned (like the calendar's plans).
  foreign key (organization_id, technician_id)
    references public.memberships (organization_id, user_id) on delete set null (technician_id)
);

create index route_plans_org_day_idx on public.route_plans (organization_id, planned_on);
create index route_plans_technician_idx on public.route_plans (technician_id, planned_on);

create trigger route_plans_set_updated_at
  before update on public.route_plans
  for each row execute function public.set_updated_at();

create table public.route_plan_stops (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  route_id uuid not null,
  site_id uuid not null,
  position smallint not null check (position between 1 and 30),
  minutes smallint check (minutes between 0 and 720),
  note text check (char_length(note) <= 500),
  -- The calendar's visit; deleting it there removes the stop.
  inspection_plan_id uuid unique references public.inspection_plans (id) on delete cascade,
  -- The plan was created for this stop (removing the stop removes it too).
  owns_plan boolean not null default false,
  visited_at timestamptz,
  visited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (route_id, organization_id)
    references public.route_plans (id, organization_id) on delete cascade,
  foreign key (site_id, organization_id)
    references public.sites (id, organization_id) on delete cascade,
  unique (route_id, site_id),
  -- Checked at commit: reordering swaps positions within one statement.
  unique (route_id, position) deferrable initially deferred
);

create index route_plan_stops_site_idx on public.route_plan_stops (site_id);

create trigger route_plan_stops_set_updated_at
  before update on public.route_plan_stops
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

-- The route row when the caller may change it: owners and admins of its
-- organization, or the member it is planned for. Otherwise not_found.
create or replace function public.route_editable(p_route uuid)
returns public.route_plans
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_route public.route_plans%rowtype;
begin
  select * into v_route from public.route_plans where id = p_route;
  if not found
    or not public.is_member(v_route.organization_id)
    or not (
      public.has_role(v_route.organization_id, array['owner', 'admin']::public.member_role[])
      or v_route.technician_id = (select auth.uid())
    )
  then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  return v_route;
end;
$$;

alter table public.route_plans enable row level security;
alter table public.route_plan_stops enable row level security;

create policy route_plans_select on public.route_plans
  for select to authenticated
  using (
    public.has_role(organization_id, array['owner', 'admin']::public.member_role[])
    or (technician_id = (select auth.uid()) and public.is_member(organization_id))
  );
create policy route_plans_update on public.route_plans
  for update to authenticated
  using (
    public.has_role(organization_id, array['owner', 'admin']::public.member_role[])
    or (technician_id = (select auth.uid()) and public.is_member(organization_id))
  )
  with check (
    public.has_role(organization_id, array['owner', 'admin']::public.member_role[])
    or (technician_id = (select auth.uid()) and public.is_member(organization_id))
  );
create policy route_plans_delete on public.route_plans
  for delete to authenticated
  using (
    public.has_role(organization_id, array['owner', 'admin']::public.member_role[])
    or (technician_id = (select auth.uid()) and public.is_member(organization_id))
  );

-- A stop is visible and editable with its route (the route's policies apply
-- inside the subquery).
create policy route_plan_stops_select on public.route_plan_stops
  for select to authenticated
  using (exists (select 1 from public.route_plans r where r.id = route_id));
create policy route_plan_stops_update on public.route_plan_stops
  for update to authenticated
  using (exists (select 1 from public.route_plans r where r.id = route_id))
  with check (exists (select 1 from public.route_plans r where r.id = route_id));

-- Created, moved and ordered by the functions; the client edits only these.
revoke all on public.route_plans, public.route_plan_stops from anon, authenticated;
grant select, delete on public.route_plans to authenticated;
grant update (name, start_kind, start_latitude, start_longitude, return_to_start, lock_first, lock_last)
  on public.route_plans to authenticated;
grant select on public.route_plan_stops to authenticated;
grant update (minutes, note) on public.route_plan_stops to authenticated;

-- ---------------------------------------------------------------------------
-- The calendar's visits that belong to a route
-- ---------------------------------------------------------------------------

-- A route's visit moves with the route: changing its day, technician or
-- building in the calendar is refused (the route's functions set the flag).
create or replace function public.route_plan_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.planned_on is distinct from old.planned_on
      or new.technician_id is distinct from old.technician_id
      or new.site_id is distinct from old.site_id)
    and coalesce(current_setting('sparxdeck.route_sync', true), '') <> 'on'
    and exists (select 1 from public.route_plan_stops where inspection_plan_id = new.id)
  then
    raise exception 'plan_in_route' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger inspection_plans_route_guard
  before update on public.inspection_plans
  for each row execute function public.route_plan_guard();

-- A stop that is removed takes the visit created for it, unless it was carried out.
create or replace function public.route_stop_release_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.owns_plan and old.inspection_plan_id is not null then
    delete from public.inspection_plans
    where id = old.inspection_plan_id and inspection_id is null;
  end if;
  return old;
end;
$$;

create trigger route_plan_stops_release_plan
  after delete on public.route_plan_stops
  for each row execute function public.route_stop_release_plan();

-- Completing the inspection that carried out a stop's visit marks it visited.
create or replace function public.route_stops_visited()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    update public.route_plan_stops s
    set visited_at = new.completed_at, visited_by = new.completed_by
    from public.inspection_plans p
    where p.inspection_id = new.id
      and s.inspection_plan_id = p.id
      and s.visited_at is null;
  end if;
  return new;
end;
$$;

create trigger inspections_route_stops_visited
  after update of status on public.inspections
  for each row execute function public.route_stops_visited();

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

-- A new route. Owners and admins plan for any member (or nobody yet); others
-- for themselves. It starts from the technician's home, else the company's seat.
create or replace function public.create_route_plan(
  p_organization uuid,
  p_planned_on date,
  p_technician uuid,
  p_name text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_manager boolean;
  v_lat double precision;
  v_lng double precision;
  v_kind public.route_start_kind := 'none';
  v_id uuid;
begin
  if not public.is_member(p_organization) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  v_manager := public.has_role(p_organization, array['owner', 'admin']::public.member_role[]);
  if not v_manager and p_technician is distinct from (select auth.uid()) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if p_technician is not null and not exists (
    select 1 from public.memberships where organization_id = p_organization and user_id = p_technician
  ) then
    raise exception 'member_not_found' using errcode = 'P0001';
  end if;
  if p_planned_on is null or p_planned_on < date '2000-01-01' then
    raise exception 'invalid_route' using errcode = 'P0001';
  end if;

  select latitude, longitude into v_lat, v_lng
  from public.member_homes
  where organization_id = p_organization and user_id = p_technician;
  if v_lat is not null then
    v_kind := 'home';
  else
    select base_latitude, base_longitude into v_lat, v_lng
    from public.organizations where id = p_organization;
    if v_lat is not null then
      v_kind := 'company';
    end if;
  end if;

  insert into public.route_plans
    (organization_id, technician_id, planned_on, name, start_kind, start_latitude,
     start_longitude, created_by)
  values
    (p_organization, p_technician, p_planned_on, left(btrim(coalesce(p_name, '')), 120), v_kind,
     v_lat, v_lng, (select auth.uid()))
  returning id into v_id;
  return v_id;
end;
$$;

-- Another day or technician: the route's visits not carried out yet follow.
create or replace function public.update_route_plan(
  p_route uuid,
  p_planned_on date,
  p_technician uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_route public.route_plans%rowtype;
begin
  v_route := public.route_editable(p_route);
  if not public.has_role(v_route.organization_id, array['owner', 'admin']::public.member_role[])
     and p_technician is distinct from (select auth.uid())
  then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if p_technician is not null and not exists (
    select 1 from public.memberships
    where organization_id = v_route.organization_id and user_id = p_technician
  ) then
    raise exception 'member_not_found' using errcode = 'P0001';
  end if;
  if p_planned_on is null or p_planned_on < date '2000-01-01' then
    raise exception 'invalid_route' using errcode = 'P0001';
  end if;

  update public.route_plans
  set planned_on = p_planned_on, technician_id = p_technician
  where id = p_route;

  perform set_config('sparxdeck.route_sync', 'on', true);
  update public.inspection_plans p
  set planned_on = p_planned_on, technician_id = p_technician
  from public.route_plan_stops s
  where s.route_id = p_route and p.id = s.inspection_plan_id and p.inspection_id is null;
  perform set_config('sparxdeck.route_sync', '', true);
end;
$$;

-- Buildings appended to a route in the given order (ones already in it are
-- skipped). Each gets the calendar's visit: the building's open plan for that
-- day (unassigned or the same technician's, not in another route), or a new one.
-- Returns how many were added.
create or replace function public.add_route_stops(p_route uuid, p_sites uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_route public.route_plans%rowtype;
  v_site uuid;
  v_count integer;
  v_added integer := 0;
  v_plan uuid;
  v_owns boolean;
begin
  v_route := public.route_editable(p_route);
  -- One change of a route at a time (positions and the limit).
  perform 1 from public.route_plans where id = p_route for update;
  select count(*) into v_count from public.route_plan_stops where route_id = p_route;

  foreach v_site in array coalesce(p_sites, '{}') loop
    continue when exists (
      select 1 from public.route_plan_stops where route_id = p_route and site_id = v_site
    );
    if not exists (
      select 1 from public.sites where id = v_site and organization_id = v_route.organization_id
    ) then
      raise exception 'not_found' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.sites where id = v_site and deleted_at is not null) then
      raise exception 'site_deleted' using errcode = 'P0001';
    end if;
    if v_count >= 30 then
      raise exception 'route_too_long' using errcode = 'P0001';
    end if;

    select p.id into v_plan
    from public.inspection_plans p
    where p.site_id = v_site
      and p.planned_on = v_route.planned_on
      and p.inspection_id is null
      and (p.technician_id is null or p.technician_id is not distinct from v_route.technician_id)
      and not exists (select 1 from public.route_plan_stops s where s.inspection_plan_id = p.id)
    order by p.technician_id nulls last, p.created_at
    limit 1;
    v_owns := v_plan is null;
    if v_owns then
      insert into public.inspection_plans
        (organization_id, site_id, planned_on, technician_id, created_by)
      values
        (v_route.organization_id, v_site, v_route.planned_on, v_route.technician_id,
         (select auth.uid()))
      returning id into v_plan;
    else
      update public.inspection_plans set technician_id = v_route.technician_id
      where id = v_plan and technician_id is null;
    end if;

    v_count := v_count + 1;
    insert into public.route_plan_stops
      (organization_id, route_id, site_id, position, inspection_plan_id, owns_plan)
    values
      (v_route.organization_id, p_route, v_site, v_count, v_plan, v_owns);
    v_added := v_added + 1;
  end loop;
  return v_added;
end;
$$;

-- A stop leaves the route; the ones after it move up.
create or replace function public.remove_route_stop(p_stop uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stop public.route_plan_stops%rowtype;
begin
  select * into v_stop from public.route_plan_stops where id = p_stop;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  perform public.route_editable(v_stop.route_id);
  perform 1 from public.route_plans where id = v_stop.route_id for update;
  delete from public.route_plan_stops where id = p_stop;
  update public.route_plan_stops
  set position = position - 1
  where route_id = v_stop.route_id and position > v_stop.position;
end;
$$;

-- The whole order at once: exactly the route's stops, first to last.
-- Anything else (a stop added or removed meanwhile) is route_changed.
create or replace function public.reorder_route_stops(p_route uuid, p_stops uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.route_editable(p_route);
  perform 1 from public.route_plans where id = p_route for update;
  if coalesce(array_length(p_stops, 1), 0) <> (
       select count(*) from public.route_plan_stops where route_id = p_route)
     or (select count(distinct x) from unnest(p_stops) x) <> coalesce(array_length(p_stops, 1), 0)
     or exists (
       select 1 from unnest(p_stops) x
       where not exists (select 1 from public.route_plan_stops where id = x and route_id = p_route)
     )
  then
    raise exception 'route_changed' using errcode = 'P0001';
  end if;
  update public.route_plan_stops s
  set position = o.n
  from unnest(p_stops) with ordinality as o(id, n)
  where s.id = o.id and s.position is distinct from o.n;
end;
$$;

-- Visited, or not after all.
create or replace function public.set_route_stop_visited(p_stop uuid, p_visited boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stop public.route_plan_stops%rowtype;
begin
  select * into v_stop from public.route_plan_stops where id = p_stop;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  perform public.route_editable(v_stop.route_id);
  if p_visited and v_stop.visited_at is null then
    update public.route_plan_stops set visited_at = now(), visited_by = (select auth.uid())
    where id = p_stop;
  elsif not p_visited then
    update public.route_plan_stops set visited_at = null, visited_by = null where id = p_stop;
  end if;
end;
$$;

revoke all on function public.route_editable(uuid) from public, anon;
revoke all on function public.create_route_plan(uuid, date, uuid, text) from public, anon;
revoke all on function public.update_route_plan(uuid, date, uuid) from public, anon;
revoke all on function public.add_route_stops(uuid, uuid[]) from public, anon;
revoke all on function public.remove_route_stop(uuid) from public, anon;
revoke all on function public.reorder_route_stops(uuid, uuid[]) from public, anon;
revoke all on function public.set_route_stop_visited(uuid, boolean) from public, anon;
grant execute on function public.create_route_plan(uuid, date, uuid, text) to authenticated;
grant execute on function public.update_route_plan(uuid, date, uuid) to authenticated;
grant execute on function public.add_route_stops(uuid, uuid[]) to authenticated;
grant execute on function public.remove_route_stop(uuid) to authenticated;
grant execute on function public.reorder_route_stops(uuid, uuid[]) to authenticated;
grant execute on function public.set_route_stop_visited(uuid, boolean) to authenticated;
revoke all on function public.route_editable(uuid) from authenticated;
revoke all on function public.route_plan_guard() from public, anon, authenticated;
revoke all on function public.route_stop_release_plan() from public, anon, authenticated;
revoke all on function public.route_stops_visited() from public, anon, authenticated;
