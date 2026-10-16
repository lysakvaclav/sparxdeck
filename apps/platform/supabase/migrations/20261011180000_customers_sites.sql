-- Part 3: customers, sites (buildings) and locations inside a site.
--
-- * Owners and admins manage; every member (technicians included) can read.
-- * Customers and sites are soft-deleted (deleted_at); nothing is removed, so later
--   inspections and reports keep their references. Deleting a customer hides its sites.
-- * Composite foreign keys (id, organization_id) make it impossible to attach a site
--   to another organization's customer, or a location to another organization's site.

-- ---------------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------------

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  company_id text check (char_length(company_id) <= 20),
  vat_id text check (char_length(vat_id) <= 20),
  contact_person text check (char_length(contact_person) <= 120),
  email text check (char_length(email) <= 254),
  phone text check (char_length(phone) <= 40),
  billing_address text check (char_length(billing_address) <= 500),
  notes text check (char_length(notes) <= 5000),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, organization_id)
);

create index customers_org_name_idx on public.customers (organization_id, lower(name)) where deleted_at is null;

create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- sites (buildings / premises)
-- ---------------------------------------------------------------------------

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  address text check (char_length(address) <= 500),
  -- Keys, reception, who to call on arrival: what a technician needs at the door.
  access_notes text check (char_length(access_notes) <= 2000),
  notes text check (char_length(notes) <= 5000),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, organization_id),
  foreign key (customer_id, organization_id) references public.customers (id, organization_id)
);

create index sites_customer_idx on public.sites (customer_id) where deleted_at is null;
create index sites_org_idx on public.sites (organization_id) where deleted_at is null;

create trigger sites_set_updated_at
  before update on public.sites
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- locations (floor, room, corridor) inside a site
-- ---------------------------------------------------------------------------

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  site_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (site_id, organization_id) references public.sites (id, organization_id) on delete cascade
);

create index locations_site_idx on public.locations (site_id, sort_order);

create trigger locations_set_updated_at
  before update on public.locations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Soft-deleting a customer hides its sites too.
-- ---------------------------------------------------------------------------

create or replace function public.cascade_customer_soft_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    update public.sites set deleted_at = new.deleted_at
    where customer_id = new.id and deleted_at is null;
  end if;
  return new;
end;
$$;

create trigger customers_cascade_soft_delete
  after update of deleted_at on public.customers
  for each row execute function public.cascade_customer_soft_delete();

-- New sites can't be added under a deleted customer.
create or replace function public.prevent_site_under_deleted_customer()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.deleted_at is null and exists (
    select 1 from public.customers where id = new.customer_id and deleted_at is not null
  ) then
    raise exception 'customer_deleted' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger sites_prevent_deleted_customer
  before insert or update of customer_id, deleted_at on public.sites
  for each row execute function public.prevent_site_under_deleted_customer();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.customers enable row level security;
alter table public.sites enable row level security;
alter table public.locations enable row level security;

create policy customers_select on public.customers
  for select to authenticated using (public.is_member(organization_id));
create policy customers_insert on public.customers
  for insert to authenticated
  with check (public.has_role(organization_id, array['owner', 'admin']::public.member_role[]));
create policy customers_update on public.customers
  for update to authenticated
  using (public.has_role(organization_id, array['owner', 'admin']::public.member_role[]))
  with check (public.has_role(organization_id, array['owner', 'admin']::public.member_role[]));

create policy sites_select on public.sites
  for select to authenticated using (public.is_member(organization_id));
create policy sites_insert on public.sites
  for insert to authenticated
  with check (public.has_role(organization_id, array['owner', 'admin']::public.member_role[]));
create policy sites_update on public.sites
  for update to authenticated
  using (public.has_role(organization_id, array['owner', 'admin']::public.member_role[]))
  with check (public.has_role(organization_id, array['owner', 'admin']::public.member_role[]));

create policy locations_select on public.locations
  for select to authenticated using (public.is_member(organization_id));
create policy locations_insert on public.locations
  for insert to authenticated
  with check (public.has_role(organization_id, array['owner', 'admin']::public.member_role[]));
create policy locations_update on public.locations
  for update to authenticated
  using (public.has_role(organization_id, array['owner', 'admin']::public.member_role[]))
  with check (public.has_role(organization_id, array['owner', 'admin']::public.member_role[]));
create policy locations_delete on public.locations
  for delete to authenticated
  using (public.has_role(organization_id, array['owner', 'admin']::public.member_role[]));

-- No hard deletes of customers or sites through the API; soft delete only.
revoke delete on public.customers, public.sites from authenticated;
revoke all on public.customers, public.sites, public.locations from anon;

-- ---------------------------------------------------------------------------
-- Reordering locations atomically.
-- ---------------------------------------------------------------------------

-- Sets sort_order to the position in p_ordered (which must be exactly the site's locations).
create or replace function public.reorder_locations(p_site uuid, p_ordered uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.locations where site_id = p_site;
  if v_count <> coalesce(array_length(p_ordered, 1), 0)
     or exists (
       select 1 from unnest(p_ordered) as ordered(id)
       where not exists (select 1 from public.locations l where l.id = ordered.id and l.site_id = p_site)
     ) then
    raise exception 'locations_mismatch' using errcode = 'P0001';
  end if;

  -- RLS (security invoker) limits this to owners/admins of the site's organization.
  update public.locations l
  set sort_order = ordered.position
  from unnest(p_ordered) with ordinality as ordered(id, position)
  where l.id = ordered.id and l.site_id = p_site;
end;
$$;

revoke all on function public.reorder_locations(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_locations(uuid, uuid[]) to authenticated;
revoke all on function public.cascade_customer_soft_delete() from public, anon, authenticated;
revoke all on function public.prevent_site_under_deleted_customer() from public, anon, authenticated;
