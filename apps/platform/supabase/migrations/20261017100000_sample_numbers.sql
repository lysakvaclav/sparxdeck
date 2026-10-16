-- Part 11 follow-up: sample data numbers itself apart. Devices, defects and
-- protocols of a sample customer's buildings take numbers from 900001 on, from
-- their own counters, so trying the app never uses up or leaves gaps in the
-- company's real label, defect and protocol numbers.

create or replace function public.is_sample_site(p_site uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.sites s
    join public.customers c on c.id = s.customer_id
    where s.id = p_site and c.is_sample
  );
$$;

-- Where sample numbers start (far above any real company's numbers).
create or replace function public.sample_number_base()
returns integer
language sql
immutable
set search_path = ''
as $$ select 900000 $$;

create or replace function public.next_counter(p_org uuid, p_name text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_value integer;
begin
  insert into public.organization_counters (organization_id, name, value)
  values (p_org, p_name, 1)
  on conflict (organization_id, name)
    do update set value = public.organization_counters.value + 1
  returning value into v_value;
  return v_value;
end;
$$;

create or replace function public.assign_device_label()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_sample_site(new.site_id) then
    new.label_number :=
      public.sample_number_base() + public.next_counter(new.organization_id, 'sample_device_label');
  else
    new.label_number := public.next_counter(new.organization_id, 'device_label');
  end if;
  return new;
end;
$$;

create or replace function public.assign_defect_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_sample_site((select site_id from public.devices where id = new.device_id)) then
    new.number :=
      public.sample_number_base() + public.next_counter(new.organization_id, 'sample_defect');
  else
    new.number := public.next_counter(new.organization_id, 'defect');
  end if;
  return new;
end;
$$;

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

  if public.is_sample_site(v_inspection.site_id) then
    v_number := public.sample_number_base()
      + public.next_counter(v_organization.id, 'sample_protocol_' || v_year);
  else
    v_number := public.next_counter(v_organization.id, 'protocol_' || v_year);
  end if;

  insert into public.protocols (organization_id, inspection_id, year, number, locale)
  values (v_organization.id, p_inspection, v_year, v_number, v_organization.default_locale)
  returning id into v_id;
  return v_id;
end;
$$;

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
    where pr.inspection_id = any (v_inspections) and pr.pdf_path is not null;

  delete from public.defects where device_id = any (v_devices);
  delete from public.inspections where id = any (v_inspections);
  delete from public.devices where id = any (v_devices);
  delete from public.sites where id = any (v_sites);
  delete from public.customers where organization_id = p_org and is_sample;

  -- Sample numbering starts over next time; real counters were never touched.
  delete from public.organization_counters
  where organization_id = p_org and name like 'sample\_%';

  return query select f.bucket, f.path from sample_files f;
end;
$$;

revoke all on function public.is_sample_site(uuid) from public, anon, authenticated;
revoke all on function public.sample_number_base() from public, anon, authenticated;
revoke all on function public.next_counter(uuid, text) from public, anon, authenticated;
