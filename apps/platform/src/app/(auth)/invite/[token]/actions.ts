"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { databaseErrorCode, type ActionResult } from "@/lib/errors";
import { acceptInviteSchema } from "@/lib/validation";

export async function acceptInvitation(input: unknown): Promise<ActionResult> {
  const parsed = acceptInviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "required" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_invitation", {
    p_token: parsed.data.token,
    p_display_name: parsed.data.displayName,
  });
  if (error) return { ok: false, error: databaseErrorCode(error) };

  redirect("/");
}
