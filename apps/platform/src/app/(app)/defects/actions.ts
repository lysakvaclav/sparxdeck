"use server";

import { revalidatePath } from "next/cache";
import { getActiveMembership } from "@/lib/auth";
import { DEFECT_SEVERITIES, DEFECT_STATUSES } from "@/lib/defects";
import { deviceName, labelQuery } from "@/lib/devices";
import { databaseErrorCode, zodFieldErrors, type ActionResult } from "@/lib/errors";
import type { DefectSeverity, DefectStatus } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import {
  defectDescriptionSchema,
  defectNoteSchema,
  defectSchema,
  idSchema,
} from "@/lib/validation";

// Every member reports and works on defects (technicians report them in the
// field); the database functions check membership and record each change.

function revalidateDefects() {
  revalidatePath("/", "layout");
}

/** The device with a label number, for the report form ("12" → 0012). */
export async function findDeviceByLabel(
  input: string,
): Promise<{ id: string; name: string; siteName: string } | null> {
  const active = await getActiveMembership();
  const number = labelQuery(input);
  if (!active || !number) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("devices")
    .select("id, label_number, type:device_types(name), site:sites(name)")
    .eq("organization_id", active.organization.id)
    .eq("label_number", number)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    name: deviceName(data.type?.name ?? "", data.label_number),
    siteName: data.site?.name ?? "",
  };
}

export async function createDefect(
  input: unknown,
): Promise<ActionResult<{ id: string; number: number }>> {
  const active = await getActiveMembership();
  if (!active) return { ok: false, error: "forbidden" };
  const parsed = defectSchema.safeParse(input);
  if (!parsed.success) return zodFieldErrors(parsed.error);

  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("create_defect", {
    p_device: parsed.data.deviceId,
    p_description: parsed.data.description,
    p_severity: parsed.data.severity,
  });
  if (error || !id) return { ok: false, error: databaseErrorCode(error) };
  const { data } = await supabase.from("defects").select("number").eq("id", id).single();

  revalidateDefects();
  return { ok: true, data: { id, number: data?.number ?? 0 } };
}

export async function changeDefectStatus(
  id: string,
  status: DefectStatus,
  note: string | null,
): Promise<ActionResult> {
  const active = await getActiveMembership();
  if (!active) return { ok: false, error: "forbidden" };
  if (!idSchema.safeParse(id).success || !DEFECT_STATUSES.includes(status))
    return { ok: false, error: "notFound" };
  if (status === "resolved" && !defectNoteSchema.safeParse({ note: note ?? "" }).success)
    return { ok: false, error: "resolutionRequired", fieldErrors: { note: "required" } };

  const supabase = await createClient();
  const { error } = await supabase.rpc("change_defect_status", {
    p_defect: id,
    p_status: status,
    p_note: note,
  });
  if (error) return { ok: false, error: databaseErrorCode(error) };
  revalidateDefects();
  return { ok: true };
}

export async function changeDefectSeverity(
  id: string,
  severity: DefectSeverity,
): Promise<ActionResult> {
  const active = await getActiveMembership();
  if (!active) return { ok: false, error: "forbidden" };
  if (!idSchema.safeParse(id).success || !DEFECT_SEVERITIES.includes(severity))
    return { ok: false, error: "notFound" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("change_defect_severity", {
    p_defect: id,
    p_severity: severity,
  });
  if (error) return { ok: false, error: databaseErrorCode(error) };
  revalidateDefects();
  return { ok: true };
}

export async function editDefectDescription(id: string, input: unknown): Promise<ActionResult> {
  const active = await getActiveMembership();
  if (!active) return { ok: false, error: "forbidden" };
  if (!idSchema.safeParse(id).success) return { ok: false, error: "notFound" };
  const parsed = defectDescriptionSchema.safeParse(input);
  if (!parsed.success) return zodFieldErrors(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("edit_defect_description", {
    p_defect: id,
    p_description: parsed.data.description,
  });
  if (error) return { ok: false, error: databaseErrorCode(error) };
  revalidateDefects();
  return { ok: true };
}

export async function commentDefect(id: string, input: unknown): Promise<ActionResult> {
  const active = await getActiveMembership();
  if (!active) return { ok: false, error: "forbidden" };
  if (!idSchema.safeParse(id).success) return { ok: false, error: "notFound" };
  const parsed = defectNoteSchema.safeParse(input);
  if (!parsed.success) return zodFieldErrors(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("comment_defect", {
    p_defect: id,
    p_note: parsed.data.note,
  });
  if (error) return { ok: false, error: databaseErrorCode(error) };
  revalidateDefects();
  return { ok: true };
}
