"use server";

import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";
import { authErrorCode, type ActionResult } from "@/lib/errors";
import { safeNextPath } from "@/lib/safe-next";
import { passwordPolicyError } from "@/lib/password";
import {
  forgotPasswordSchema,
  magicLinkSchema,
  resetPasswordSchema,
  signupSchema,
} from "@/lib/validation";

function callbackUrl(next: string) {
  const url = new URL("/auth/callback", serverEnv().NEXT_PUBLIC_APP_URL);
  url.searchParams.set("next", safeNextPath(next));
  return url.toString();
}

export async function sendMagicLink(input: unknown, next?: string): Promise<ActionResult> {
  const parsed = magicLinkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "emailInvalid" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    // Magic links only sign existing users in; new users go through sign-up.
    options: { shouldCreateUser: false, emailRedirectTo: callbackUrl(next ?? "/") },
  });
  if (error?.status === 429) return { ok: false, error: "rateLimited" };
  // Anything else (including "no such user") is reported as success so the form
  // doesn't reveal who has an account.
  if (error) console.warn("Magic link not sent", error.code ?? error.status);
  return { ok: true };
}

export async function signUp(input: unknown, next?: string): Promise<ActionResult> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "required" };
  const weak = passwordPolicyError(parsed.data.password, parsed.data.email);
  if (weak) return { ok: false, error: weak, fieldErrors: { password: weak } };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: {
      emailRedirectTo: callbackUrl(next ?? "/onboarding"),
      // Lets e-mail templates speak the user's language.
      data: { locale: await getLocale() },
    },
  });
  if (error) return { ok: false, error: authErrorCode(error) };

  // With e-mail confirmation off (local setups), Supabase returns a session right away.
  if (data.session) redirect(safeNextPath(next, "/onboarding"));
  return { ok: true };
}

export async function requestPasswordReset(input: unknown): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "emailInvalid" };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: callbackUrl("/reset-password"),
  });
  if (error && error.status === 429) return { ok: false, error: "rateLimited" };
  // Always succeed otherwise: don't reveal whether the e-mail has an account.
  return { ok: true };
}

export async function updatePassword(input: unknown): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "passwordMismatch" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const weak = passwordPolicyError(parsed.data.password, user?.email);
  if (weak) return { ok: false, error: weak, fieldErrors: { password: weak } };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, error: authErrorCode(error) };

  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
