"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import sharp from "sharp";
import { requireManager } from "@/lib/auth";
import { databaseErrorCode, zodFieldErrors, type ActionResult, type ErrorCode } from "@/lib/errors";
import { PLAN_MAX_BYTES, PLAN_MAX_DIMENSION, planImagePath, unit } from "@/lib/floor-plans";
import { getSite } from "@/lib/records";
import { ORG_ASSETS_BUCKET, sniffImage } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { floorPlanSchema, idListSchema, idSchema, placementSchema } from "@/lib/validation";

// Floor plans of a building and where its devices are on them. Owners and admins
// only (RLS checks again). The browser prepares the image; here it's checked by
// its content and size before it's stored in the organization's folder.

type PlanImage = { bytes: Uint8Array; mime: string; ext: string; width: number; height: number };

async function readPlanImage(formData: FormData): Promise<PlanImage | ErrorCode> {
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return "fileTypeInvalid";
  if (file.size > PLAN_MAX_BYTES) return "fileTooLarge";
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffImage(bytes);
  if (!kind) return "fileTypeInvalid";
  try {
    // Decoding the header also proves it's an image, not just its first bytes.
    const { width, height } = await sharp(bytes).metadata();
    if (!width || !height) return "fileTypeInvalid";
    if (width > PLAN_MAX_DIMENSION || height > PLAN_MAX_DIMENSION) return "fileTooLarge";
    return { bytes, mime: kind.mime, ext: kind.ext, width, height };
  } catch {
    return "fileTypeInvalid";
  }
}

function revalidatePlans(siteId: string) {
  revalidatePath(`/sites/${siteId}`, "layout");
  revalidatePath("/devices", "layout");
  revalidatePath("/inspections", "layout");
}

function planFields(formData: FormData) {
  return floorPlanSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    locationId: String(formData.get("locationId") ?? ""),
  });
}

