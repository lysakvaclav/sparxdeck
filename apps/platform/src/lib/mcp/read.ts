import "server-only";
import { defectNumber } from "@/lib/defects";
import { formatLabel } from "@/lib/devices";
import { addDays, daysBetween, dueState, todayInTimeZone, type IsoDate } from "@/lib/due";
import { searchTerms } from "@/lib/global-search";
import { protocolNumber } from "@/lib/protocol";
import type { ProtocolNumberFormat } from "@/lib/supabase/database.types";
import type { Tx } from "./db";
import { page, ToolError } from "./output";

// What MCP tools read (part 31). Every query runs as the member (RLS on) and is
// also limited to the token's company, so a member of two companies only sees
// the one they connected. Positions of technicians are never selected:
// no scan coordinates or distances, no homes, no route start points.

export type Org = {
  id: string;
  name: string;
  timezone: string;
  dueSoonDays: number;
  today: IsoDate;
};

export async function loadOrg(tx: Tx, organizationId: string): Promise<Org> {
  const [row] = await tx<{ id: string; name: string; timezone: string; due_soon_days: number }[]>`
    select id, name, timezone, due_soon_days from public.organizations where id = ${organizationId}`;
  if (!row) throw new ToolError("forbidden", "The company is not available to this connection.");
  return {
    id: row.id,
    name: row.name,
    timezone: row.timezone,
    dueSoonDays: row.due_soon_days,
    today: todayInTimeZone(row.timezone),
  };
}

