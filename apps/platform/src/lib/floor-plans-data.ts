import "server-only";
import { cache } from "react";
import { formatLabel } from "@/lib/devices";
import { dueState, type DueState, type IsoDate } from "@/lib/due";
import { SIGNED_URL_SECONDS, signedUrls } from "@/lib/storage";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation";

// Loaders for floor plans. RLS limits them to the user's organization.

/**
 * Signed URLs of plan images are reused while they have a few minutes left: the
 * same URL lets the browser keep the (large) image cached across refreshes. The
 * paths always come from rows the user may read (RLS), as before.
 */
const planUrlCache = new Map<string, { url: string; expires: number }>();
const REUSE_MARGIN_MS = 3 * 60 * 1000;

async function planImageUrls(paths: string[]): Promise<Map<string, string>> {
  const now = Date.now();
  const stale = paths.filter(
    (path) => (planUrlCache.get(path)?.expires ?? 0) - now < REUSE_MARGIN_MS,
  );
  if (stale.length) {
    const fresh = await signedUrls(stale);
    for (const [path, url] of fresh)
      planUrlCache.set(path, { url, expires: now + SIGNED_URL_SECONDS * 1000 });
    if (planUrlCache.size > 2000)
      for (const [path, entry] of planUrlCache) if (entry.expires < now) planUrlCache.delete(path);
  }
  return new Map(
    paths.flatMap((path) => {
      const entry = planUrlCache.get(path);
      return entry ? [[path, entry.url] as const] : [];
    }),
  );
}

export type PlanSummary = {
  id: string;
  name: string;
  locationId: string | null;
  locationName: string | null;
  width: number;
  height: number;
  /** Short-lived signed URL of the image (null if it couldn't be signed). */
  imageUrl: string | null;
  /** Active devices placed on the plan. */
  placed: number;
};

export type PlanDevice = {
  id: string;
  number: string;
  labelNumber: number;
  typeName: string;
  locationId: string | null;
  locationName: string | null;
  serialNumber: string | null;
  nextDue: IsoDate | null;
  due: DueState;
  placement: { planId: string; x: number; y: number } | null;
};

/** A building's plans in order, with image URLs and how many devices are on each. */
export const sitePlans = cache(async (siteId: string): Promise<PlanSummary[]> => {
  if (!idSchema.safeParse(siteId).success) return [];
  const supabase = await createClient();
  const [{ data: plans }, placements] = await Promise.all([
    supabase
      .from("floor_plans")
      .select(
        "id, name, location_id, image_path, image_width, image_height, location:locations(name)",
      )
      .eq("site_id", siteId)
      .order("sort_order")
      .order("created_at"),
    fetchAll((from, to) =>
      supabase
        .from("device_placements")
        .select("floor_plan_id, device:devices!inner(status, deleted_at)")
        .eq("site_id", siteId)
        .is("device.deleted_at", null)
        .eq("device.status", "active")
        .order("device_id")
        .range(from, to),
    ),
  ]);
  const urls = await planImageUrls((plans ?? []).map((plan) => plan.image_path));
  const counts = new Map<string, number>();
  for (const row of placements)
    counts.set(row.floor_plan_id, (counts.get(row.floor_plan_id) ?? 0) + 1);
  return (plans ?? []).map((plan) => ({
    id: plan.id,
    name: plan.name,
    locationId: plan.location_id,
    locationName: plan.location?.name ?? null,
    width: plan.image_width,
    height: plan.image_height,
    imageUrl: urls.get(plan.image_path) ?? null,
    placed: counts.get(plan.id) ?? 0,
  }));
});

/** One plan of a building (null when it isn't this building's or doesn't exist). */
export const getFloorPlan = cache(async (siteId: string, planId: string) => {
  if (!idSchema.safeParse(siteId).success || !idSchema.safeParse(planId).success) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("floor_plans")
    .select("*, location:locations(id, name)")
    .eq("id", planId)
    .eq("site_id", siteId)
    .maybeSingle();
  return data;
});

/**
 * The building's active devices with their due state and spot on a plan, in
 * label order. Placements on a plan of another building can't exist (the
 * database ties both to the same building).
 */
