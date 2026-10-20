import type { SupabaseClient } from "@supabase/supabase-js";
import { DEVICE_STATUSES, labelQuery } from "@/lib/devices";
import { DUE_STATES, dueWindow, type DueState, type IsoDate } from "@/lib/due";
import { HORIZONS, horizonWindow } from "@/lib/due-plan";
import { ilikeAny } from "@/lib/search";
import type { Database, DeviceStatus } from "@/lib/supabase/database.types";
import { idSchema } from "@/lib/validation";

// The device list's search, filters and order, read from the URL. The list
// page and its CSV export share them, so the export is exactly what is listed.

export const DEVICE_SORTS = ["label", "due"] as const;
export type DeviceSort = (typeof DEVICE_SORTS)[number];

/** "30d": coming due in the next 30 days (from the dashboard's overview). */
export const HORIZON_FILTERS = HORIZONS.map((days) => `${days}d` as const);

export type DeviceFilterValues = {
  customer?: string;
  site?: string;
  location?: string;
  type?: string;
  status?: string;
  due?: string;
};

export type DeviceListParams = { q: string; sort: DeviceSort; filters: DeviceFilterValues };

type Params = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
const validId = (value: string | undefined) =>
  value && idSchema.safeParse(value).success ? value : undefined;
function oneOf<T extends string>(options: readonly T[], value: string | undefined) {
  return options.includes(value as T) ? (value as T) : undefined;
}

export function readDeviceListParams(params: Params): DeviceListParams {
  const location = first(params.location);
  const filters: DeviceFilterValues = {
    customer: validId(first(params.customer)),
    site: validId(first(params.site)),
    location: location === "none" ? "none" : validId(location),
    type: validId(first(params.type)),
    status: oneOf(DEVICE_STATUSES, first(params.status)),
    due: oneOf([...DUE_STATES, ...HORIZON_FILTERS], first(params.due)),
  };
  // A location only makes sense within its building.
  if (!filters.site) filters.location = undefined;
  return {
    q: first(params.q)?.trim().slice(0, 100) ?? "",
    sort: oneOf(DEVICE_SORTS, first(params.sort)) ?? "label",
    filters,
  };
}

/** The list's URL parameters again (for links that keep the list as it is). */
export function deviceListSearch(list: DeviceListParams): string {
  const search = new URLSearchParams();
  if (list.q) search.set("q", list.q);
  if (list.sort !== "label") search.set("sort", list.sort);
  for (const [key, value] of Object.entries(list.filters)) if (value) search.set(key, value);
  return search.toString();
}

/** What the list and its export show of a device (one select keeps the types simple). */
const DEVICE_LIST_COLUMNS =
  "id, label_number, serial_number, manufacturer, model, manufacture_year, installed_on, status, last_inspection_on, next_due_on, end_of_life_on, attributes, notes, public_token, site:sites!inner(id, name, customer_id, customer:customers(name)), location:locations(name), type:device_types(name, code)";

/** The organization's devices as the list shows them, filtered and in order. */
export function deviceListQuery(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  list: DeviceListParams,
  dates: { today: IsoDate; soonDays: number },
  options?: { count: "exact" },
) {
  const { filters } = list;
  let query = supabase
    .from("devices")
    .select(DEVICE_LIST_COLUMNS, options)
    .eq("organization_id", organizationId)
    .is("deleted_at", null);
  if (filters.customer) query = query.eq("site.customer_id", filters.customer);
  if (filters.site) query = query.eq("site_id", filters.site);
  if (filters.location === "none") query = query.is("location_id", null);
  else if (filters.location) query = query.eq("location_id", filters.location);
  if (filters.type) query = query.eq("device_type_id", filters.type);
  if (filters.status) query = query.eq("status", filters.status as DeviceStatus);
  const horizon = HORIZONS.find((days) => filters.due === `${days}d`);
  if (horizon) {
    // Coming due within the horizon (from today; overdue ones have their own filter).
    const window = horizonWindow(dates.today, horizon);
    query = query
      .eq("status", "active")
      .gte("next_due_on", window.from)
      .lte("next_due_on", window.to);
  } else if (filters.due) {
    // Due states apply to active devices only.
    query = query.eq("status", "active");
    const window = dueWindow(filters.due as DueState, dates.today, dates.soonDays);
    if (window.kind === "before") query = query.lt("next_due_on", window.date);
    if (window.kind === "between")
      query = query.gte("next_due_on", window.from).lte("next_due_on", window.to);
    if (window.kind === "after") query = query.gt("next_due_on", window.date);
    if (window.kind === "none") query = query.is("next_due_on", null);
  }
  const label = labelQuery(list.q);
  const search = [
    ilikeAny(["serial_number", "manufacturer", "model"], list.q),
    label ? `label_number.eq.${label}` : null,
  ]
    .filter(Boolean)
    .join(",");
  if (search) query = query.or(search);
  return list.sort === "due"
    ? query.order("next_due_on", { ascending: true, nullsFirst: false })
    : query.order("label_number", { ascending: true });
}
