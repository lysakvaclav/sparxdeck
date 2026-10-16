"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";
import { databaseErrorCode, zodFieldErrors, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { customerSchema, idSchema } from "@/lib/validation";

function customerColumns(input: ReturnType<typeof customerSchema.parse>) {
  return {
    name: input.name,
    company_id: input.companyId,
    vat_id: input.vatId,
    contact_person: input.contactPerson,
    email: input.email,
    phone: input.phone,
    billing_address: input.billingAddress,
    notes: input.notes,
  };
}

function revalidateCustomers() {
  revalidatePath("/customers", "layout");
  revalidatePath("/sites", "layout");
}

export async function createCustomer(input: unknown): Promise<ActionResult<{ id: string }>> {
  const active = await requireManager();
  if (!active) return { ok: false, error: "forbidden" };
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) return zodFieldErrors(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .insert({
      ...customerColumns(parsed.data),
      organization_id: active.organization.id,
      created_by: active.membership.user_id,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: databaseErrorCode(error) };

  revalidateCustomers();
  return { ok: true, data: { id: data.id } };
}

export async function updateCustomer(id: string, input: unknown): Promise<ActionResult> {
  const active = await requireManager();
  if (!active) return { ok: false, error: "forbidden" };
  if (!idSchema.safeParse(id).success) return { ok: false, error: "notFound" };
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) return zodFieldErrors(parsed.error);

  const supabase = await createClient();
  // RLS limits this to the user's organization; .select() tells whether a row matched.
  const { data, error } = await supabase
    .from("customers")
    .update(customerColumns(parsed.data))
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");
  if (error) return { ok: false, error: databaseErrorCode(error) };
  if (!data?.length) return { ok: false, error: "notFound" };

  revalidateCustomers();
  return { ok: true };
}

/** Soft delete; the database hides the customer's sites as well. */
export async function deleteCustomer(id: string): Promise<ActionResult> {
  const active = await requireManager();
  if (!active) return { ok: false, error: "forbidden" };
  if (!idSchema.safeParse(id).success) return { ok: false, error: "notFound" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");
  if (error) return { ok: false, error: databaseErrorCode(error) };
  if (!data?.length) return { ok: false, error: "notFound" };

  revalidateCustomers();
  return { ok: true };
}
