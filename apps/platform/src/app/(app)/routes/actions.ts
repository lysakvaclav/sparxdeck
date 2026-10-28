"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActiveMembership, requireManager } from "@/lib/auth";
import { databaseErrorCode, zodFieldErrors, type ActionResult } from "@/lib/errors";
import { ROUTE_MAX_STOPS } from "@/lib/route-plans";
import { parseCoordinates } from "@/lib/scan-location";
import { createClient } from "@/lib/supabase/server";
import {
  idSchema,
  pointSchema,
  routeOptionsSchema,
  routeSchema,
  routeStartSchema,
  routeStopSchema,
} from "@/lib/validation";

// Routes for technicians (part 23). Owners and admins plan anyone's routes, a
// technician their own; the database checks it (RLS and the route functions).
// Every stop is a visit in the calendar too, so the whole app is revalidated.

function revalidateRoutes() {
  revalidatePath("/", "layout");
}

const idsSchema = z.array(idSchema).min(1).max(ROUTE_MAX_STOPS * 2);

export async function createRoute(input: unknown): Promise<ActionResult<{ id: string }>> {
  const active = await getActiveMembership();
  if (!active) return { ok: false, error: "forbidden" };
  const parsed = routeSchema.safeParse(input);
  if (!parsed.success) return zodFieldErrors(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_route_plan", {
    p_organization: active.organization.id,
    p_planned_on: parsed.data.plannedOn,
    p_technician: parsed.data.technicianId,
    p_name: parsed.data.name ?? "",
  });
  if (error || !data) {
    const code = databaseErrorCode(error);
    return code === "memberNotFound" || code === "forbidden"
      ? { ok: false, error: code, fieldErrors: { technicianId: code } }
      : { ok: false, error: code };
  }
  revalidateRoutes();
  return { ok: true, data: { id: data } };
}

/** The day, technician and name. Visits not carried out yet move with the route. */
export async function updateRoute(id: string, input: unknown): Promise<ActionResult> {
  const active = await getActiveMembership();
  if (!active) return { ok: false, error: "forbidden" };
  if (!idSchema.safeParse(id).success) return { ok: false, error: "notFound" };
  const parsed = routeSchema.safeParse(input);
  if (!parsed.success) return zodFieldErrors(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_route_plan", {
    p_route: id,
    p_planned_on: parsed.data.plannedOn,
    p_technician: parsed.data.technicianId,
  });
  if (error) {
    const code = databaseErrorCode(error);
    return code === "memberNotFound" || code === "forbidden"
      ? { ok: false, error: code, fieldErrors: { technicianId: code } }
      : { ok: false, error: code };
  }
  const { data, error: named } = await supabase
    .from("route_plans")
    .update({ name: parsed.data.name ?? "" })
    .eq("id", id)
    .select("id");
  if (named) return { ok: false, error: databaseErrorCode(named) };
  if (!data?.length) return { ok: false, error: "notFound" };
  revalidateRoutes();
  return { ok: true };
}

export async function deleteRoute(id: string): Promise<ActionResult> {
  const active = await getActiveMembership();
  if (!active) return { ok: false, error: "forbidden" };
  if (!idSchema.safeParse(id).success) return { ok: false, error: "notFound" };
  const supabase = await createClient();
  const { data, error } = await supabase.from("route_plans").delete().eq("id", id).select("id");
  if (error) return { ok: false, error: databaseErrorCode(error) };
  if (!data?.length) return { ok: false, error: "notFound" };
  revalidateRoutes();
  return { ok: true };
}

/**
 * Where the route starts. The company's seat and the technician's home are
 * copied from where they are kept; "here" and "custom" bring their point.
 */
export async function setRouteStart(id: string, input: unknown): Promise<ActionResult> {
  const active = await getActiveMembership();
  if (!active) return { ok: false, error: "forbidden" };
  if (!idSchema.safeParse(id).success) return { ok: false, error: "notFound" };
  const parsed = routeStartSchema.safeParse(input);
  if (!parsed.success) return zodFieldErrors(parsed.error);

  const supabase = await createClient();
  const { data: route } = await supabase
    .from("route_plans")
    .select("id, organization_id, technician_id")
    .eq("id", id)
    .maybeSingle();
  if (!route) return { ok: false, error: "notFound" };

  let point: { latitude: number; longitude: number } | null = null;
  const start = parsed.data;
  if (start.kind === "company") {
    const { data } = await supabase
      .from("organizations")
      .select("base_latitude, base_longitude")
      .eq("id", route.organization_id)
      .single();
    if (data?.base_latitude != null && data.base_longitude != null)
      point = { latitude: data.base_latitude, longitude: data.base_longitude };
  } else if (start.kind === "home") {
    // Visible to the technician and to owners and admins only (RLS).
    const { data } = route.technician_id
      ? await supabase
          .from("member_homes")
          .select("latitude, longitude")
          .eq("organization_id", route.organization_id)
          .eq("user_id", route.technician_id)
          .maybeSingle()
      : { data: null };
    if (data) point = { latitude: data.latitude, longitude: data.longitude };
  } else if (start.kind === "here" || start.kind === "custom") {
    point = parseCoordinates(start.coordinates);
  }
  if (start.kind !== "none" && !point)
    return { ok: false, error: "invalidCoordinates", fieldErrors: { coordinates: "invalidCoordinates" } };

  const { data, error } = await supabase
    .from("route_plans")
    .update({
      start_kind: start.kind,
      start_latitude: point?.latitude ?? null,
      start_longitude: point?.longitude ?? null,
    })
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, error: databaseErrorCode(error) };
  if (!data?.length) return { ok: false, error: "notFound" };
  revalidateRoutes();
  return { ok: true };
}

