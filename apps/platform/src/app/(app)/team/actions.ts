"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { getActiveMembership, isManager } from "@/lib/auth";
import { emailEnabled, renderEmail, sendEmail } from "@/lib/email";
import { serverEnv } from "@/lib/env";
import { databaseErrorCode, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { generateToken, hashToken } from "@/lib/tokens";
import { inviteSchema } from "@/lib/validation";
import { z } from "zod";

type InviteResult = ActionResult<{ email: string; emailSent: boolean; link?: string }>;

export async function inviteMember(input: unknown): Promise<InviteResult> {
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "emailInvalid" };

  const active = await getActiveMembership();
  if (!active || !isManager(active.membership.role)) return { ok: false, error: "forbidden" };
  const { membership, organization } = active;
  const { email, role } = parsed.data;

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("memberships")
    .select("id")
    .eq("organization_id", organization.id)
    .eq("email", email)
    .maybeSingle();
  if (existing) return { ok: false, error: "alreadyInTeam" };

  const token = generateToken();
  // RLS re-checks that the caller is an owner/admin of this organization.
  const { error } = await supabase.from("invitations").insert({
    organization_id: organization.id,
    email,
    role,
    token_hash: hashToken(token),
    invited_by: membership.user_id,
  });
  if (error) return { ok: false, error: databaseErrorCode(error) };

  const link = new URL(`/invite/${token}`, serverEnv().NEXT_PUBLIC_APP_URL).toString();
  let emailSent = false;

  if (emailEnabled()) {
    // The invitee has no locale yet; use the organization's default language.
    const locale = organization.default_locale === "en" ? "en" : "cs";
    const t = await getTranslations({ locale, namespace: "email.invite" });
    const tRoles = await getTranslations({ locale, namespace: "roles" });
    const values = {
      organization: organization.name,
      inviter: membership.display_name,
      role: tRoles(role).toLowerCase(),
    };
    const { html, text } = renderEmail({
      heading: t("heading"),
      body: t("body", values),
      cta: t("cta"),
      url: link,
      footnote: t("expiry"),
    });
    emailSent = await sendEmail({ to: email, subject: t("subject", values), html, text });
  }

  revalidatePath("/team");
  // Without e-mail the link is returned once so the admin can share it by hand.
  return { ok: true, data: { email, emailSent, link: emailSent ? undefined : link } };
}

export async function revokeInvitation(invitationId: string): Promise<ActionResult> {
  const active = await getActiveMembership();
  if (!active || !isManager(active.membership.role)) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("invitations")
    .delete()
    .eq("id", invitationId)
    .eq("organization_id", active.organization.id);
  if (error) return { ok: false, error: databaseErrorCode(error) };

  revalidatePath("/team");
  return { ok: true };
}

const membershipId = z.uuid();

async function requireManager() {
  const active = await getActiveMembership();
  return active && isManager(active.membership.role) ? active : null;
}

export async function changeMemberRole(
  id: string,
  role: "admin" | "technician",
): Promise<ActionResult> {
  if (!membershipId.safeParse(id).success || !["admin", "technician"].includes(role)) {
    return { ok: false, error: "unexpected" };
  }
  if (!(await requireManager())) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("change_member_role", { p_membership: id, p_role: role });
  if (error) return { ok: false, error: databaseErrorCode(error) };

  revalidatePath("/team");
  return { ok: true };
}

export async function removeMember(id: string): Promise<ActionResult> {
  if (!membershipId.safeParse(id).success) return { ok: false, error: "unexpected" };
  if (!(await requireManager())) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_member", { p_membership: id });
  if (error) return { ok: false, error: databaseErrorCode(error) };

  revalidatePath("/team");
  return { ok: true };
}

export async function transferOwnership(id: string): Promise<ActionResult> {
  if (!membershipId.safeParse(id).success) return { ok: false, error: "unexpected" };
  const active = await getActiveMembership();
  if (active?.membership.role !== "owner") return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("transfer_ownership", { p_membership: id });
  if (error) return { ok: false, error: databaseErrorCode(error) };

  revalidatePath("/", "layout");
  return { ok: true };
}
