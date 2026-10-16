import "server-only";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { planImagePath, type Point } from "@/lib/floor-plans";
import { ORG_ASSETS_BUCKET } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

// The sample building gets floor plans of its ground and first floor with the
// floors' devices on them, so a new company sees what plans are for. The image
// (src/assets/sample, from scripts/sample-floor-plan.svg) has no text, so it
// suits any language; plan names are the floors' names in the company language.

const IMAGE = { width: 2400, height: 1500 };

/** Spots in the corridor of the sample plan, by the floor's position (2 = ground, 3 = first). */
const SPOTS: Record<number, Point[]> = {
  2: [
    { x: 0.468, y: 0.465 },
    { x: 0.915, y: 0.47 },
  ],
  3: [
    { x: 0.3, y: 0.535 },
    { x: 0.82, y: 0.535 },
  ],
};

/**
 * Adds the sample floor plans to the sample customer's first building. Best
 * effort: the sample data is useful without them, so failures are only logged
 * (remove_sample_data removes whatever was created, files included).
 */
export async function addSamplePlans(organizationId: string, customerId: string) {
  try {
    const supabase = await createClient();
    // The building with the floors (both sample buildings share created_at).
    const { data: sites } = await supabase
      .from("sites")
      .select("id, locations(id)")
      .eq("customer_id", customerId);
    const site = (sites ?? []).find((candidate) => candidate.locations.length > 0);
    if (!site) return;
    const [{ data: locations }, { data: devices }] = await Promise.all([
      supabase
        .from("locations")
        .select("id, name, sort_order")
        .eq("site_id", site.id)
        .in("sort_order", [2, 3])
        .order("sort_order"),
      supabase
        .from("devices")
        .select("id, location_id, label_number")
        .eq("site_id", site.id)
        .order("label_number"),
    ]);
    const image = await fs.readFile(
      path.join(process.cwd(), "src", "assets", "sample", "floor-plan.webp"),
    );

    for (const [index, location] of (locations ?? []).entries()) {
      const imagePath = planImagePath(organizationId, site.id, `${randomUUID()}.webp`);
      const { error: uploadError } = await supabase.storage
        .from(ORG_ASSETS_BUCKET)
        .upload(imagePath, image, { contentType: "image/webp", upsert: false });
      if (uploadError) throw uploadError;
      const { data: plan, error } = await supabase
        .from("floor_plans")
        .insert({
          organization_id: organizationId,
          site_id: site.id,
          location_id: location.id,
          name: location.name,
          sort_order: index + 1,
          image_path: imagePath,
          image_width: IMAGE.width,
          image_height: IMAGE.height,
        })
        .select("id")
        .single();
      if (error || !plan) {
        await supabase.storage.from(ORG_ASSETS_BUCKET).remove([imagePath]);
        throw error;
      }
      const spots = SPOTS[location.sort_order] ?? [];
      const floorDevices = (devices ?? []).filter((device) => device.location_id === location.id);
      for (const [spot, device] of floorDevices.slice(0, spots.length).entries()) {
        const { error: placeError } = await supabase.rpc("place_device", {
          p_device: device.id,
          p_plan: plan.id,
          p_x: spots[spot]!.x,
          p_y: spots[spot]!.y,
        });
        if (placeError) throw placeError;
      }
    }
  } catch (error) {
    console.error("Sample floor plans could not be added", error);
  }
}
