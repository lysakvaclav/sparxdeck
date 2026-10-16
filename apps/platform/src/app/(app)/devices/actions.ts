"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { requireManager } from "@/lib/auth";
import { buildAttributes } from "@/lib/devices";
import { databaseErrorCode, zodFieldErrors, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { bulkDevicesSchema, deviceEditSchema, deviceSchema, idSchema } from "@/lib/validation";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type DetailValues = Omit<z.output<typeof deviceEditSchema>, "status" | "serialNumber">;

/** Columns shared by create, bulk add and edit. Attributes follow the device type. */
function detailColumns(input: DetailValues, typeCode: string) {
  return {
    location_id: input.locationId,
    device_type_id: input.deviceTypeId,
    manufacturer: input.manufacturer,
    model: input.model,
    manufacture_year: input.manufactureYear,
    attributes: buildAttributes(typeCode, { agent: input.agent, size: input.size }),
    installed_on: input.installedOn,
    last_inspection_on: input.lastInspectionOn,
    notes: input.notes,
  };
}

/** The type's code (RLS: only types of the user's organization are found). */
async function typeCode(supabase: Supabase, deviceTypeId: string) {
  const { data } = await supabase
    .from("device_types")
    .select("code")
    .eq("id", deviceTypeId)
    .maybeSingle();
  return data?.code ?? null;
}

/** A foreign key refused the location (another building) or the building itself. */
function referenceError(error: {
  code?: string;
  message?: string;
}): Extract<ActionResult, { ok: false }> | null {
  if (error.code !== "23503") return null;
  if (error.message?.includes("location"))
    return { ok: false, error: "notFound", fieldErrors: { locationId: "notFound" } };
  return { ok: false, error: "notFound" };
}

// Devices show up on the dashboard, in buildings, customers and the map.
function revalidateDevices() {
  revalidatePath("/", "layout");
}

export async function createDevice(
  input: unknown,
): Promise<ActionResult<{ id: string; labelNumber: number }>> {
  const active = await requireManager();
  if (!active) return { ok: false, error: "forbidden" };
  const parsed = deviceSchema.safeParse(input);
  if (!parsed.success) return zodFieldErrors(parsed.error);

  const supabase = await createClient();
  const code = await typeCode(supabase, parsed.data.deviceTypeId);
  if (!code) return { ok: false, error: "notFound", fieldErrors: { deviceTypeId: "notFound" } };

  // The label number, the QR token and the next due date come from the database;
  // a trigger refuses a deleted building (site_deleted).
  const { data, error } = await supabase
    .from("devices")
    .insert({
      ...detailColumns(parsed.data, code),
      organization_id: active.organization.id,
      site_id: parsed.data.siteId,
      serial_number: parsed.data.serialNumber,
      created_by: active.membership.user_id,
    })
    .select("id, label_number")
    .single();
  if (error) return referenceError(error) ?? { ok: false, error: databaseErrorCode(error) };
  if (!data) return { ok: false, error: "unexpected" };

  revalidateDevices();
  return { ok: true, data: { id: data.id, labelNumber: data.label_number } };
}

/**
 * Adds up to 100 devices in one statement: they get consecutive label numbers in
 * the order of the serial numbers, even if someone else adds devices meanwhile.
 */
export async function createDevices(
  input: unknown,
): Promise<ActionResult<{ count: number; first: number; last: number }>> {
  const active = await requireManager();
  if (!active) return { ok: false, error: "forbidden" };
  const parsed = bulkDevicesSchema.safeParse(input);
  if (!parsed.success) return zodFieldErrors(parsed.error);
  const { count, serialNumbers, siteId } = parsed.data;

  const supabase = await createClient();
  const code = await typeCode(supabase, parsed.data.deviceTypeId);
  if (!code) return { ok: false, error: "notFound", fieldErrors: { deviceTypeId: "notFound" } };

  const shared = {
    ...detailColumns(parsed.data, code),
    organization_id: active.organization.id,
    site_id: siteId,
    created_by: active.membership.user_id,
  };
  const rows = Array.from({ length: count }, (_, index) => ({
    ...shared,
    serial_number: serialNumbers[index] ?? null,
  }));
  const { data, error } = await supabase.from("devices").insert(rows).select("label_number");
  if (error) return referenceError(error) ?? { ok: false, error: databaseErrorCode(error) };
  if (!data?.length) return { ok: false, error: "unexpected" };

  const labels = data.map((row) => row.label_number);
  revalidateDevices();
  return {
    ok: true,
    data: { count: labels.length, first: Math.min(...labels), last: Math.max(...labels) },
  };
}

export async function updateDevice(id: string, input: unknown): Promise<ActionResult> {
  const active = await requireManager();
  if (!active) return { ok: false, error: "forbidden" };
  if (!idSchema.safeParse(id).success) return { ok: false, error: "notFound" };
  const parsed = deviceEditSchema.safeParse(input);
  if (!parsed.success) return zodFieldErrors(parsed.error);

  const supabase = await createClient();
  const code = await typeCode(supabase, parsed.data.deviceTypeId);
  if (!code) return { ok: false, error: "notFound", fieldErrors: { deviceTypeId: "notFound" } };

  const { data, error } = await supabase
    .from("devices")
    .update({
      ...detailColumns(parsed.data, code),
      serial_number: parsed.data.serialNumber,
      status: parsed.data.status,
    })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");
  if (error) return referenceError(error) ?? { ok: false, error: databaseErrorCode(error) };
  if (!data?.length) return { ok: false, error: "notFound" };

  revalidateDevices();
  return { ok: true };
}

/** Soft delete; the label number is never reused. */
export async function deleteDevice(id: string): Promise<ActionResult> {
  const active = await requireManager();
  if (!active) return { ok: false, error: "forbidden" };
  if (!idSchema.safeParse(id).success) return { ok: false, error: "notFound" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("devices")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");
  if (error) return { ok: false, error: databaseErrorCode(error) };
  if (!data?.length) return { ok: false, error: "notFound" };

  revalidateDevices();
  return { ok: true };
}
