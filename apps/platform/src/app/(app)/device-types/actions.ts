"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";
import { databaseErrorCode, zodFieldErrors, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { checklistTemplateSchema, deviceTypeSchema, idSchema } from "@/lib/validation";

function revalidateTypes() {
  revalidatePath("/device-types", "layout");
}

/** Name and inspection interval. Saving also confirms the seeded sample interval. */
export async function updateDeviceType(id: string, input: unknown): Promise<ActionResult> {
  const active = await requireManager();
  if (!active) return { ok: false, error: "forbidden" };
  if (!idSchema.safeParse(id).success) return { ok: false, error: "notFound" };
  const parsed = deviceTypeSchema.safeParse(input);
  if (!parsed.success) return zodFieldErrors(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("device_types")
    .update({
      name: parsed.data.name,
      inspection_interval_months: parsed.data.interval,
      is_sample: false,
    })
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, error: databaseErrorCode(error) };
  if (!data?.length) return { ok: false, error: "notFound" };

  revalidateTypes();
  return { ok: true };
}

/**
 * Saves the checklist as a new active version (the database keeps older versions
 * for inspections that used them). Returns the active version afterwards and
 * whether anything changed.
 */
export async function saveChecklistTemplate(
  deviceTypeId: string,
  input: unknown,
): Promise<ActionResult<{ version: number; created: boolean }>> {
  const active = await requireManager();
  if (!active) return { ok: false, error: "forbidden" };
  if (!idSchema.safeParse(deviceTypeId).success) return { ok: false, error: "notFound" };
  const parsed = checklistTemplateSchema.safeParse(input);
  if (!parsed.success) {
    // The first problem decides the message; per-item details are shown by the editor.
    const issue = parsed.error.issues[0];
    return { ok: false, error: (issue?.message as "templateInvalid") ?? "templateInvalid" };
  }

  const supabase = await createClient();
  const { data: before } = await supabase
    .from("checklist_templates")
    .select("id")
    .eq("device_type_id", deviceTypeId)
    .eq("active", true)
    .maybeSingle();

  const { data: id, error } = await supabase.rpc("save_checklist_template", {
    p_device_type: deviceTypeId,
    p_name: parsed.data.name,
    p_items: parsed.data.items,
    p_verified: parsed.data.verified,
  });
  if (error || !id) return { ok: false, error: databaseErrorCode(error) };

  const { data: saved } = await supabase
    .from("checklist_templates")
    .select("version")
    .eq("id", id)
    .single();

  revalidateTypes();
  return { ok: true, data: { version: saved?.version ?? 1, created: before?.id !== id } };
}
