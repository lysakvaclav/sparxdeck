import "server-only";

import { memberNames } from "@/lib/inspection-data";
import { routeDistance, routeState } from "@/lib/route-plans";
import type { Coordinates } from "@/lib/scan-location";
import type { SiteMapRow } from "@/lib/site-map";
import type { RouteStartKind } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

// Loading routes for their pages (part 23). Row Level Security decides what
// the caller sees: owners and admins every route, a technician their own.

export type RouteListRow = {
  id: string;
  plannedOn: string;
  name: string;
  technicianId: string | null;
  technicianName: string | null;
  stops: number;
  visited: number;
  /** Straight-line metres, null while no stop has a point. */
  distance: number | null;
  state: ReturnType<typeof routeState>;
};

export async function loadRouteList(
  organizationId: string,
  options: { today: string; when: "upcoming" | "past"; technician?: string },
): Promise<RouteListRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("route_plans")
    .select(
      "id, planned_on, name, technician_id, start_latitude, start_longitude, return_to_start, created_at, route_plan_stops(position, visited_at, site:sites(latitude, longitude))",
    )
    .eq("organization_id", organizationId);
  query =
    options.when === "past"
      ? query.lt("planned_on", options.today).order("planned_on", { ascending: false })
      : query.gte("planned_on", options.today).order("planned_on", { ascending: true });
  if (options.technician) query = query.eq("technician_id", options.technician);
  const [{ data }, names] = await Promise.all([
    query.order("created_at").limit(200),
    memberNames(organizationId),
  ]);
  return (data ?? []).map((row) => {
    const stops = [...(row.route_plan_stops ?? [])].sort((a, b) => a.position - b.position);
    const points = stops.map((stop) =>
      stop.site?.latitude != null && stop.site.longitude != null
        ? { latitude: stop.site.latitude, longitude: stop.site.longitude }
        : null,
    );
    const start =
      row.start_latitude != null && row.start_longitude != null
        ? { latitude: row.start_latitude, longitude: row.start_longitude }
        : null;
    return {
      id: row.id,
      plannedOn: row.planned_on,
      name: row.name,
      technicianId: row.technician_id,
      technicianName: row.technician_id ? (names.get(row.technician_id) ?? null) : null,
      stops: stops.length,
      visited: stops.filter((stop) => stop.visited_at).length,
      distance: points.some(Boolean) ? routeDistance(start, points, row.return_to_start) : null,
      state: routeState(stops),
    };
  });
}

export type RouteStopView = {
  id: string;
  siteId: string;
  name: string;
  address: string | null;
  customerName: string | null;
  point: Coordinates | null;
  minutes: number | null;
  note: string | null;
  visitedAt: string | null;
  /** From the map's state of the building (part 21); null for a deleted building. */
  status: SiteMapRow["status"] | null;
  nextDue: string | null;
  devices: number;
};

export type RouteView = {
  id: string;
  plannedOn: string;
  name: string;
  technicianId: string | null;
  startKind: RouteStartKind;
  start: Coordinates | null;
  returnToStart: boolean;
  lockFirst: boolean;
  lockLast: boolean;
  stops: RouteStopView[];
  /** Every building of the company, as the map of buildings has them (adding stops, the map). */
  sites: SiteMapRow[];
  /** Points the start can be copied from (the home only when the caller may see it). */
  company: Coordinates | null;
  home: Coordinates | null;
};

const pointOf = (latitude: number | null, longitude: number | null) =>
  latitude != null && longitude != null ? { latitude, longitude } : null;

export async function loadRoute(
  organizationId: string,
  id: string,
  company: Coordinates | null,
): Promise<RouteView | null> {
  const supabase = await createClient();
  const { data: route } = await supabase
    .from("route_plans")
    .select(
      "id, planned_on, name, technician_id, start_kind, start_latitude, start_longitude, return_to_start, lock_first, lock_last",
    )
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!route) return null;

  const [{ data: stops }, { data: sites }, { data: home }] = await Promise.all([
    supabase
      .from("route_plan_stops")
      .select("id, site_id, position, minutes, note, visited_at")
      .eq("route_id", id)
      .order("position"),
    supabase.rpc("site_map_statuses", {}),
    route.technician_id
      ? supabase
          .from("member_homes")
          .select("latitude, longitude")
          .eq("organization_id", organizationId)
          .eq("user_id", route.technician_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const bySite = new Map((sites ?? []).map((site) => [site.site_id, site]));
  // A building deleted after its visit was carried out isn't on the map any more.
  const missing = (stops ?? []).filter((stop) => !bySite.has(stop.site_id)).map((stop) => stop.site_id);
  const { data: deleted } = missing.length
    ? await supabase
        .from("sites")
        .select("id, name, address, latitude, longitude, customer:customers(name)")
        .in("id", missing)
    : { data: [] };
  const deletedById = new Map((deleted ?? []).map((site) => [site.id, site]));

  return {
    id: route.id,
    plannedOn: route.planned_on,
    name: route.name,
    technicianId: route.technician_id,
    startKind: route.start_kind,
    start: pointOf(route.start_latitude, route.start_longitude),
    returnToStart: route.return_to_start,
    lockFirst: route.lock_first,
    lockLast: route.lock_last,
    stops: (stops ?? []).map((stop) => {
      const site = bySite.get(stop.site_id);
      const gone = deletedById.get(stop.site_id);
      return {
        id: stop.id,
        siteId: stop.site_id,
        name: site?.name ?? gone?.name ?? "—",
        address: site?.address ?? gone?.address ?? null,
        customerName: site?.customer_name ?? gone?.customer?.name ?? null,
        point: site
          ? pointOf(site.latitude, site.longitude)
          : pointOf(gone?.latitude ?? null, gone?.longitude ?? null),
        minutes: stop.minutes,
        note: stop.note,
        visitedAt: stop.visited_at,
        status: site?.status ?? null,
        nextDue: site?.next_due ?? null,
        devices: site?.devices ?? 0,
      };
    }),
    sites: sites ?? [],
    company,
    home: home ? { latitude: home.latitude, longitude: home.longitude } : null,
  };
}
