-- Part 13: floor plans.
--
-- A floor plan is an image of a floor (or any part) of a building, uploaded by
-- an owner or admin into the organization's folder. Devices of the building are
-- placed on it as points relative to the image (0..1), so a marker stays in the
-- same spot at any size. Everyone in the company sees plans, also during an
-- inspection; only owners and admins change them.

-- A device placed on a plan must be in the plan's building.
alter table public.devices add constraint devices_id_site_id_key unique (id, site_id);

-- ---------------------------------------------------------------------------
-- floor_plans
-- ---------------------------------------------------------------------------

create table public.floor_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  site_id uuid not null,
  -- Optional: the location (floor) the plan shows.
  location_id uuid,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  sort_order integer not null default 0,
  image_path text not null check (char_length(image_path) <= 300),
  image_width integer not null check (image_width between 1 and 10000),
  image_height integer not null check (image_height between 1 and 10000),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (id, site_id),
  -- The image is in the organization's own folder.
  check (image_path like organization_id::text || '/floor-plans/%'),
  foreign key (site_id, organization_id) references public.sites (id, organization_id) on delete cascade,
  foreign key (location_id, site_id) references public.locations (id, site_id) on delete set null (location_id)
);

create index floor_plans_site_idx on public.floor_plans (site_id, sort_order);
create index floor_plans_location_idx on public.floor_plans (location_id) where location_id is not null;

create trigger floor_plans_set_updated_at
  before update on public.floor_plans
  for each row execute function public.set_updated_at();

-- No new plans in a deleted building.
create or replace function public.prevent_floor_plan_in_deleted_site()
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

create trigger floor_plans_prevent_deleted_site
  before insert on public.floor_plans
  for each row execute function public.prevent_floor_plan_in_deleted_site();

-- ---------------------------------------------------------------------------
-- device_placements: where a device is on a plan (one plan per device)
-- ---------------------------------------------------------------------------

create table public.device_placements (
  device_id uuid primary key,
  organization_id uuid not null,
  site_id uuid not null,
  floor_plan_id uuid not null,
  x double precision not null check (x >= 0 and x <= 1),
  y double precision not null check (y >= 0 and y <= 1),
  updated_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Device and plan are in the same building, and the building is the
  -- organization's (one key per table, so API embeds stay unambiguous).
  foreign key (device_id, site_id) references public.devices (id, site_id) on delete cascade,
  foreign key (floor_plan_id, site_id) references public.floor_plans (id, site_id) on delete cascade,
  foreign key (site_id, organization_id) references public.sites (id, organization_id) on delete cascade
);

create index device_placements_plan_idx on public.device_placements (floor_plan_id);

create trigger device_placements_set_updated_at
  before update on public.device_placements
  for each row execute function public.set_updated_at();

-- Moving a device (or a stale write) refreshes who placed it.
create or replace function public.set_placement_author()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_by := (select auth.uid());
  return new;
end;
$$;

create trigger device_placements_set_author
  before insert or update on public.device_placements
  for each row execute function public.set_placement_author();

-- ---------------------------------------------------------------------------
-- Order of a building's plans (all of them, atomically; like locations)
-- ---------------------------------------------------------------------------

