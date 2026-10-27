import type { Database } from "@/lib/supabase/database.types";
import { idSchema } from "@/lib/validation";

// The map of buildings (part 21). The database decides each building's state
// (site_map_statuses in 20261028090000_site_map.sql); this mirrors the rule for
// tests and turns the rows into what the list and the map draw. Pure.

export type SiteMapRow = Database["public"]["Functions"]["site_map_statuses"]["Returns"][number];

/** Worst first: the order of the list, of the legend and of a cluster's colour. */
export const SITE_STATUSES = ["critical", "warning", "ok", "none"] as const;
export type SiteStatus = (typeof SITE_STATUSES)[number];

export type SiteCounts = {
  devices: number;
  overdue: number;
  soon: number;
  never: number;
  defects_critical: number;
  defects_major: number;
  defects_minor: number;
};

/** The state of a building from its counts (as the database's CASE). */
export function siteStatus(counts: SiteCounts): SiteStatus {
  if (counts.devices === 0) return "none";
  if (counts.overdue > 0 || counts.defects_critical > 0) return "critical";
  if (
    counts.soon > 0 ||
    counts.never > 0 ||
    counts.defects_major > 0 ||
    counts.defects_minor > 0
  )
    return "warning";
  return "ok";
}

export function statusRank(status: SiteStatus): number {
  return SITE_STATUSES.indexOf(status);
}

/** The most urgent of several states (a cluster is as urgent as its worst building). */
export function worstStatus(states: Iterable<SiteStatus>): SiteStatus | null {
  let worst: number | null = null;
  for (const state of states) {
    const rank = statusRank(state);
    if (worst === null || rank < worst) worst = rank;
  }
  return worst === null ? null : SITE_STATUSES[worst]!;
}

/** Most urgent first; then more overdue devices, the nearest due date, the name. */
export function sortSites(rows: readonly SiteMapRow[], locale: string): SiteMapRow[] {
  const collator = new Intl.Collator(locale);
  return [...rows].sort(
    (a, b) =>
      statusRank(a.status) - statusRank(b.status) ||
      b.overdue - a.overdue ||
      (a.next_due ?? "9999").localeCompare(b.next_due ?? "9999") ||
      collator.compare(a.name, b.name),
  );
}

export type MapFilters = {
  customer?: string;
  type?: string;
  technician?: string;
  status?: SiteStatus;
};

type Params = Record<string, string | string[] | undefined>;

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const id = (value: string | string[] | undefined) => {
  const parsed = idSchema.safeParse(one(value));
  return parsed.success ? parsed.data : undefined;
};

/** Filters from the address (ids checked, unknown states ignored). */
export function readMapFilters(params: Params): MapFilters {
  const status = one(params.status);
  return {
    customer: id(params.customer),
    type: id(params.type),
    technician: id(params.technician),
    status: SITE_STATUSES.includes(status as SiteStatus) ? (status as SiteStatus) : undefined,
  };
}

/** The address of the map with these filters (empty ones left out). */
export function mapHref(filters: MapFilters): string {
  const query = new URLSearchParams();
  for (const key of ["customer", "type", "technician", "status"] as const) {
    const value = filters[key];
    if (value) query.set(key, value);
  }
  const text = query.toString();
  return text ? `/map?${text}` : "/map";
}

export type SitePoint = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: { id: string; status: SiteStatus; rank: number };
};

/** Buildings with a point, as GeoJSON for the map (longitude first). */
export function sitePoints(rows: readonly SiteMapRow[]): {
  type: "FeatureCollection";
  features: SitePoint[];
} {
  return {
    type: "FeatureCollection",
    features: rows.flatMap((row) =>
      row.latitude === null || row.longitude === null
        ? []
        : [
            {
              type: "Feature" as const,
              geometry: { type: "Point" as const, coordinates: [row.longitude, row.latitude] },
              properties: { id: row.site_id, status: row.status, rank: statusRank(row.status) },
            },
          ],
    ),
  };
}

/** [west, south, east, north] around the buildings with a point; null without any. */
export function pointsBounds(
  rows: readonly SiteMapRow[],
): [number, number, number, number] | null {
  let bounds: [number, number, number, number] | null = null;
  for (const row of rows) {
    if (row.latitude === null || row.longitude === null) continue;
    if (!bounds) bounds = [row.longitude, row.latitude, row.longitude, row.latitude];
    else {
      bounds[0] = Math.min(bounds[0], row.longitude);
      bounds[1] = Math.min(bounds[1], row.latitude);
      bounds[2] = Math.max(bounds[2], row.longitude);
      bounds[3] = Math.max(bounds[3], row.latitude);
    }
  }
  return bounds;
}

/** Lines of latitude and longitude every `step` degrees, for orientation without a base map. */
export function graticule(step = 1): {
  type: "FeatureCollection";
  features: { type: "Feature"; geometry: { type: "LineString"; coordinates: number[][] }; properties: object }[];
} {
  const features: ReturnType<typeof graticule>["features"] = [];
  for (let lng = -180; lng <= 180; lng += step)
    features.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates: [[lng, -85], [lng, 85]] },
      properties: {},
    });
  for (let lat = -80; lat <= 80; lat += step) {
    const coordinates: number[][] = [];
    for (let lng = -180; lng <= 180; lng += 10) coordinates.push([lng, lat]);
    features.push({ type: "Feature", geometry: { type: "LineString", coordinates }, properties: {} });
  }
  return { type: "FeatureCollection", features };
}
