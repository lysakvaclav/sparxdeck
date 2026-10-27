-- Part 21: the map of buildings with a traffic light. The state of each
-- building is computed here (not by sending every device to the browser), from
-- the same due-date rule the app uses everywhere (src/lib/due.ts dueState;
-- tests compare them) and the company's "soon" limit (organizations.due_soon_days).
--
-- Rollback:
--   drop function public.site_map_statuses(uuid, uuid, uuid);
--   drop function public.due_state(date, date, integer);

-- ---------------------------------------------------------------------------
-- The due-date rule (as dueState in src/lib/due.ts)
-- ---------------------------------------------------------------------------

create or replace function public.due_state(p_next_due date, p_today date, p_soon_days integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_next_due is null then 'never'
    when p_next_due < p_today then 'overdue'
    when p_next_due <= p_today + p_soon_days then 'soon'
    else 'ok'
  end;
$$;

-- ---------------------------------------------------------------------------
-- One row per building of the caller's company, with its state:
--   critical: a device past its due date, or an open critical defect;
--   warning:  a device due within the company's "soon" days or never
--             inspected, or an open major or minor defect;
--   ok:       every device inspected in time and no open defect;
--   none:     no active device.
-- Only active devices count. Filters: customer, device type (its devices and
-- their defects only), technician (a visit planned from today on, or the last
-- completed inspection of the building was theirs).
-- Runs as the caller: Row Level Security keeps other companies out.
-- ---------------------------------------------------------------------------

create or replace function public.site_map_statuses(
  p_customer uuid default null,
  p_device_type uuid default null,
  p_technician uuid default null
)
returns table (
  site_id uuid,
  name text,
  address text,
  customer_id uuid,
  customer_name text,
  latitude double precision,
  longitude double precision,
  status text,
  devices integer,
  overdue integer,
  soon integer,
  never integer,
  defects_critical integer,
  defects_major integer,
  defects_minor integer,
  next_due date
)
language sql
stable
security invoker
set search_path = ''
as $$
  with org as (
    select o.id, o.due_soon_days, (now() at time zone o.timezone)::date as today
    from public.organizations o
  ),
  chosen as (
    select s.id, s.name, s.address, s.customer_id, c.name as customer_name,
           s.latitude, s.longitude, org.today, org.due_soon_days
    from public.sites s
    join org on org.id = s.organization_id
    join public.customers c on c.id = s.customer_id
    where s.deleted_at is null
      and c.deleted_at is null
      and (p_customer is null or s.customer_id = p_customer)
      and (
        p_device_type is null
        or exists (
          select 1 from public.devices d
          where d.site_id = s.id and d.device_type_id = p_device_type
            and d.deleted_at is null and d.status = 'active'
        )
      )
      and (
        p_technician is null
        or exists (
          select 1 from public.inspection_plans p
          where p.site_id = s.id and p.technician_id = p_technician
            and p.planned_on >= org.today and p.inspection_id is null
        )
        or (
          select i.completed_by from public.inspections i
          where i.site_id = s.id and i.status = 'completed'
          order by i.completed_at desc
          limit 1
        ) = p_technician
      )
  ),
  device_counts as (
    select d.site_id,
           count(*)::integer as devices,
           count(*) filter (where public.due_state(d.next_due_on, ch.today, ch.due_soon_days) = 'overdue')::integer as overdue,
           count(*) filter (where public.due_state(d.next_due_on, ch.today, ch.due_soon_days) = 'soon')::integer as soon,
           count(*) filter (where d.next_due_on is null)::integer as never,
           min(d.next_due_on) as next_due
    from public.devices d
    join chosen ch on ch.id = d.site_id
    where d.deleted_at is null
      and d.status = 'active'
      and (p_device_type is null or d.device_type_id = p_device_type)
    group by d.site_id
  ),
  defect_counts as (
    select d.site_id,
           count(*) filter (where f.severity = 'critical')::integer as critical,
           count(*) filter (where f.severity = 'major')::integer as major,
           count(*) filter (where f.severity = 'minor')::integer as minor
    from public.defects f
    join public.devices d on d.id = f.device_id
    join chosen ch on ch.id = d.site_id
    where f.status <> 'resolved'
      and d.deleted_at is null
      and d.status = 'active'
      and (p_device_type is null or d.device_type_id = p_device_type)
    group by d.site_id
  )
  select ch.id, ch.name, ch.address, ch.customer_id, ch.customer_name,
         ch.latitude, ch.longitude,
         case
           when coalesce(dc.devices, 0) = 0 then 'none'
           when dc.overdue > 0 or coalesce(fc.critical, 0) > 0 then 'critical'
           when dc.soon > 0 or dc.never > 0 or coalesce(fc.major, 0) > 0
             or coalesce(fc.minor, 0) > 0 then 'warning'
           else 'ok'
         end,
         coalesce(dc.devices, 0), coalesce(dc.overdue, 0), coalesce(dc.soon, 0),
         coalesce(dc.never, 0), coalesce(fc.critical, 0), coalesce(fc.major, 0),
         coalesce(fc.minor, 0), dc.next_due
  from chosen ch
  left join device_counts dc on dc.site_id = ch.id
  left join defect_counts fc on fc.site_id = ch.id
  order by ch.name, ch.id;
$$;

grant execute on function public.due_state(date, date, integer) to authenticated;
revoke all on function public.site_map_statuses(uuid, uuid, uuid) from public, anon;
grant execute on function public.site_map_statuses(uuid, uuid, uuid) to authenticated;