create or replace function public.reorder_floor_plans(p_site uuid, p_ordered uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.floor_plans where site_id = p_site;
  if v_count <> coalesce(array_length(p_ordered, 1), 0)
     or exists (
       select 1 from unnest(p_ordered) as ordered(id)
       where not exists (select 1 from public.floor_plans p where p.id = ordered.id and p.site_id = p_site)
     ) then
    raise exception 'floor_plans_mismatch' using errcode = 'P0001';
  end if;

  -- RLS (security invoker) limits this to owners/admins of the site's organization.
  update public.floor_plans p
  set sort_order = ordered.position
  from unnest(p_ordered) with ordinality as ordered(id, position)
  where p.id = ordered.id and p.site_id = p_site;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security and column privileges
-- ---------------------------------------------------------------------------

alter table public.floor_plans enable row level security;

create policy floor_plans_select on public.floor_plans
  for select to authenticated using (public.is_member(organization_id));
create policy floor_plans_insert on public.floor_plans
  for insert to authenticated
  with check (public.has_role(organization_id, array['owner', 'admin']::public.member_role[]));
create policy floor_plans_update on public.floor_plans
  for update to authenticated
  using (public.has_role(organization_id, array['owner', 'admin']::public.member_role[]))
  with check (public.has_role(organization_id, array['owner', 'admin']::public.member_role[]));
create policy floor_plans_delete on public.floor_plans
  for delete to authenticated
  using (public.has_role(organization_id, array['owner', 'admin']::public.member_role[]));

-- The building of a plan and who uploaded it don't change.
revoke insert, update, delete on public.floor_plans from authenticated;
grant insert (organization_id, site_id, location_id, name, sort_order, image_path, image_width,
  image_height) on public.floor_plans to authenticated;
grant update (location_id, name, sort_order, image_path, image_width, image_height)
  on public.floor_plans to authenticated;
grant delete on public.floor_plans to authenticated;
revoke all on public.floor_plans from anon;

alter table public.device_placements enable row level security;

create policy device_placements_select on public.device_placements
  for select to authenticated using (public.is_member(organization_id));
create policy device_placements_insert on public.device_placements
  for insert to authenticated
  with check (public.has_role(organization_id, array['owner', 'admin']::public.member_role[]));
create policy device_placements_update on public.device_placements
  for update to authenticated
  using (public.has_role(organization_id, array['owner', 'admin']::public.member_role[]))
  with check (public.has_role(organization_id, array['owner', 'admin']::public.member_role[]));
create policy device_placements_delete on public.device_placements
  for delete to authenticated
  using (public.has_role(organization_id, array['owner', 'admin']::public.member_role[]));

-- A placement moves to another plan of the building or another spot; the device stays.
revoke insert, update, delete on public.device_placements from authenticated;
grant insert (device_id, organization_id, site_id, floor_plan_id, x, y)
  on public.device_placements to authenticated;
grant update (floor_plan_id, x, y) on public.device_placements to authenticated;
grant delete on public.device_placements to authenticated;
revoke all on public.device_placements from anon;

revoke all on function public.reorder_floor_plans(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_floor_plans(uuid, uuid[]) to authenticated;
revoke all on function public.prevent_floor_plan_in_deleted_site() from public, anon, authenticated;
revoke all on function public.set_placement_author() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Placing a device: a new spot, or a move to another spot or plan of the
-- building. Security invoker: RLS lets only owners and admins write, and the
-- keys reject a device from another building.
-- ---------------------------------------------------------------------------

create or replace function public.place_device(
  p_device uuid,
  p_plan uuid,
  p_x double precision,
  p_y double precision
)
returns void
language plpgsql
security invoker
set search_path = ''
as $
declare
  v_plan public.floor_plans%rowtype;
begin
  select * into v_plan from public.floor_plans where id = p_plan;
  if v_plan.id is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  insert into public.device_placements (device_id, organization_id, site_id, floor_plan_id, x, y)
  values (p_device, v_plan.organization_id, v_plan.site_id, p_plan, p_x, p_y)
  on conflict (device_id) do update
    set floor_plan_id = excluded.floor_plan_id, x = excluded.x, y = excluded.y;
end;
$;

revoke all on function public.place_device(uuid, uuid, double precision, double precision) from public, anon;
grant execute on function public.place_device(uuid, uuid, double precision, double precision) to authenticated;

-- ---------------------------------------------------------------------------
-- Sample data: plans of the sample buildings go with them, images included
-- ---------------------------------------------------------------------------

create or replace function public.remove_sample_data(p_org uuid)
returns table (bucket text, path text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sites uuid[];
  v_devices uuid[];
  v_inspections uuid[];
begin
  if not public.has_role(p_org, array['owner', 'admin']::public.member_role[]) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  select coalesce(array_agg(s.id), '{}') into v_sites
  from public.sites s
  join public.customers c on c.id = s.customer_id
  where c.organization_id = p_org and c.is_sample;
  select coalesce(array_agg(id), '{}') into v_devices
  from public.devices where organization_id = p_org and site_id = any (v_sites);
  select coalesce(array_agg(id), '{}') into v_inspections
  from public.inspections where organization_id = p_org and site_id = any (v_sites);

  -- The files, before their rows go.
  create temporary table sample_files (bucket text, path text) on commit drop;
  insert into sample_files
    select 'org-assets', p.storage_path
    from public.inspection_photos p
    join public.inspection_items i on i.id = p.item_id
    where i.inspection_id = any (v_inspections)
    union all
    select 'org-assets', p.storage_path
    from public.defect_photos p
    join public.defects d on d.id = p.defect_id
    where d.device_id = any (v_devices)
    union all
    select 'protocols', pr.pdf_path
    from public.protocols pr
    where pr.inspection_id = any (v_inspections) and pr.pdf_path is not null
    union all
    select 'org-assets', fp.image_path
    from public.floor_plans fp
    where fp.organization_id = p_org and fp.site_id = any (v_sites);

  delete from public.defects where device_id = any (v_devices);
  delete from public.inspections where id = any (v_inspections);
  delete from public.devices where id = any (v_devices);
  -- Plans (and the placements left on them) go with their buildings.
  delete from public.sites where id = any (v_sites);
  delete from public.customers where organization_id = p_org and is_sample;

  -- Sample numbering starts over next time; real counters were never touched.
  delete from public.organization_counters
  where organization_id = p_org and name like 'sample\_%';

  return query select f.bucket, f.path from sample_files f;
end;
$$;

revoke all on function public.remove_sample_data(uuid) from public, anon;
grant execute on function public.remove_sample_data(uuid) to authenticated;
