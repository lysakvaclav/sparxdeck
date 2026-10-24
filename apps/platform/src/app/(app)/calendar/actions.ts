"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";
import { databaseErrorCode, zodFieldErrors, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { idSchema, inspectionPlanSchema } from "@/lib/validation";

// Owners and admins plan visits (RLS); every member sees them. The link to the
// inspection that carried a visit out is set by the database.

function revalidatePlans() {
  revalidatePath("/", "layout");
}

/** A foreign key refused the technician (not a member) or the building. */
function planError(error: {
  code?: string;
  message?: string;
}): Extract<ActionResult, { ok: false }> {
  if (error.code === "23503") {
    if (error.message?.includes("technician") || error.message?.includes("memberships"))
      return {
        ok: false,
        error: "memberNotFound",
        fieldErrors: { technicianId: "memberNotFound" },
      };
    return { ok: false, error: "notFound", fieldErrors: { siteId: "notFound" } };
  }
  return { ok: false, error: databaseErrorCode(error) };
}

export async function createPlan(input: unknown): Promise<ActionResult<{ id: string }>> {
  const active = await requireManager();
  if (!active) return { ok: false, error: "forbidden" };
  const parsed = inspectionPlanSchema.safeParse(input);
  if (!parsed.success) return zodFieldErrors(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inspection_plans")
    .insert({
      organization_id: active.organization.id,
      site_id: parsed.data.siteId,
      planned_on: parsed.data.plannedOn,
      technician_id: parsed.data.technicianId,
      note: parsed.data.note,
      created_by: active.membership.user_id,
    })
    .select("id")
    .single();
  if (error) return planError(error);
  if (!data) return { ok: false, error: "unexpected" };
  revalidatePlans();
  return { ok: true, data: { id: data.id } };
}

/** A visit not carried out yet can be moved, reassigned or noted differently. */
export async function updatePlan(id: string, input: unknown): Promise<ActionResult> {
  const active = await requireManager();
  if (!active) return { ok: false, error: "forbidden" };
  if (!idSchema.safeParse(id).success) return { ok: false, error: "notFound" };
  const parsed = inspectionPlanSchema.safeParse(input);
  if (!parsed.success) return zodFieldErrors(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inspection_plans")
    .update({
      site_id: parsed.data.siteId,
      planned_on: parsed.data.plannedOn,
      technician_id: parsed.data.technicianId,
      note: parsed.data.note,
    })
    .eq("id", id)
    .is("inspection_id", null)
    .select("id");
  if (error) return planError(error);
  if (!data?.length) return { ok: false, error: "notFound" };
  revalidatePlans();
  return { ok: true };
}

export async function deletePlan(id: string): Promise<ActionResult> {
  const active = await requireManager();
  if (!active) return { ok: false, error: "forbidden" };
  if (!idSchema.safeParse(id).success) return { ok: false, error: "notFound" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inspection_plans")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, error: databaseErrorCode(error) };
  if (!data?.length) return { ok: false, error: "notFound" };
  revalidatePlans();
  return { ok: true };
}
