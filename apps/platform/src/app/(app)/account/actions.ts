"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { serverEnv } from "@/lib/env";
import { authErrorCode, type ActionResult } from "@/lib/errors";
import { passwordPolicyError } from "@/lib/password";
import { createClient } from "@/lib/supabase/server";
import { changeEmailSchema, changePasswordSchema, displayNameSchema } from "@/lib/validation";

export async function updateDisplayName(input: unknown): Promise<ActionResult> {
  const parsed = displayNameSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "required" };

  const user = await getUser();
  if (!user) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  // RLS limits this to the caller's own membership; only display_name is writable.
  const { error } = await supabase
    .from("memberships")
    .update({ display_name: parsed.data.displayName })
    .eq("user_id", user.id);
  if (error) return { ok: false, error: "unexpected" };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function changeEmail(input: unknown): Promise<ActionResult> {
  const parsed = changeEmailSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "emailInvalid" };

  const user = await getUser();
  if (!user) return { ok: false, error: "forbidden" };
  if (user.email?.toLowerCase() === parsed.data.email) return { ok: false, error: "sameEmail" };

  const supabase = await createClient();
  const redirect = new URL("/auth/callback", serverEnv().NEXT_PUBLIC_APP_URL);
  redirect.searchParams.set("next", "/account");
  const { error } = await supabase.auth.updateUser(
    { email: parsed.data.email },
    { emailRedirectTo: redirect.toString() },
  );
  if (error) return { ok: false, error: authErrorCode(error) };
  return { ok: true };
}

export async function changePassword(input: unknown): Promise<ActionResult> {
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "passwordMismatch" };

  const user = await getUser();
  if (!user?.email) return { ok: false, error: "forbidden" };

  const weak = passwordPolicyError(parsed.data.password, user.email);
  if (weak) return { ok: false, error: weak, fieldErrors: { password: weak } };

  const supabase = await createClient();
  // Re-authenticate with the current password so a left-open session can't be used
  // to take over the account.
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword,
  });
  if (verifyError) {
    const code = authErrorCode(verifyError);
    return code === "invalidCredentials"
      ? { ok: false, error: "wrongPassword", fieldErrors: { currentPassword: "wrongPassword" } }
      : { ok: false, error: code };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, error: authErrorCode(error) };
  return { ok: true };
}
