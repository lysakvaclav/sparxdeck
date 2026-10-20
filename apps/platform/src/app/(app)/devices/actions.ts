"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { requireManager } from "@/lib/auth";
import { buildAttributes, deviceTypeFields, type DeviceTypeField } from "@/lib/devices";
import { databaseErrorCode, zodFieldErrors, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import {
  bulkDevicesSchema,
  bulkEditDevicesSchema,
  deviceEditSchema,
  deviceSchema,
  idSchema,
} from "@/lib/validation";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type DetailValues = Omit<z.output<typeof deviceEditSchema>, "status" | "serialNumber">;

/** Columns shared by create, bulk add and edit. Attributes follow the device type's fields. */
function detailColumns(input: DetailValues, fields: readonly DeviceTypeField[]) {
  return {
    location_id: input.locationId,
    device_type_id: input.deviceTypeId,
    manufacturer: input.manufacturer,
    model: input.model,
    manufacture_year: input.manufactureYear,
    attributes: buildAttributes(fields, input.customFields ?? {}),
    installed_on: input.installedOn,
    last_inspection_on: input.lastInspectionOn,
    end_of_life_on: input.endOfLifeOn,
    notes: input.notes,
  };
}

/** The type's own fields (RLS: only types of the user's organization are found). */
async function typeFields(supabase: Supabase, deviceTypeId: string) {
  const { data } = await supabase
    .from("device_types")
    .select("custom_fields")
    .eq("id", deviceTypeId)
    .maybeSingle();
  return data ? deviceTypeFields(data.custom_fields) : null;
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
  const fields = await typeFields(supabase, parsed.data.deviceTypeId);
  if (!fields) return { ok: false, error: "notFound", fieldErrors: { deviceTypeId: "notFound" } };

  // The label number, the QR token and the next due date come from the database;
  // a trigger refuses a deleted building (site_deleted).
  const { data, error } = await supabase
    .from("devices")
    .insert({
      ...detailColumns(parsed.data, fields),
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
  const fields = await typeFields(supabase, parsed.data.deviceTypeId);
  if (!fields) return { ok: false, error: "notFound", fieldErrors: { deviceTypeId: "notFound" } };

  const shared = {
    ...detailColumns(parsed.data, fields),
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
  const fields = await typeFields(supabase, parsed.data.deviceTypeId);
  if (!fields) return { ok: false, error: "notFound", fieldErrors: { deviceTypeId: "notFound" } };

  const { data, error } = await supabase
    .from("devices")
    .update({
      ...detailColumns(parsed.data, fields),
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

/**
 * Changes location and/or status of several devices at once. A location only
 * takes if it belongs to every selected device's building (a foreign key error
 * otherwise); the list page only offers it when the selection is one building.
 */
export async function bulkUpdateDevices(input: unknown): Promise<ActionResult<{ count: number }>> {
  const active = await requireManager();
  if (!active) return { ok: false, error: "forbidden" };
  const parsed = bulkEditDevicesSchema.safeParse(input);
  if (!parsed.success) return zodFieldErrors(parsed.error);
  const { deviceIds, locationId, status } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("devices")
    .update({
      ...(locationId !== undefined && { location_id: locationId }),
      ...(status !== undefined && { status }),
    })
    .in("id", deviceIds)
    .eq("organization_id", active.organization.id)
    .is("deleted_at", null)
    .select("id");
  if (error) return referenceError(error) ?? { ok: false, error: databaseErrorCode(error) };
  if (!data?.length) return { ok: false, error: "notFound" };

  revalidateDevices();
  return { ok: true, data: { count: data.length } };
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