/** Dates and times as JSON text: Date objects become ISO strings. */
function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** A user's text for ILIKE: wildcards in it are matched literally. */
function like(text: string): string {
  return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

const defectRef = (number: number) => `D-${defectNumber(number)}`;

function dueInfo(org: Org, nextDue: string | null, status: string) {
  if (status !== "active") return { due_state: null, days_until_due: null };
  return {
    due_state: dueState(nextDue, org.today, org.dueSoonDays),
    days_until_due: nextDue ? daysBetween(org.today, nextDue) : null,
  };
}

// ---------- Overview ----------

export async function overview(tx: Tx, org: Org) {
  const soonTo = addDays(org.today, org.dueSoonDays);
  const [devices] = await tx<Record<string, number>[]>`
    select count(*)::int as active,
           count(*) filter (where next_due_on < ${org.today})::int as overdue,
           count(*) filter (where next_due_on between ${org.today} and ${soonTo})::int as due_soon,
           count(*) filter (where next_due_on is null)::int as never_inspected,
           count(*) filter (where next_due_on between ${org.today} and ${addDays(org.today, 30)})::int as next_30,
           count(*) filter (where next_due_on between ${org.today} and ${addDays(org.today, 60)})::int as next_60,
           count(*) filter (where next_due_on between ${org.today} and ${addDays(org.today, 90)})::int as next_90
      from public.devices
     where organization_id = ${org.id} and deleted_at is null and status = 'active'`;
  const [defects] = await tx<Record<string, number>[]>`
    select count(*)::int as open,
           count(*) filter (where severity = 'critical')::int as critical,
           count(*) filter (where severity = 'major')::int as major,
           count(*) filter (where severity = 'minor')::int as minor,
           count(*) filter (where due_on < ${org.today})::int as past_due
      from public.defects
     where organization_id = ${org.id} and status <> 'resolved'`;
  const [inspections] = await tx<Record<string, number>[]>`
    select count(*) filter (where status = 'in_progress')::int as in_progress,
           count(*) filter (where status = 'completed'
                              and completed_at >= now() - interval '30 days')::int as completed_30
      from public.inspections where organization_id = ${org.id}`;
  const [counts] = await tx<Record<string, number>[]>`
    select (select count(*) from public.customers
             where organization_id = ${org.id} and deleted_at is null)::int as customers,
           (select count(*) from public.sites
             where organization_id = ${org.id} and deleted_at is null)::int as sites`;
  return {
    company: { name: org.name, timezone: org.timezone, today: org.today, due_soon_days: org.dueSoonDays },
    devices: {
      active: devices!.active!,
      overdue: devices!.overdue!,
      due_soon: devices!.due_soon!,
      never_inspected: devices!.never_inspected!,
      due_next_30_days: devices!.next_30!,
      due_next_60_days: devices!.next_60!,
      due_next_90_days: devices!.next_90!,
    },
    defects: {
      open: defects!.open!,
      critical: defects!.critical!,
      major: defects!.major!,
      minor: defects!.minor!,
      past_due: defects!.past_due!,
    },
    inspections: {
      in_progress: inspections!.in_progress!,
      completed_last_30_days: inspections!.completed_30!,
    },
    customers: counts!.customers!,
    sites: counts!.sites!,
  };
}

// ---------- Devices ----------

type DeviceRow = {
  id: string;
  label_number: number;
  type_id: string;
  type_name: string;
  site_id: string;
  site_name: string;
  customer_id: string;
  customer_name: string;
  location: string | null;
  serial_number: string | null;
  manufacturer: string | null;
  model: string | null;
  status: string;
  last_inspection_on: string | null;
  next_due_on: string | null;
};

function deviceSummary(org: Org, row: DeviceRow) {
  return {
    id: row.id,
    label: formatLabel(row.label_number),
    type: { id: row.type_id, name: row.type_name },
    site: { id: row.site_id, name: row.site_name },
    customer: { id: row.customer_id, name: row.customer_name },
    location: row.location,
    serial_number: row.serial_number,
    manufacturer: row.manufacturer,
    model: row.model,
    status: row.status,
    last_inspection_on: row.last_inspection_on,
    next_due_on: row.next_due_on,
    ...dueInfo(org, row.next_due_on, row.status),
  };
}

const DEVICE_COLUMNS = (tx: Tx) => tx`
  d.id, d.label_number, t.id as type_id, t.name as type_name, s.id as site_id, s.name as site_name,
  c.id as customer_id, c.name as customer_name, l.name as location, d.serial_number, d.manufacturer,
  d.model, d.status::text, d.last_inspection_on::text, d.next_due_on::text`;

const DEVICE_FROM = (tx: Tx) => tx`
  from public.devices d
  join public.device_types t on t.id = d.device_type_id
  join public.sites s on s.id = d.site_id
  join public.customers c on c.id = s.customer_id
  left join public.locations l on l.id = d.location_id`;

export async function listDue(
  tx: Tx,
  org: Org,
  args: {
    days: number;
    includeOverdue: boolean;
    customerId?: string;
    siteId?: string;
    deviceTypeId?: string;
    offset: number;
    size: number;
  },
) {
  const to = addDays(org.today, args.days);
  const rows = await tx<DeviceRow[]>`
    select ${DEVICE_COLUMNS(tx)} ${DEVICE_FROM(tx)}
     where d.organization_id = ${org.id} and d.deleted_at is null and d.status = 'active'
       and d.next_due_on <= ${to}
       ${args.includeOverdue ? tx`` : tx`and d.next_due_on >= ${org.today}`}
       ${args.customerId ? tx`and s.customer_id = ${args.customerId}` : tx``}
       ${args.siteId ? tx`and d.site_id = ${args.siteId}` : tx``}
       ${args.deviceTypeId ? tx`and d.device_type_id = ${args.deviceTypeId}` : tx``}
     order by d.next_due_on, s.name, d.label_number
     limit ${args.size + 1} offset ${args.offset}`;
  const result = page(rows.map((row) => deviceSummary(org, row)), args.offset, args.size);
  return plain({ today: org.today, until: to, ...result });
}

export async function listDevices(
  tx: Tx,
  org: Org,
  args: {
    query?: string;
    siteId?: string;
    customerId?: string;
    deviceTypeId?: string;
    status: "active" | "out_of_service" | "removed" | "any";
    dueState?: "overdue" | "soon" | "ok" | "never";
    offset: number;
    size: number;
  },
) {
  const soonTo = addDays(org.today, org.dueSoonDays);
  const label = args.query ? searchTerms(args.query).label : null;
  const due = {
    overdue: tx`and d.next_due_on < ${org.today}`,
    soon: tx`and d.next_due_on between ${org.today} and ${soonTo}`,
    ok: tx`and d.next_due_on > ${soonTo}`,
    never: tx`and d.next_due_on is null`,
  };
  const rows = await tx<DeviceRow[]>`
    select ${DEVICE_COLUMNS(tx)} ${DEVICE_FROM(tx)}
     where d.organization_id = ${org.id} and d.deleted_at is null
       ${args.status === "any" ? tx`` : tx`and d.status = ${args.status}`}
       ${args.siteId ? tx`and d.site_id = ${args.siteId}` : tx``}
       ${args.customerId ? tx`and s.customer_id = ${args.customerId}` : tx``}
       ${args.deviceTypeId ? tx`and d.device_type_id = ${args.deviceTypeId}` : tx``}
       ${args.dueState ? due[args.dueState] : tx``}
       ${
         args.query
           ? tx`and (${label !== null ? tx`d.label_number = ${label} or` : tx``}
                    d.serial_number ilike ${like(args.query)} or d.manufacturer ilike ${like(args.query)}
                    or d.model ilike ${like(args.query)} or l.name ilike ${like(args.query)})`
           : tx``
       }
     order by s.name, d.label_number
     limit ${args.size + 1} offset ${args.offset}`;
  return plain(page(rows.map((row) => deviceSummary(org, row)), args.offset, args.size));
}

export async function getDevice(tx: Tx, org: Org, args: { deviceId?: string; label?: string }) {
  const label = args.label ? searchTerms(args.label).label : null;
  if (!args.deviceId && label === null)
    throw new ToolError("invalid_input", "Give device_id or a label number such as 0012.");
  const [row] = await tx<(DeviceRow & {
    installed_on: string | null;
    manufacture_year: number | null;
    end_of_life_on: string | null;
    notes: string | null;
    attributes: Record<string, unknown> | null;
    custom_fields: { key: string; label: string }[] | null;
    interval_months: number;
  })[]>`
    select ${DEVICE_COLUMNS(tx)}, d.installed_on::text, d.manufacture_year, d.end_of_life_on::text,
           d.notes, d.attributes, t.custom_fields, t.inspection_interval_months as interval_months
      ${DEVICE_FROM(tx)}
     where d.organization_id = ${org.id} and d.deleted_at is null
       and ${args.deviceId ? tx`d.id = ${args.deviceId}` : tx`d.label_number = ${label}`}`;
  if (!row) throw new ToolError("not_found", "No such device in this company.");
  const checks = await tx`
    select i.id as inspection_id, it.outcome::text, it.skip_reason::text, it.notes,
           coalesce(it.original_checked_at, it.checked_at) as checked_at, m.display_name as checked_by
      from public.inspection_items it
      join public.inspections i on i.id = it.inspection_id
      left join public.memberships m on m.organization_id = it.organization_id
                                    and m.user_id = coalesce(it.original_checked_by, it.checked_by)
     where it.device_id = ${row.id} and it.organization_id = ${org.id} and it.outcome is not null
     order by coalesce(it.original_checked_at, it.checked_at) desc nulls last
     limit 10`;
  const defects = await tx<{ number: number }[]>`
    select f.id, f.number, f.description, f.severity::text, f.status::text, f.due_on::text, f.created_at
      from public.defects f
     where f.device_id = ${row.id} and f.organization_id = ${org.id}
     order by (f.status = 'resolved'), f.created_at desc
     limit 15`;
  const moves = await tx`
    select fs.name as from_site, ts.name as to_site, mv.from_location_name as from_location,
           mv.to_location_name as to_location, mv.note, mv.moved_at
      from public.device_moves mv
      left join public.sites fs on fs.id = mv.from_site_id
      left join public.sites ts on ts.id = mv.to_site_id
     where mv.device_id = ${row.id} and mv.organization_id = ${org.id}
     order by mv.moved_at desc limit 5`;
  const fields = row.custom_fields ?? [];
  return plain({
    ...deviceSummary(org, row),
    installed_on: row.installed_on,
    manufacture_year: row.manufacture_year,
    end_of_life_on: row.end_of_life_on,
    inspection_interval_months: row.interval_months,
    attributes: fields
      .map((field) => ({ label: field.label, value: row.attributes?.[field.key] ?? null }))
      .filter((field) => field.value !== null && field.value !== ""),
    notes: row.notes,
    recent_checks: checks,
    defects: defects.map((defect) => ({ ...defect, number: defectRef(defect.number) })),
    moves,
  });
}

// ---------- Sites and customers ----------

type SiteStatusRow = {
  site_id: string;
  name: string;
  address: string | null;
  customer_id: string;
  customer_name: string;
  status: string;
  devices: number;
  overdue: number;
  soon: number;
  never: number;
  defects_critical: number;
  defects_major: number;
  defects_minor: number;
  next_due: string | null;
};

const siteSummary = (row: SiteStatusRow) => ({
  id: row.site_id,
  name: row.name,
  address: row.address,
  customer: { id: row.customer_id, name: row.customer_name },
  status: row.status,
  devices: row.devices,
  overdue: row.overdue,
  due_soon: row.soon,
  never_inspected: row.never,
  open_defects: { critical: row.defects_critical, major: row.defects_major, minor: row.defects_minor },
  next_due_on: row.next_due,
});

/** Site states as on the map: critical (overdue or a critical defect), warning, ok, none (no devices). */
export const SITE_STATES = ["critical", "warning", "ok", "none"] as const;

export async function listSites(
  tx: Tx,
  org: Org,
  args: {
    query?: string;
    customerId?: string;
    status?: (typeof SITE_STATES)[number];
    offset: number;
    size: number;
  },
) {
  const rows = await tx<SiteStatusRow[]>`
    select st.site_id, st.name, st.address, st.customer_id, st.customer_name, st.status, st.devices,
           st.overdue, st.soon, st.never, st.defects_critical, st.defects_major, st.defects_minor,
           st.next_due::text as next_due
      from public.site_map_statuses(${args.customerId ?? null}, null, null) st
      join public.sites s on s.id = st.site_id
     where s.organization_id = ${org.id}
       ${args.status ? tx`and st.status = ${args.status}` : tx``}
       ${
         args.query
           ? tx`and (st.name ilike ${like(args.query)} or st.address ilike ${like(args.query)}
                    or st.customer_name ilike ${like(args.query)})`
           : tx``
       }
     order by case st.status when 'critical' then 0 when 'warning' then 1 when 'ok' then 2 else 3 end,
              st.name
     limit ${args.size + 1} offset ${args.offset}`;
  return plain(page(rows.map(siteSummary), args.offset, args.size));
}

export async function getSite(tx: Tx, org: Org, siteId: string) {
  const [site] = await tx<{ access_notes: string | null; notes: string | null }[]>`
    select s.access_notes, s.notes from public.sites s
     where s.id = ${siteId} and s.organization_id = ${org.id} and s.deleted_at is null`;
  if (!site) throw new ToolError("not_found", "No such building in this company.");
  const [status] = await tx<SiteStatusRow[]>`
    select st.site_id, st.name, st.address, st.customer_id, st.customer_name, st.status, st.devices,
           st.overdue, st.soon, st.never, st.defects_critical, st.defects_major, st.defects_minor,
           st.next_due::text as next_due
      from public.site_map_statuses(null, null, null) st where st.site_id = ${siteId}`;
  const types = await tx`
    select t.name as type, count(*)::int as devices,
           count(*) filter (where d.next_due_on < ${org.today})::int as overdue
      from public.devices d join public.device_types t on t.id = d.device_type_id
     where d.site_id = ${siteId} and d.organization_id = ${org.id}
       and d.deleted_at is null and d.status = 'active'
     group by t.name order by t.name`;
  const locations = await tx`
    select name from public.locations where site_id = ${siteId} and organization_id = ${org.id}
     order by sort_order, name`;
  const defects = await tx<{ number: number; device_label: number }[]>`
    select f.id, f.number, f.description, f.severity::text, f.status::text, f.due_on::text,
           d.label_number as device_label
      from public.defects f join public.devices d on d.id = f.device_id
     where d.site_id = ${siteId} and f.organization_id = ${org.id} and f.status <> 'resolved'
     order by case f.severity when 'critical' then 0 when 'major' then 1 else 2 end, f.created_at
     limit 20`;
  const inspections = await tx`
    select i.id, i.status::text, i.started_at, i.completed_at
      from public.inspections i
     where i.site_id = ${siteId} and i.organization_id = ${org.id}
     order by i.started_at desc limit 5`;
  const visits = await tx`
    select p.id, p.planned_on::text, p.note, m.display_name as technician
      from public.inspection_plans p
      left join public.memberships m on m.organization_id = p.organization_id and m.user_id = p.technician_id
     where p.site_id = ${siteId} and p.organization_id = ${org.id}
       and p.planned_on >= ${org.today} and p.inspection_id is null
     order by p.planned_on limit 10`;
  return plain({
    ...(status ? siteSummary(status) : { id: siteId }),
    access_notes: site.access_notes,
    notes: site.notes,
    locations: locations.map((row) => row.name as string),
    device_types: types,
    open_defects_list: defects.map((row) => ({
      ...row,
      number: defectRef(row.number),
      device_label: formatLabel(row.device_label),
    })),
    recent_inspections: inspections,
    planned_visits: visits,
  });
}

export async function listCustomers(tx: Tx, org: Org, args: { query?: string; offset: number; size: number }) {
  const rows = await tx`
    select c.id, c.name, c.company_id, c.contact_person, c.email, c.phone, c.is_sample,
           (select count(*) from public.sites s where s.customer_id = c.id and s.deleted_at is null)::int as sites
      from public.customers c
     where c.organization_id = ${org.id} and c.deleted_at is null
       ${
         args.query
           ? tx`and (c.name ilike ${like(args.query)} or c.company_id ilike ${like(args.query)}
                    or c.contact_person ilike ${like(args.query)})`
           : tx``
       }
     order by c.name limit ${args.size + 1} offset ${args.offset}`;
  return plain(page([...rows], args.offset, args.size));
}

export async function getCustomer(tx: Tx, org: Org, customerId: string) {
  const [customer] = await tx`
    select c.id, c.name, c.company_id, c.vat_id, c.contact_person, c.email, c.phone,
           c.billing_address, c.notes, c.is_sample
      from public.customers c
     where c.id = ${customerId} and c.organization_id = ${org.id} and c.deleted_at is null`;
  if (!customer) throw new ToolError("not_found", "No such customer in this company.");
  const sites = await tx<SiteStatusRow[]>`
    select st.site_id, st.name, st.address, st.customer_id, st.customer_name, st.status, st.devices,
           st.overdue, st.soon, st.never, st.defects_critical, st.defects_major, st.defects_minor,
           st.next_due::text as next_due
      from public.site_map_statuses(${customerId}, null, null) st
      join public.sites s on s.id = st.site_id
     where s.organization_id = ${org.id}
     order by st.name`;
  return plain({ ...customer, sites: sites.map(siteSummary) });
}

// ---------- Inspections ----------

export async function listInspections(
  tx: Tx,
  org: Org,
  args: {
    siteId?: string;
    customerId?: string;
    status?: "in_progress" | "completed";
    from?: IsoDate;
    to?: IsoDate;
    offset: number;
    size: number;
  },
) {
  const rows = await tx<
    { protocol_year: number | null; protocol_number: number | null; protocol_format: ProtocolNumberFormat | null }[]
  >`
    select i.id, i.status::text, i.started_at, i.completed_at, s.id as site_id, s.name as site_name,
           c.name as customer_name, m.display_name as started_by,
           count(it.id) filter (where it.outcome = 'passed')::int as passed,
           count(it.id) filter (where it.outcome = 'failed')::int as failed,
           count(it.id) filter (where it.outcome = 'not_checked')::int as not_checked,
           count(it.id) filter (where it.outcome is null)::int as pending,
           p.year as protocol_year, p.number as protocol_number, p.number_format as protocol_format,
           p.version as protocol_version
      from public.inspections i
      join public.sites s on s.id = i.site_id
      join public.customers c on c.id = s.customer_id
      left join public.memberships m on m.organization_id = i.organization_id and m.user_id = i.started_by
      left join public.inspection_items it on it.inspection_id = i.id
      left join public.protocols p on p.inspection_id = i.id and p.active
     where i.organization_id = ${org.id}
       ${args.siteId ? tx`and i.site_id = ${args.siteId}` : tx``}
       ${args.customerId ? tx`and s.customer_id = ${args.customerId}` : tx``}
       ${args.status ? tx`and i.status = ${args.status}` : tx``}
       ${args.from ? tx`and coalesce(i.completed_at, i.started_at)::date >= ${args.from}` : tx``}
       ${args.to ? tx`and coalesce(i.completed_at, i.started_at)::date <= ${args.to}` : tx``}
     group by i.id, s.id, c.name, m.display_name, p.year, p.number, p.number_format, p.version
     order by coalesce(i.completed_at, i.started_at) desc
     limit ${args.size + 1} offset ${args.offset}`;
  const items = rows.map(({ protocol_year, protocol_number, protocol_format, ...row }) => ({
    ...row,
    protocol:
      protocol_year && protocol_number
        ? protocolNumber(protocol_year, protocol_number, protocol_format ?? "year_number")
        : null,
  }));
  return plain(page(items, args.offset, args.size));
}

export async function getInspection(tx: Tx, org: Org, inspectionId: string) {
  const [inspection] = await tx`
    select i.id, i.status::text, i.started_at, i.completed_at, i.reopened_at, i.notes,
           i.customer_signer_name, i.customer_signed_at, s.id as site_id, s.name as site_name,
           c.id as customer_id, c.name as customer_name,
           ms.display_name as started_by, mc.display_name as completed_by
      from public.inspections i
      join public.sites s on s.id = i.site_id
      join public.customers c on c.id = s.customer_id
      left join public.memberships ms on ms.organization_id = i.organization_id and ms.user_id = i.started_by
      left join public.memberships mc on mc.organization_id = i.organization_id and mc.user_id = i.completed_by
     where i.id = ${inspectionId} and i.organization_id = ${org.id}`;
  if (!inspection) throw new ToolError("not_found", "No such inspection in this company.");
  // Scan positions and their verdicts are deliberately left out (part 31).
  const items = await tx<{ label_number: number; id: string }[]>`
    select it.id, d.label_number, t.name as type, l.name as location, it.outcome::text,
           it.skip_reason::text, it.notes, coalesce(it.original_checked_at, it.checked_at) as checked_at,
           m.display_name as checked_by
      from public.inspection_items it
      join public.devices d on d.id = it.device_id
      join public.device_types t on t.id = d.device_type_id
      left join public.locations l on l.id = d.location_id
      left join public.memberships m on m.organization_id = it.organization_id
                                    and m.user_id = coalesce(it.original_checked_by, it.checked_by)
     where it.inspection_id = ${inspectionId} and it.organization_id = ${org.id}
     order by d.label_number`;
  const findings = await tx<{ item_id: string }[]>`
    select a.item_id, ti.label as question, a.value_number, a.value_text, a.note, a.defect_severity::text
      from public.inspection_answers a
      join public.checklist_template_items ti on ti.id = a.template_item_id
      join public.inspection_items it on it.id = a.item_id
     where it.inspection_id = ${inspectionId} and a.organization_id = ${org.id}
       and (a.value_pass = false or a.note is not null)`;
  const defects = await tx<{ number: number }[]>`
    select f.id, f.number, f.description, f.severity::text, f.status::text
      from public.defects f
     where f.inspection_id = ${inspectionId} and f.organization_id = ${org.id}
     order by f.number`;
  const protocols = await tx<{ year: number; number: number; number_format: ProtocolNumberFormat }[]>`
    select year, number, number_format, version, active, generated_at
      from public.protocols where inspection_id = ${inspectionId} and organization_id = ${org.id}
     order by version desc`;
  return plain({
    ...inspection,
    devices: items.map(({ id, label_number, ...item }) => ({
      ...item,
      label: formatLabel(label_number),
      findings: findings
        .filter((finding) => finding.item_id === id)
        .map((finding) => Object.fromEntries(Object.entries(finding).filter(([key]) => key !== "item_id"))),
    })),
    defects_created: defects.map((defect) => ({ ...defect, number: defectRef(defect.number) })),
    protocol_versions: protocols.map(({ year, number, number_format, ...rest }) => ({
      number: protocolNumber(year, number, number_format),
      ...rest,
    })),
  });
}

export async function inspectionSummary(
  tx: Tx,
  org: Org,
  args: { from: IsoDate; to: IsoDate; customerId?: string; siteId?: string },
) {
  if (args.to < args.from) throw new ToolError("invalid_input", "'to' must not be before 'from'.");
  if (daysBetween(args.from, args.to) > 366)
    throw new ToolError("invalid_input", "The period can be at most a year; split it into shorter ones.");
  const scope = tx`
    i.organization_id = ${org.id} and i.status = 'completed'
    and (i.completed_at at time zone ${org.timezone})::date between ${args.from} and ${args.to}
    ${args.customerId ? tx`and s.customer_id = ${args.customerId}` : tx``}
    ${args.siteId ? tx`and i.site_id = ${args.siteId}` : tx``}`;
  const [totals] = await tx`
    select count(distinct i.id)::int as inspections, count(distinct i.site_id)::int as sites,
           count(it.id) filter (where it.outcome = 'passed')::int as passed,
           count(it.id) filter (where it.outcome = 'failed')::int as failed,
           count(it.id) filter (where it.outcome = 'not_checked')::int as not_checked
      from public.inspections i
      join public.sites s on s.id = i.site_id
      left join public.inspection_items it on it.inspection_id = i.id
     where ${scope}`;
  const [defects] = await tx`
    select count(*)::int as total,
           count(*) filter (where f.severity = 'critical')::int as critical,
           count(*) filter (where f.severity = 'major')::int as major,
           count(*) filter (where f.severity = 'minor')::int as minor,
           count(*) filter (where f.status = 'resolved')::int as resolved_since
      from public.defects f
      join public.inspections i on i.id = f.inspection_id
      join public.sites s on s.id = i.site_id
     where ${scope}`;
  const bySite = await tx`
    select s.id, s.name, c.name as customer, count(distinct i.id)::int as inspections,
           count(it.id) filter (where it.outcome = 'failed')::int as failed
      from public.inspections i
      join public.sites s on s.id = i.site_id
      join public.customers c on c.id = s.customer_id
      left join public.inspection_items it on it.inspection_id = i.id
     where ${scope}
     group by s.id, s.name, c.name order by s.name limit 100`;
  return plain({ from: args.from, to: args.to, totals, defects_found: defects, by_site: bySite });
}

// ---------- Defects ----------

export async function listDefects(
  tx: Tx,
  org: Org,
  member: { userId: string },
  args: {
    status: "open" | "resolved" | "all";
    severity?: "minor" | "major" | "critical";
    siteId?: string;
    customerId?: string;
    deviceId?: string;
    assignedToMe: boolean;
    pastDueOnly: boolean;
    offset: number;
    size: number;
  },
) {
  const rows = await tx<{ number: number; device_label: number }[]>`
    select f.id, f.number, f.description, f.severity::text, f.status::text, f.due_on::text,
           f.created_at, f.resolved_at, d.id as device_id, d.label_number as device_label,
           t.name as device_type, s.id as site_id, s.name as site_name, c.name as customer_name,
           m.display_name as assigned_to
      from public.defects f
      join public.devices d on d.id = f.device_id
      join public.device_types t on t.id = d.device_type_id
      join public.sites s on s.id = d.site_id
      join public.customers c on c.id = s.customer_id
      left join public.memberships m on m.organization_id = f.organization_id and m.user_id = f.assigned_to
     where f.organization_id = ${org.id}
       ${
         args.status === "open"
           ? tx`and f.status <> 'resolved'`
           : args.status === "resolved"
             ? tx`and f.status = 'resolved'`
             : tx``
       }
       ${args.severity ? tx`and f.severity = ${args.severity}` : tx``}
       ${args.siteId ? tx`and d.site_id = ${args.siteId}` : tx``}
       ${args.customerId ? tx`and s.customer_id = ${args.customerId}` : tx``}
       ${args.deviceId ? tx`and f.device_id = ${args.deviceId}` : tx``}
       ${args.assignedToMe ? tx`and f.assigned_to = ${member.userId}` : tx``}
       ${args.pastDueOnly ? tx`and f.due_on < ${org.today} and f.status <> 'resolved'` : tx``}
     order by case f.severity when 'critical' then 0 when 'major' then 1 else 2 end,
              f.due_on nulls last, f.created_at
     limit ${args.size + 1} offset ${args.offset}`;
  const items = rows.map((row) => ({
    ...row,
    number: defectRef(row.number),
    device_label: formatLabel(row.device_label),
  }));
  return plain(page(items, args.offset, args.size));
}

export async function getDefect(tx: Tx, org: Org, args: { defectId?: string; number?: string }) {
  const parsed = args.number ? searchTerms(args.number).defect ?? searchTerms(args.number).label : null;
  if (!args.defectId && parsed === null)
    throw new ToolError("invalid_input", "Give defect_id or a defect number such as D-0012.");
  const [defect] = await tx<{ id: string; number: number; device_label: number }[]>`
    select f.id, f.number, f.description, f.severity::text, f.status::text, f.due_on::text,
           f.created_at, f.resolved_at, f.resolution_note, f.inspection_id,
           d.id as device_id, d.label_number as device_label, t.name as device_type,
           s.id as site_id, s.name as site_name, c.name as customer_name,
           ma.display_name as assigned_to, mc.display_name as created_by
      from public.defects f
      join public.devices d on d.id = f.device_id
      join public.device_types t on t.id = d.device_type_id
      join public.sites s on s.id = d.site_id
      join public.customers c on c.id = s.customer_id
      left join public.memberships ma on ma.organization_id = f.organization_id and ma.user_id = f.assigned_to
      left join public.memberships mc on mc.organization_id = f.organization_id and mc.user_id = f.created_by
     where f.organization_id = ${org.id}
       and ${args.defectId ? tx`f.id = ${args.defectId}` : tx`f.number = ${parsed}`}`;
  if (!defect) throw new ToolError("not_found", "No such defect in this company.");
  const events = await tx`
    select e.kind::text, e.from_value, e.to_value, e.note, e.created_at, m.display_name as by
      from public.defect_events e
      left join public.memberships m on m.organization_id = e.organization_id and m.user_id = e.actor
     where e.defect_id = ${defect.id} and e.organization_id = ${org.id}
     order by e.created_at`;
  const [photos] = await tx`
    select count(*)::int as count from public.defect_photos
     where defect_id = ${defect.id} and organization_id = ${org.id}`;
  return plain({
    ...defect,
    number: defectRef(defect.number),
    device_label: formatLabel(defect.device_label),
    photos: photos?.count ?? 0,
    history: events,
  });
}

// ---------- Calendar, team, types ----------

export async function calendar(
  tx: Tx,
  org: Org,
  args: { from: IsoDate; to: IsoDate; technicianId?: string },
) {
  if (args.to < args.from) throw new ToolError("invalid_input", "'to' must not be before 'from'.");
  if (daysBetween(args.from, args.to) > 92)
    throw new ToolError("invalid_input", "The calendar can show at most three months at a time.");
  const visits = await tx`
    select p.id, p.planned_on::text, p.note, s.id as site_id, s.name as site_name,
           c.name as customer_name, p.technician_id, m.display_name as technician,
           i.status::text as inspection_status, rs.route_id
      from public.inspection_plans p
      join public.sites s on s.id = p.site_id
      join public.customers c on c.id = s.customer_id
      left join public.memberships m on m.organization_id = p.organization_id and m.user_id = p.technician_id
      left join public.inspections i on i.id = p.inspection_id
      left join public.route_plan_stops rs on rs.inspection_plan_id = p.id
     where p.organization_id = ${org.id} and p.planned_on between ${args.from} and ${args.to}
       ${args.technicianId ? tx`and p.technician_id = ${args.technicianId}` : tx``}
     order by p.planned_on, s.name
     limit 500`;
  return plain({ from: args.from, to: args.to, visits });
}

export async function members(tx: Tx, org: Org) {
  const rows = await tx`
    select user_id as id, display_name as name, role::text from public.memberships
     where organization_id = ${org.id} order by display_name`;
  return plain({ members: rows });
}

export async function deviceTypes(tx: Tx, org: Org) {
  const types = await tx<{ id: string }[]>`
    select t.id, t.name, t.inspection_interval_months, t.active, t.custom_fields
      from public.device_types t where t.organization_id = ${org.id} order by t.name`;
  const items = await tx<{ device_type_id: string }[]>`
    select ct.device_type_id, ti.label, ti.item_type::text as type, ti.required, ti.photo_required
      from public.checklist_templates ct
      join public.checklist_template_items ti on ti.template_id = ct.id
     where ct.organization_id = ${org.id} and ct.active
     order by ti.sort_order`;
  return plain({
    device_types: types.map((type) => ({
      ...type,
      checklist: items
        .filter((item) => item.device_type_id === type.id)
        .map((item) => Object.fromEntries(Object.entries(item).filter(([key]) => key !== "device_type_id"))),
    })),
  });
}

// ---------- Search ----------

export async function search(tx: Tx, org: Org, query: string) {
  const terms = searchTerms(query);
  const hits: { kind: string; id: string; title: string; subtitle: string | null }[] = [];
  if (terms.label !== null) {
    const rows = await tx`
      select d.id, d.label_number, t.name as type, s.name as site from public.devices d
        join public.device_types t on t.id = d.device_type_id join public.sites s on s.id = d.site_id
       where d.organization_id = ${org.id} and d.deleted_at is null and d.label_number = ${terms.label}`;
    for (const row of rows)
      hits.push({ kind: "device", id: row.id, title: `${formatLabel(row.label_number)} ${row.type}`, subtitle: row.site });
  }
  if (terms.defect !== null) {
    const rows = await tx`
      select id, number, description from public.defects
       where organization_id = ${org.id} and number = ${terms.defect}`;
    for (const row of rows)
      hits.push({ kind: "defect", id: row.id, title: defectRef(row.number), subtitle: row.description });
  }
  if (terms.protocol) {
    const rows = await tx`
      select p.inspection_id, p.year, p.number, p.number_format, s.name as site from public.protocols p
        join public.inspections i on i.id = p.inspection_id join public.sites s on s.id = i.site_id
       where p.organization_id = ${org.id} and p.active
         and p.year = ${terms.protocol.year} and p.number = ${terms.protocol.number}`;
    for (const row of rows)
      hits.push({
        kind: "inspection",
        id: row.inspection_id,
        title: protocolNumber(row.year, row.number, row.number_format),
        subtitle: row.site,
      });
  }
  if (terms.text) {
    const pattern = like(terms.text);
    const customers = await tx`
      select id, name, company_id from public.customers
       where organization_id = ${org.id} and deleted_at is null
         and (name ilike ${pattern} or company_id ilike ${pattern} or contact_person ilike ${pattern})
       order by name limit 5`;
    for (const row of customers) hits.push({ kind: "customer", id: row.id, title: row.name, subtitle: row.company_id });
    const sites = await tx`
      select s.id, s.name, s.address from public.sites s
       where s.organization_id = ${org.id} and s.deleted_at is null
         and (s.name ilike ${pattern} or s.address ilike ${pattern})
       order by s.name limit 5`;
    for (const row of sites) hits.push({ kind: "site", id: row.id, title: row.name, subtitle: row.address });
    const devices = await tx`
      select d.id, d.label_number, t.name as type, s.name as site from public.devices d
        join public.device_types t on t.id = d.device_type_id join public.sites s on s.id = d.site_id
       where d.organization_id = ${org.id} and d.deleted_at is null
         and (d.serial_number ilike ${pattern} or d.manufacturer ilike ${pattern} or d.model ilike ${pattern})
       order by d.label_number limit 5`;
    for (const row of devices)
      hits.push({ kind: "device", id: row.id, title: `${formatLabel(row.label_number)} ${row.type}`, subtitle: row.site });
    const defects = await tx`
      select id, number, description from public.defects
       where organization_id = ${org.id} and description ilike ${pattern}
       order by created_at desc limit 5`;
    for (const row of defects)
      hits.push({ kind: "defect", id: row.id, title: defectRef(row.number), subtitle: row.description });
  }
  return plain({ query, hits });
}
