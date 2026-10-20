"use server";

import { revalidatePath } from "next/cache";
import { getActiveMembership } from "@/lib/auth";
import { buildAttributes, deviceTypeFields } from "@/lib/devices";
import { databaseErrorCode, zodFieldErrors, type ActionResult } from "@/lib/errors";
import { generateProtocol } from "@/lib/protocols";
import { ORG_ASSETS_BUCKET, sniffImage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  completeInspectionSchema,
  idSchema,
  inspectionDeviceSchema,
  reopenInspectionSchema,
} from "@/lib/validation";

// Inspections are field work: every member may start and complete them (the
// database functions check membership). Filling in a device's check happens in
// the browser, straight against the database functions, so it can keep going
// through a bad signal (see device-check.tsx).

/** Starts the building's inspection, or joins the one already in progress. */
export async function startInspection(siteId: string): Promise<ActionResult<{ id: string }>> {
  const active = await getActiveMembership();
  if (!active) return { ok: false, error: "forbidden" };
  if (!idSchema.safeParse(siteId).success) return { ok: false, error: "notFound" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_inspection", { p_site: siteId });
  if (error || !data) return { ok: false, error: databaseErrorCode(error) };

  revalidatePath("/", "layout");
  return { ok: true, data: { id: data } };
}

export type CompletionSummary = {
  passed: number;
  failed: number;
  notChecked: number;
  /** Of those not checked, the ones left out with a reason. */
  skipped: number;
  /** Defects created from failed answers. */
  defects: number;
  /** The protocol numbered on completion. */
  protocol: string | null;
};

/**
 * The customer's finger-drawn signature (a small PNG, base64) goes to storage
 * under the server's own authority: nobody else may write there, so there is
 * no separate RLS policy to keep in step with this check.
 */
async function uploadSignature(organizationId: string, inspectionId: string, base64: string) {
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length === 0 || bytes.length > 300_000 || sniffImage(bytes)?.ext !== "png") return null;
  const path = `${organizationId}/signatures/${inspectionId}.png`;
  const { error } = await createAdminClient()
    .storage.from(ORG_ASSETS_BUCKET)
    .upload(path, bytes, { contentType: "image/png", upsert: true });
  return error ? null : path;
}

/** Completes the inspection: moves due dates of passed devices, records the rest. */
export async function completeInspection(
  id: string,
  input: unknown,
): Promise<ActionResult<CompletionSummary>> {
  const active = await getActiveMembership();
  if (!active) return { ok: false, error: "forbidden" };
  if (!idSchema.safeParse(id).success) return { ok: false, error: "notFound" };
  const parsed = completeInspectionSchema.safeParse(input);
  if (!parsed.success) return zodFieldErrors(parsed.error);

  const signaturePath = parsed.data.signature
    ? await uploadSignature(active.organization.id, id, parsed.data.signature)
    : null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complete_inspection", {
    p_inspection: id,
    p_notes: parsed.data.notes,
    p_signature_path: signaturePath,
    p_signer_name: parsed.data.signerName ?? null,
  });
  if (error || !data) return { ok: false, error: databaseErrorCode(error) };
  const summary = data as CompletionSummary;
  // The PDF right away, so it can be handed over on site. If it fails, the
  // inspection stays completed and its page offers to create the PDF again.
  if (summary.protocol) await generateProtocol(summary.protocol);

  revalidatePath("/", "layout");
  return { ok: true, data: summary };
}

/**
 * Reopens a completed inspection for a correction (owner or admin): it goes
 * back to "in progress" so the usual check screens can fix it. Completing it
 * again reissues the protocol as a new version; the original PDF stays.
 */
export async function reopenInspection(id: string, input: unknown): Promise<ActionResult> {
  const active = await getActiveMembership();
  if (!active) return { ok: false, error: "forbidden" };
  if (!idSchema.safeParse(id).success) return { ok: false, error: "notFound" };
  const parsed = reopenInspectionSchema.safeParse(input);
  if (!parsed.success) return zodFieldErrors(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("reopen_inspection", {
    p_inspection: id,
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false, error: databaseErrorCode(error) };

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Adds a device found in the building during its inspection (anyone doing the
 * inspection may). Returns its id, to check it right away.
 */
export async function addInspectionDevice(
  inspectionId: string,
  input: unknown,
): Promise<ActionResult<{ id: string; labelNumber: number }>> {
  const active = await getActiveMembership();
  if (!active) return { ok: false, error: "forbidden" };
  if (!idSchema.safeParse(inspectionId).success) return { ok: false, error: "notFound" };
  const parsed = inspectionDeviceSchema.safeParse(input);
  if (!parsed.success) return zodFieldErrors(parsed.error);
  const values = parsed.data;

  const supabase = await createClient();
  const { data: type } = await supabase
    .from("device_types")
    .select("custom_fields")
    .eq("id", values.deviceTypeId)
    .maybeSingle();
  if (!type) return { ok: false, error: "notFound", fieldErrors: { deviceTypeId: "notFound" } };
  const { data, error } = await supabase.rpc("add_inspection_device", {
    p_inspection: inspectionId,
    p_device_type: values.deviceTypeId,
    p_location: values.locationId,
    p_serial_number: values.serialNumber,
    p_manufacturer: values.manufacturer,
    p_model: values.model,
    p_manufacture_year: values.manufactureYear,
    p_attributes: buildAttributes(deviceTypeFields(type.custom_fields), values.customFields ?? {}),
    p_notes: values.notes,
  });
  if (error?.message?.includes("device_exists"))
    return { ok: false, error: "deviceExists", fieldErrors: { serialNumber: "deviceExists" } };
  if (error || !data) return { ok: false, error: databaseErrorCode(error) };
  const { data: device } = await supabase
    .from("devices")
    .select("label_number")
    .eq("id", data)
    .single();

  revalidatePath("/", "layout");
  return { ok: true, data: { id: data, labelNumber: device?.label_number ?? 0 } };
}

/**
 * Cancels an inspection in progress (whoever started it, or an owner or admin):
 * its checks go, the devices stay. The photos are removed from storage too.
 */
export async function cancelInspection(
  inspectionId: string,
): Promise<ActionResult<{ siteId: string }>> {
  const active = await getActiveMembership();
  if (!active) return { ok: false, error: "forbidden" };
  if (!idSchema.safeParse(inspectionId).success) return { ok: false, error: "notFound" };

  const supabase = await createClient();
  const { data: inspection } = await supabase
    .from("inspections")
    .select("site_id, organization_id")
    .eq("id", inspectionId)
    .maybeSingle();
  if (!inspection) return { ok: false, error: "notFound" };
  const { data: photos, error } = await supabase.rpc("cancel_inspection", {
    p_inspection: inspectionId,
  });
  if (error) return { ok: false, error: databaseErrorCode(error) };

  // Photos of several people: the database allowed it, the server removes them
  // (with the service role, so only files in the organization's folder).
  const folder = `${inspection.organization_id}/`;
  const paths = (photos ?? []).map((photo) => photo.path).filter((path) => path.startsWith(folder));
  const admin = createAdminClient();
  for (let start = 0; start < paths.length; start += 100) {
    const { error: removeError } = await admin.storage
      .from(ORG_ASSETS_BUCKET)
      .remove(paths.slice(start, start + 100));
    if (removeError)
      console.error("Photos of a cancelled inspection were not removed", removeError);
  }

  revalidatePath("/", "layout");
  return { ok: true, data: { siteId: inspection.site_id } };
}
