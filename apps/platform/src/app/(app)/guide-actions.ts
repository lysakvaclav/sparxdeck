"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";
import { databaseErrorCode, type ActionResult } from "@/lib/errors";
import { addSamplePlans } from "@/lib/sample-plans";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Getting started: sample data to try the app on, removable in one go, and the
// guide on the dashboard. Owners and admins only (the database checks too).

export async function createSampleData(): Promise<ActionResult<{ customerId: string }>> {
  const active = await requireManager();
  if (!active) return { ok: false, error: "forbidden" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_sample_data", {
    p_org: active.organization.id,
  });
  if (error || !data) return { ok: false, error: databaseErrorCode(error) };
  await addSamplePlans(active.organization.id, data);
  revalidatePath("/", "layout");
  return { ok: true, data: { customerId: data } };
}

/** Removes the sample customer with everything in it, files included. */
export async function removeSampleData(): Promise<ActionResult> {
  const active = await requireManager();
  if (!active) return { ok: false, error: "forbidden" };
  const supabase = await createClient();
  const { data: files, error } = await supabase.rpc("remove_sample_data", {
    p_org: active.organization.id,
  });
  if (error) return { ok: false, error: databaseErrorCode(error) };

  // The rows are gone; their photos and protocol PDFs go too (only the
  // service role may delete protocols, so the server does it for both).
  const byBucket = new Map<string, string[]>();
  for (const file of files ?? [])
    byBucket.set(file.bucket, [...(byBucket.get(file.bucket) ?? []), file.path]);
  const admin = createAdminClient();
  for (const [bucket, paths] of byBucket) {
    for (let start = 0; start < paths.length; start += 100) {
      const { error: removeError } = await admin.storage
        .from(bucket)
        .remove(paths.slice(start, start + 100));
      if (removeError) console.error("Sample files could not be removed", bucket, removeError);
    }
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Hides the guide on the dashboard for the whole company. */
export async function dismissGuide(): Promise<ActionResult> {
  const active = await requireManager();
  if (!active) return { ok: false, error: "forbidden" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .update({ guide_dismissed_at: new Date().toISOString() })
    .eq("id", active.organization.id)
    .select("id");
  if (error) return { ok: false, error: databaseErrorCode(error) };
  if (!data?.length) return { ok: false, error: "forbidden" };
  revalidatePath("/", "layout");
  return { ok: true };
}
