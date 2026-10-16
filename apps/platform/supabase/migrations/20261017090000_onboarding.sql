-- Part 11: getting started.
--
-- Sample data to try the app on: one customer marked is_sample, with two
-- buildings, devices due at different times and an open defect. One call
-- removes it with everything done to it since (inspections, protocols,
-- defects), and returns the files to delete. (Sample data numbers itself from
-- 900001 on, so real numbering isn't touched: 20261017100000_sample_numbers.sql.)
--
-- The guide on the dashboard notes when the first labels were printed and
-- whether it was dismissed.

alter table public.customers add column if not exists is_sample boolean not null default false;
alter table public.organizations
  add column if not exists labels_printed_at timestamptz,
  add column if not exists guide_dismissed_at timestamptz;

-- Only create_sample_data marks a customer as a sample, and nothing changes the
-- mark: removing sample data deletes for good, so a real customer must never carry it.
create or replace function public.guard_sample_customer()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.is_sample
     and current_setting('sparxdeck.sample_data', true) is distinct from 'on' then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and new.is_sample is distinct from old.is_sample then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger customers_guard_sample
  before insert or update on public.customers
  for each row execute function public.guard_sample_customer();

-- ---------------------------------------------------------------------------
-- Labels printed (for the guide's last step)
-- ---------------------------------------------------------------------------

create or replace function public.note_labels_printed(p_org uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_member(p_org) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  update public.organizations
  set labels_printed_at = coalesce(labels_printed_at, now())
  where id = p_org;
end;
$$;

-- ---------------------------------------------------------------------------
-- Sample data
-- ---------------------------------------------------------------------------

create or replace function public.create_sample_data(p_org uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org public.organizations%rowtype;
  v_en boolean;
  v_today date;
  v_type public.device_types%rowtype;
  v_customer uuid;
  v_site_a uuid;
  v_site_b uuid;
  v_basement uuid;
  v_ground uuid;
  v_first uuid;
  v_overdue uuid;
  v_defect uuid;
begin
  if not public.has_role(p_org, array['owner', 'admin']::public.member_role[]) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.customers where organization_id = p_org and is_sample) then
    raise exception 'sample_exists' using errcode = 'P0001';
  end if;
  select * into v_org from public.organizations where id = p_org;
  v_en := v_org.default_locale = 'en';
  v_today := (now() at time zone v_org.timezone)::date;
  select * into v_type from public.device_types
  where organization_id = p_org and active
  order by (code = 'fire_extinguisher') desc, created_at
  limit 1;
  if v_type.id is null then
    raise exception 'no_device_type' using errcode = 'P0001';
  end if;

  perform set_config('sparxdeck.sample_data', 'on', true);
  insert into public.customers
    (organization_id, name, contact_person, email, billing_address, notes, is_sample, created_by)
  values (
    p_org,
    case when v_en then 'Sample – Linden Housing Co-op' else 'Ukázka – Bytové družstvo Lipová' end,
    case when v_en then 'Jane Sample' else 'Jana Ukázková' end,
    'sample@example.com',
    case when v_en then '12 Linden Street, Springfield' else 'Lipová 12, 120 00 Praha 2' end,
    case when v_en then 'Sample data to try the app. Remove it from the dashboard when you no longer need it.'
         else 'Ukázková data na vyzkoušení aplikace. Až je nebudete potřebovat, smažte je z přehledu.' end,
    true,
    (select auth.uid())
  )
  returning id into v_customer;
  perform set_config('sparxdeck.sample_data', 'off', true);

  insert into public.sites (organization_id, customer_id, name, address, access_notes, created_by)
  values (
    p_org, v_customer,
    case when v_en then '12 Linden Street' else 'Lipová 12' end,
    case when v_en then '12 Linden Street, Springfield' else E'Lipová 12\n120 00 Praha 2' end,
    case when v_en then 'Keys with the caretaker on the ground floor.' else 'Klíče u správce v přízemí.' end,
    (select auth.uid())
  )
  returning id into v_site_a;
  insert into public.sites (organization_id, customer_id, name, address, created_by)
  values (
    p_org, v_customer,
    case when v_en then '14 Linden Street – courtyard' else 'Lipová 14 – dvorní trakt' end,
    case when v_en then '14 Linden Street, Springfield' else E'Lipová 14\n120 00 Praha 2' end,
    (select auth.uid())
  )
  returning id into v_site_b;

  insert into public.locations (organization_id, site_id, name, sort_order)
  values (p_org, v_site_a, case when v_en then 'Basement' else 'Suterén' end, 1)
  returning id into v_basement;
  insert into public.locations (organization_id, site_id, name, sort_order)
  values (p_org, v_site_a, case when v_en then 'Ground floor' else 'Přízemí' end, 2)
  returning id into v_ground;
  insert into public.locations (organization_id, site_id, name, sort_order)
  values (p_org, v_site_a, case when v_en then 'First floor' else '1. patro' end, 3)
  returning id into v_first;

  -- Due dates around today: overdue, soon, later, never inspected.
  insert into public.devices
    (organization_id, site_id, location_id, device_type_id, serial_number, manufacturer,
     manufacture_year, status, last_inspection_on, attributes, created_by)
  values
    (p_org, v_site_a, v_basement, v_type.id, 'SAMPLE-0001', 'Sample', 2019, 'active',
     ((v_today - 20) - make_interval(months => v_type.inspection_interval_months))::date,
     jsonb_build_object('agent', case when v_en then 'ABC powder' else 'prášek ABC' end, 'size', '6 kg'),
     (select auth.uid()))
  returning id into v_overdue;
  insert into public.devices
    (organization_id, site_id, location_id, device_type_id, serial_number, manufacturer,
     manufacture_year, status, last_inspection_on, attributes, created_by)
  values
    (p_org, v_site_a, v_basement, v_type.id, 'SAMPLE-0002', 'Sample', 2021, 'active',
     ((v_today + 150) - make_interval(months => v_type.inspection_interval_months))::date,
     jsonb_build_object('agent', 'CO2', 'size', '5 kg'), (select auth.uid())),
    (p_org, v_site_a, v_ground, v_type.id, 'SAMPLE-0003', 'Sample', 2020, 'active',
     ((v_today + 12) - make_interval(months => v_type.inspection_interval_months))::date,
     jsonb_build_object('agent', case when v_en then 'ABC powder' else 'prášek ABC' end, 'size', '6 kg'),
     (select auth.uid())),
    (p_org, v_site_a, v_ground, v_type.id, 'SAMPLE-0004', 'Sample', 2022, 'active',
     ((v_today + 200) - make_interval(months => v_type.inspection_interval_months))::date,
     jsonb_build_object('agent', case when v_en then 'foam' else 'pěna' end, 'size', '9 l'),
     (select auth.uid())),
    (p_org, v_site_a, v_first, v_type.id, 'SAMPLE-0005', 'Sample', 2022, 'active',
     ((v_today + 90) - make_interval(months => v_type.inspection_interval_months))::date,
     jsonb_build_object('agent', case when v_en then 'ABC powder' else 'prášek ABC' end, 'size', '6 kg'),
     (select auth.uid())),
    (p_org, v_site_a, v_first, v_type.id, 'SAMPLE-0006', 'Sample', 2024, 'active', null,
     jsonb_build_object('agent', case when v_en then 'ABC powder' else 'prášek ABC' end, 'size', '2 kg'),
     (select auth.uid())),
    (p_org, v_site_b, null, v_type.id, 'SAMPLE-0007', 'Sample', 2020, 'active',
     ((v_today + 25) - make_interval(months => v_type.inspection_interval_months))::date,
     jsonb_build_object('agent', 'CO2', 'size', '2 kg'), (select auth.uid())),
    (p_org, v_site_b, null, v_type.id, 'SAMPLE-0008', 'Sample', 2023, 'active',
     ((v_today + 300) - make_interval(months => v_type.inspection_interval_months))::date,
     jsonb_build_object('agent', case when v_en then 'ABC powder' else 'prášek ABC' end, 'size', '6 kg'),
     (select auth.uid())),
    (p_org, v_site_b, null, v_type.id, 'SAMPLE-0009', 'Sample', 2012, 'out_of_service', null,
     jsonb_build_object('agent', case when v_en then 'ABC powder' else 'prášek ABC' end, 'size', '6 kg'),
     (select auth.uid()));

  insert into public.defects (organization_id, device_id, description, severity, created_by)
  values (
    p_org, v_overdue,
    case when v_en then 'Seal missing, safety pin loose.' else 'Chybí plomba, pojistka je uvolněná.' end,
    'major', (select auth.uid())
  )
  returning id into v_defect;
  insert into public.defect_events (organization_id, defect_id, kind, actor, to_value)
  values (p_org, v_defect, 'created', (select auth.uid()), 'major');

  return v_customer;
end;
$$;

-- Removes the sample customer with everything in its buildings and returns the
-- stored files that went with it (the caller deletes them from storage).
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

  -- Numbers continue from the highest real one left (so nothing real is reused).
  update public.organization_counters c
  set value = coalesce((select max(label_number) from public.devices where organization_id = p_org), 0)
  where c.organization_id = p_org and c.name = 'device_label';
  update public.organization_counters c
  set value = coalesce((select max(number) from public.defects where organization_id = p_org), 0)
  where c.organization_id = p_org and c.name = 'defect';
  update public.organization_counters c
  set value = coalesce(
    (select max(p.number) from public.protocols p
     where p.organization_id = p_org and c.name = 'protocol_' || p.year),
    0)
  where c.organization_id = p_org and c.name like 'protocol\_%';

  return query select f.bucket, f.path from sample_files f;
end;
$$;

revoke all on function public.guard_sample_customer() from public, anon, authenticated;
revoke all on function public.note_labels_printed(uuid) from public, anon;
revoke all on function public.create_sample_data(uuid) from public, anon;
revoke all on function public.remove_sample_data(uuid) from public, anon;
grant execute on function public.note_labels_printed(uuid) to authenticated;
grant execute on function public.create_sample_data(uuid) to authenticated;
grant execute on function public.remove_sample_data(uuid) to authenticated;
