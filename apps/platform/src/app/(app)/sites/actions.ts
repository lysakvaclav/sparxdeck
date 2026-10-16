"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";
import { databaseErrorCode, zodFieldErrors, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { idListSchema, idSchema, locationNameSchema, siteSchema } from "@/lib/validation";

function siteColumns(input: ReturnType<typeof siteSchema.parse>) {
  return {
    name: input.name,
    address: input.address,
    access_notes: input.accessNotes,
    notes: input.notes,
  };
}

function revalidateSites() {
  revalidatePath("/customers", "layout");
  revalidatePath("/sites", "layout");
}

// ---------------------------------------------------------------------------
// Sites
// ---------------------------------------------------------------------------

export async function createSite(
  customerId: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const active = await requireManager();
  if (!active) return { ok: false, error: "forbidden" };
  if (!idSchema.safeParse(customerId).success) return { ok: false, error: "notFound" };
  const parsed = siteSchema.safeParse(input);
  if (!parsed.success) return zodFieldErrors(parsed.error);

  const supabase = await createClient();
  // The composite foreign key rejects a customer from another organization, and a
  // trigger rejects a deleted customer (customer_deleted).
  const { data, error } = await supabase
    .from("sites")
    .insert({
      ...siteColumns(parsed.data),
      organization_id: active.organization.id,
      customer_id: customerId,
      created_by: active.membership.user_id,
    })
    .select("id")
    .single();
  if (error?.code === "23503") return { ok: false, error: "notFound" };
  if (error || !data) return { ok: false, error: databaseErrorCode(error) };

  revalidateSites();
  return { ok: true, data: { id: data.id } };
}

export async function updateSite(id: string, input: unknown): Promise<ActionResult> {
  const active = await requireManager();
  if (!active) return { ok: false, error: "forbidden" };
  if (!idSchema.safeParse(id).success) return { ok: false, error: "notFound" };
  const parsed = siteSchema.safeParse(input);
  if (!parsed.success) return zodFieldErrors(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sites")
    .update(siteColumns(parsed.data))
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");
  if (error) return { ok: false, error: databaseErrorCode(error) };
  if (!data?.length) return { ok: false, error: "notFound" };

  revalidateSites();
  return { ok: true };
}

/** Soft delete. Returns the customer, so the UI can go back to it. */
export async function deleteSite(id: string): Promise<ActionResult<{ customerId: string }>> {
  const active = await requireManager();
  if (!active) return { ok: false, error: "forbidden" };
  if (!idSchema.safeParse(id).success) return { ok: false, error: "notFound" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sites")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)
    .select("customer_id");
  if (error) return { ok: false, error: databaseErrorCode(error) };
  const site = data?.[0];
  if (!site) return { ok: false, error: "notFound" };

  revalidateSites();
  return { ok: true, data: { customerId: site.customer_id } };
}

// ---------------------------------------------------------------------------
// Locations inside a site
// ---------------------------------------------------------------------------

export async function createLocation(siteId: string, input: unknown): Promise<ActionResult> {
  const active = await requireManager();
  if (!active) return { ok: false, error: "forbidden" };
  if (!idSchema.safeParse(siteId).success) return { ok: false, error: "notFound" };
  const parsed = locationNameSchema.safeParse(input);
  if (!parsed.success) return zodFieldErrors(parsed.error);

  const supabase = await createClient();
  const { data: site } = await supabase
    .from("sites")
    .select("id")
    .eq("id", siteId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!site) return { ok: false, error: "notFound" };

  // New locations go to the end of the route.
  const { data: last } = await supabase
    .from("locations")
    .select("sort_order")
    .eq("site_id", siteId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("locations").insert({
    organization_id: active.organization.id,
    site_id: siteId,
    name: parsed.data.name,
    sort_order: (last?.sort_order ?? 0) + 1,
  });
  if (error) return { ok: false, error: databaseErrorCode(error) };

  revalidatePath(`/sites/${siteId}`);
  return { ok: true };
}

export async function renameLocation(id: string, input: unknown): Promise<ActionResult> {
  const active = await requireManager();
  if (!active) return { ok: false, error: "forbidden" };
  if (!idSchema.safeParse(id).success) return { ok: false, error: "notFound" };
  const parsed = locationNameSchema.safeParse(input);
  if (!parsed.success) return zodFieldErrors(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("locations")
    .update({ name: parsed.data.name })
    .eq("id", id)
    .select("site_id");
  if (error) return { ok: false, error: databaseErrorCode(error) };
  const location = data?.[0];
  if (!location) return { ok: false, error: "notFound" };

  revalidatePath(`/sites/${location.site_id}`);
  return { ok: true };
}

export async function deleteLocation(id: string): Promise<ActionResult> {
  const active = await requireManager();
  if (!active) return { ok: false, error: "forbidden" };
  if (!idSchema.safeParse(id).success) return { ok: false, error: "notFound" };

  const supabase = await createClient();
  const { data, error } = await supabase.from("locations").delete().eq("id", id).select("site_id");
  if (error) return { ok: false, error: databaseErrorCode(error) };
  const location = data?.[0];
  if (!location) return { ok: false, error: "notFound" };

  revalidatePath(`/sites/${location.site_id}`);
  return { ok: true };
}

/** Saves the full order of a site's locations at once (the database checks it's complete). */
export async function reorderLocations(siteId: string, orderedIds: unknown): Promise<ActionResult> {
  const active = await requireManager();
  if (!active) return { ok: false, error: "forbidden" };
  const site = idSchema.safeParse(siteId);
  const ids = idListSchema.safeParse(orderedIds);
  if (!site.success || !ids.success) return { ok: false, error: "locationsMismatch" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder_locations", {
    p_site: site.data,
    p_ordered: ids.data,
  });
  if (error) return { ok: false, error: databaseErrorCode(error) };

  revalidatePath(`/sites/${site.data}`);
  return { ok: true };
}