export async function setRouteOptions(id: string, input: unknown): Promise<ActionResult> {
  const active = await getActiveMembership();
  if (!active) return { ok: false, error: "forbidden" };
  if (!idSchema.safeParse(id).success) return { ok: false, error: "notFound" };
  const parsed = routeOptionsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "unexpected" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("route_plans")
    .update({
      return_to_start: parsed.data.returnToStart,
      lock_first: parsed.data.lockFirst,
      lock_last: parsed.data.lockLast,
    })
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, error: databaseErrorCode(error) };
  if (!data?.length) return { ok: false, error: "notFound" };
  revalidateRoutes();
  return { ok: true };
}

/** Buildings appended in this order; ones already in the route are skipped. */
export async function addRouteStops(id: string, siteIds: unknown): Promise<ActionResult<{ added: number }>> {
  const active = await getActiveMembership();
  if (!active) return { ok: false, error: "forbidden" };
  if (!idSchema.safeParse(id).success) return { ok: false, error: "notFound" };
  const parsed = idsSchema.safeParse(siteIds);
  if (!parsed.success) return { ok: false, error: "notFound" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_route_stops", { p_route: id, p_sites: parsed.data });
  if (error) return { ok: false, error: databaseErrorCode(error) };
  revalidateRoutes();
  return { ok: true, data: { added: data ?? 0 } };
}

export async function removeRouteStop(stopId: string): Promise<ActionResult> {
  const active = await getActiveMembership();
  if (!active) return { ok: false, error: "forbidden" };
  if (!idSchema.safeParse(stopId).success) return { ok: false, error: "notFound" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_route_stop", { p_stop: stopId });
  if (error) return { ok: false, error: databaseErrorCode(error) };
  revalidateRoutes();
  return { ok: true };
}

/** The whole order, first to last (a stale one is routeChanged). */
export async function reorderRouteStops(id: string, stopIds: unknown): Promise<ActionResult> {
  const active = await getActiveMembership();
  if (!active) return { ok: false, error: "forbidden" };
  if (!idSchema.safeParse(id).success) return { ok: false, error: "notFound" };
  const parsed = idsSchema.safeParse(stopIds);
  if (!parsed.success) return { ok: false, error: "routeChanged" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder_route_stops", { p_route: id, p_stops: parsed.data });
  if (error) return { ok: false, error: databaseErrorCode(error) };
  revalidateRoutes();
  return { ok: true };
}

export async function setStopVisited(stopId: string, visited: boolean): Promise<ActionResult> {
  const active = await getActiveMembership();
  if (!active) return { ok: false, error: "forbidden" };
  if (!idSchema.safeParse(stopId).success) return { ok: false, error: "notFound" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_route_stop_visited", {
    p_stop: stopId,
    p_visited: visited === true,
  });
  if (error) return { ok: false, error: databaseErrorCode(error) };
  revalidateRoutes();
  return { ok: true };
}

/** Minutes on site and a note. */
export async function updateRouteStop(stopId: string, input: unknown): Promise<ActionResult> {
  const active = await getActiveMembership();
  if (!active) return { ok: false, error: "forbidden" };
  if (!idSchema.safeParse(stopId).success) return { ok: false, error: "notFound" };
  const parsed = routeStopSchema.safeParse(input);
  if (!parsed.success) return zodFieldErrors(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("route_plan_stops")
    .update({
      minutes: parsed.data.minutes === "" ? null : parsed.data.minutes,
      note: parsed.data.note,
    })
    .eq("id", stopId)
    .select("id");
  if (error) return { ok: false, error: databaseErrorCode(error) };
  if (!data?.length) return { ok: false, error: "notFound" };
  revalidateRoutes();
  return { ok: true };
}

/** The company's seat, where routes start by default (owners and admins). */
export async function setCompanyStart(input: unknown): Promise<ActionResult> {
  const active = await requireManager();
  if (!active) return { ok: false, error: "forbidden" };
  const parsed = pointSchema.safeParse(input);
  if (!parsed.success) return zodFieldErrors(parsed.error);
  const point = parsed.data.coordinates ? parseCoordinates(parsed.data.coordinates) : null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .update({ base_latitude: point?.latitude ?? null, base_longitude: point?.longitude ?? null })
    .eq("id", active.organization.id)
    .select("id");
  if (error) return { ok: false, error: databaseErrorCode(error) };
  if (!data?.length) return { ok: false, error: "forbidden" };
  revalidateRoutes();
  return { ok: true };
}

/**
 * The member's own home, where their routes start when it is set. Colleagues
 * don't see it; owners and admins do (they plan routes from it).
 */
export async function setMyHome(input: unknown): Promise<ActionResult> {
  const active = await getActiveMembership();
  if (!active) return { ok: false, error: "forbidden" };
  const parsed = pointSchema.safeParse(input);
  if (!parsed.success) return zodFieldErrors(parsed.error);
  const point = parsed.data.coordinates ? parseCoordinates(parsed.data.coordinates) : null;
  const supabase = await createClient();
  const mine = {
    organization_id: active.organization.id,
    user_id: active.membership.user_id,
  };
  const { error } = point
    ? await supabase
        .from("member_homes")
        .upsert({ ...mine, latitude: point.latitude, longitude: point.longitude })
    : await supabase.from("member_homes").delete().match(mine);
  if (error) return { ok: false, error: databaseErrorCode(error) };
  revalidateRoutes();
  return { ok: true };
}