export async function uploadFloorPlan(
  siteId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const active = await requireManager();
  if (!active) return { ok: false, error: "forbidden" };
  if (!idSchema.safeParse(siteId).success) return { ok: false, error: "notFound" };
  const parsed = planFields(formData);
  if (!parsed.success) return zodFieldErrors(parsed.error);
  const site = await getSite(siteId);
  if (!site) return { ok: false, error: "notFound" };
  const image = await readPlanImage(formData);
  if (typeof image === "string") return { ok: false, error: image };

  const supabase = await createClient();
  const organizationId = active.organization.id;
  const path = planImagePath(organizationId, siteId, `${randomUUID()}.${image.ext}`);
  const { error: uploadError } = await supabase.storage
    .from(ORG_ASSETS_BUCKET)
    .upload(path, image.bytes, { contentType: image.mime, upsert: false });
  if (uploadError) return { ok: false, error: "unexpected" };

  const { data: last } = await supabase
    .from("floor_plans")
    .select("sort_order")
    .eq("site_id", siteId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await supabase
    .from("floor_plans")
    .insert({
      organization_id: organizationId,
      site_id: siteId,
      location_id: parsed.data.locationId,
      name: parsed.data.name,
      sort_order: (last?.sort_order ?? 0) + 1,
      image_path: path,
      image_width: image.width,
      image_height: image.height,
    })
    .select("id")
    .single();
  if (error || !data) {
    await supabase.storage.from(ORG_ASSETS_BUCKET).remove([path]);
    // The location must be one of the building's (composite key).
    if (error?.code === "23503")
      return { ok: false, error: "notFound", fieldErrors: { locationId: "notFound" } };
    return { ok: false, error: databaseErrorCode(error) };
  }

  revalidatePlans(siteId);
  return { ok: true, data: { id: data.id } };
}

/** A new image for the plan; devices keep their spots (relative to the image). */
export async function replaceFloorPlanImage(
  planId: string,
  formData: FormData,
): Promise<ActionResult> {
  const active = await requireManager();
  if (!active) return { ok: false, error: "forbidden" };
  if (!idSchema.safeParse(planId).success) return { ok: false, error: "notFound" };
  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("floor_plans")
    .select("id, site_id, image_path")
    .eq("id", planId)
    .eq("organization_id", active.organization.id)
    .maybeSingle();
  if (!plan) return { ok: false, error: "notFound" };
  const image = await readPlanImage(formData);
  if (typeof image === "string") return { ok: false, error: image };

  const path = planImagePath(active.organization.id, plan.site_id, `${randomUUID()}.${image.ext}`);
  const { error: uploadError } = await supabase.storage
    .from(ORG_ASSETS_BUCKET)
    .upload(path, image.bytes, { contentType: image.mime, upsert: false });
  if (uploadError) return { ok: false, error: "unexpected" };
  const { data, error } = await supabase
    .from("floor_plans")
    .update({ image_path: path, image_width: image.width, image_height: image.height })
    .eq("id", plan.id)
    .select("id");
  if (error || !data?.length) {
    await supabase.storage.from(ORG_ASSETS_BUCKET).remove([path]);
    return { ok: false, error: error ? databaseErrorCode(error) : "notFound" };
  }
  await supabase.storage.from(ORG_ASSETS_BUCKET).remove([plan.image_path]);

  revalidatePlans(plan.site_id);
  return { ok: true };
}

export async function updateFloorPlan(planId: string, input: unknown): Promise<ActionResult> {
  const active = await requireManager();
  if (!active) return { ok: false, error: "forbidden" };
  if (!idSchema.safeParse(planId).success) return { ok: false, error: "notFound" };
  const parsed = floorPlanSchema.safeParse(input);
  if (!parsed.success) return zodFieldErrors(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("floor_plans")
    .update({ name: parsed.data.name, location_id: parsed.data.locationId })
    .eq("id", planId)
    .select("site_id");
  if (error?.code === "23503")
    return { ok: false, error: "notFound", fieldErrors: { locationId: "notFound" } };
  if (error) return { ok: false, error: databaseErrorCode(error) };
  if (!data?.[0]) return { ok: false, error: "notFound" };

  revalidatePlans(data[0].site_id);
  return { ok: true };
}

/** Deletes the plan and its image; the devices stay, just without a spot on it. */
export async function deleteFloorPlan(planId: string): Promise<ActionResult<{ siteId: string }>> {
  const active = await requireManager();
  if (!active) return { ok: false, error: "forbidden" };
  if (!idSchema.safeParse(planId).success) return { ok: false, error: "notFound" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("floor_plans")
    .delete()
    .eq("id", planId)
    .select("site_id, image_path");
  if (error) return { ok: false, error: databaseErrorCode(error) };
  const plan = data?.[0];
  if (!plan) return { ok: false, error: "notFound" };
  const { error: removeError } = await supabase.storage
    .from(ORG_ASSETS_BUCKET)
    .remove([plan.image_path]);
  if (removeError) console.error("Floor plan image could not be removed", removeError);

  revalidatePlans(plan.site_id);
  return { ok: true, data: { siteId: plan.site_id } };
}

export async function reorderFloorPlans(
  siteId: string,
  orderedIds: unknown,
): Promise<ActionResult> {
  const active = await requireManager();
  if (!active) return { ok: false, error: "forbidden" };
  if (!idSchema.safeParse(siteId).success) return { ok: false, error: "notFound" };
  const parsed = idListSchema.safeParse(orderedIds);
  if (!parsed.success) return { ok: false, error: "notFound" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder_floor_plans", {
    p_site: siteId,
    p_ordered: parsed.data,
  });
  if (error) return { ok: false, error: databaseErrorCode(error) };

  revalidatePlans(siteId);
  return { ok: true };
}

/** Puts a device on a plan, or moves it (to another spot or another plan of its building). */
export async function placeDevice(input: unknown): Promise<ActionResult> {
  const active = await requireManager();
  if (!active) return { ok: false, error: "forbidden" };
  const parsed = placementSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "notFound" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("place_device", {
    p_device: parsed.data.deviceId,
    p_plan: parsed.data.planId,
    p_x: unit(parsed.data.x),
    p_y: unit(parsed.data.y),
  });
  // A device of another building (or organization) fails the keys.
  if (error?.code === "23503") return { ok: false, error: "notFound" };
  if (error) return { ok: false, error: databaseErrorCode(error) };
  revalidatePath(`/devices/${parsed.data.deviceId}`);
  return { ok: true };
}

/** Takes a device off its plan. */
export async function removePlacement(deviceId: string): Promise<ActionResult> {
  const active = await requireManager();
  if (!active) return { ok: false, error: "forbidden" };
  if (!idSchema.safeParse(deviceId).success) return { ok: false, error: "notFound" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("device_placements")
    .delete()
    .eq("device_id", deviceId)
    .select("device_id");
  if (error) return { ok: false, error: databaseErrorCode(error) };
  if (!data?.length) return { ok: false, error: "notFound" };
  revalidatePath(`/devices/${deviceId}`);
  return { ok: true };
}
