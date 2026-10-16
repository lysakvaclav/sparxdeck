"use server";

import { revalidatePath } from "next/cache";
import { getActiveMembership } from "@/lib/auth";
import { databaseErrorCode, zodFieldErrors, type ActionResult } from "@/lib/errors";
import { generateProtocol } from "@/lib/protocols";
import { createClient } from "@/lib/supabase/server";
import { completeInspectionSchema, idSchema } from "@/lib/validation";

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
  /** Defects created from failed answers. */
  defects: number;
  /** The protocol numbered on completion. */
  protocol: string | null;
};

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

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complete_inspection", {
    p_inspection: id,
    p_notes: parsed.data.notes,
  });
  if (error || !data) return { ok: false, error: databaseErrorCode(error) };
  const summary = data as CompletionSummary;
  // The PDF right away, so it can be handed over on site. If it fails, the
  // inspection stays completed and its page offers to create the PDF again.
  if (summary.protocol) await generateProtocol(summary.protocol);

  revalidatePath("/", "layout");
  return { ok: true, data: summary };
}