export async function planDevices(
  siteId: string,
  today: IsoDate,
  soonDays: number,
): Promise<PlanDevice[]> {
  const supabase = await createClient();
  const [devices, placements] = await Promise.all([
    fetchAll((from, to) =>
      supabase
        .from("devices")
        .select(
          "id, label_number, serial_number, next_due_on, location_id, location:locations(name), type:device_types(name)",
        )
        .eq("site_id", siteId)
        .is("deleted_at", null)
        .eq("status", "active")
        .order("label_number")
        .range(from, to),
    ),
    fetchAll((from, to) =>
      supabase
        .from("device_placements")
        .select("device_id, floor_plan_id, x, y")
        .eq("site_id", siteId)
        .order("device_id")
        .range(from, to),
    ),
  ]);
  const spots = new Map(placements.map((row) => [row.device_id, row]));
  return devices.map((device) => {
    const spot = spots.get(device.id);
    return {
      id: device.id,
      number: formatLabel(device.label_number),
      labelNumber: device.label_number,
      typeName: device.type?.name ?? "",
      locationId: device.location_id,
      locationName: device.location?.name ?? null,
      serialNumber: device.serial_number,
      nextDue: device.next_due_on,
      due: dueState(device.next_due_on, today, soonDays),
      placement: spot ? { planId: spot.floor_plan_id, x: spot.x, y: spot.y } : null,
    };
  });
}

/** Where one device is: its plan (with the image) and spot, or null. */
export async function devicePlacement(deviceId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("device_placements")
    .select("x, y, plan:floor_plans(id, name, site_id, image_path, image_width, image_height)")
    .eq("device_id", deviceId)
    .maybeSingle();
  if (!data?.plan) return null;
  const urls = await planImageUrls([data.plan.image_path]);
  return {
    x: data.x,
    y: data.y,
    plan: {
      id: data.plan.id,
      name: data.plan.name,
      siteId: data.plan.site_id,
      width: data.plan.image_width,
      height: data.plan.image_height,
      imageUrl: urls.get(data.plan.image_path) ?? null,
    },
  };
}

/** Where the building's devices are, by device id. */
export async function sitePlacements(
  siteId: string,
): Promise<Record<string, { planId: string; x: number; y: number }>> {
  const supabase = await createClient();
  const rows = await fetchAll((from, to) =>
    supabase
      .from("device_placements")
      .select("device_id, floor_plan_id, x, y")
      .eq("site_id", siteId)
      .order("device_id")
      .range(from, to),
  );
  return Object.fromEntries(
    rows.map((row) => [row.device_id, { planId: row.floor_plan_id, x: row.x, y: row.y }]),
  );
}

export type PlanListItem = PlanSummary & {
  siteId: string;
  siteName: string;
  customerId: string;
  customerName: string;
};

/** All floor plans of the organization (deleted buildings and customers left out). */
export async function organizationPlans(): Promise<PlanListItem[]> {
  const supabase = await createClient();
  const [plans, placements] = await Promise.all([
    fetchAll((from, to) =>
      supabase
        .from("floor_plans")
        .select(
          "id, name, location_id, image_path, image_width, image_height, sort_order, location:locations(name), site:sites!inner(id, name, deleted_at, customer:customers!inner(id, name, deleted_at))",
        )
        .is("site.deleted_at", null)
        .is("site.customer.deleted_at", null)
        .order("id")
        .range(from, to),
    ),
    fetchAll((from, to) =>
      supabase
        .from("device_placements")
        .select("floor_plan_id, device:devices!inner(status, deleted_at)")
        .is("device.deleted_at", null)
        .eq("device.status", "active")
        .order("device_id")
        .range(from, to),
    ),
  ]);
  const urls = await planImageUrls(plans.map((plan) => plan.image_path));
  const order = new Map(plans.map((plan) => [plan.id, plan.sort_order]));
  const counts = new Map<string, number>();
  for (const row of placements)
    counts.set(row.floor_plan_id, (counts.get(row.floor_plan_id) ?? 0) + 1);
  return plans
    .filter((plan) => plan.site?.customer)
    .map((plan) => ({
      id: plan.id,
      name: plan.name,
      locationId: plan.location_id,
      locationName: plan.location?.name ?? null,
      width: plan.image_width,
      height: plan.image_height,
      imageUrl: urls.get(plan.image_path) ?? null,
      placed: counts.get(plan.id) ?? 0,
      siteId: plan.site!.id,
      siteName: plan.site!.name,
      customerId: plan.site!.customer!.id,
      customerName: plan.site!.customer!.name,
    }))
    .sort(
      (a, b) =>
        a.customerName.localeCompare(b.customerName) ||
        a.siteName.localeCompare(b.siteName) ||
        (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
    );
}
