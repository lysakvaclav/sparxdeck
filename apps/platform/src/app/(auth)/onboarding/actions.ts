"use server";

import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { databaseErrorCode, type ActionResult } from "@/lib/errors";
import { onboardingSchema } from "@/lib/validation";

export async function createOrganization(input: unknown): Promise<ActionResult> {
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "required" };

  const supabase = await createClient();
  // The language also picks the language of the seeded sample template.
  const { error } = await supabase.rpc("create_organization", {
    p_name: parsed.data.organizationName,
    p_display_name: parsed.data.displayName,
    p_locale: await getLocale(),
  });
  if (error) {
    const code = databaseErrorCode(error);
    // Already set up (e.g. double submit): just continue into the app.
    if (code === "alreadyMember") redirect("/");
    return { ok: false, error: code };
  }

  redirect("/");
}
