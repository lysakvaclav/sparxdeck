"use server";

import { revalidatePath } from "next/cache";
import { requireMembership } from "@/lib/auth";
import { zodFieldErrors as fieldErrors, type ActionResult } from "@/lib/errors";
import { SCOPE_READ, SCOPE_WRITE } from "@/lib/mcp/config";
import { createPersonalToken as issuePersonalToken } from "@/lib/mcp/oauth";
import { createClient } from "@/lib/supabase/server";
import { idSchema, mcpSettingsSchema, personalTokenSchema } from "@/lib/validation";

/** The owner's switches: AI assistants for the company, and whether they may change things. */
export async function saveMcpSettings(input: unknown): Promise<ActionResult> {
  const parsed = mcpSettingsSchema.safeParse(input);
  if (!parsed.success) return fieldErrors(parsed.error);
  const { membership, organization } = await requireMembership();
  if (membership.role !== "owner") return { ok: false, error: "forbidden" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_mcp_settings", {
    p_organization: organization.id,
    p_enabled: parsed.data.enabled,
    p_write: parsed.data.write,
  });
  if (error) return { ok: false, error: error.code === "42501" ? "forbidden" : "unexpected" };
  revalidatePath("/assistants");
  return { ok: true };
}

/** A personal token for configuring an assistant by hand; the secret is shown only now. */
export async function createPersonalToken(input: unknown): Promise<ActionResult<{ token: string }>> {
  const parsed = personalTokenSchema.safeParse(input);
  if (!parsed.success) return fieldErrors(parsed.error);
  const { membership, organization } = await requireMembership();
  if (!organization.mcp_enabled) return { ok: false, error: "mcpDisabled" };
  const write = parsed.data.write && organization.mcp_write_enabled;
  const { token } = await issuePersonalToken({
    organizationId: organization.id,
    userId: membership.user_id,
    name: parsed.data.name,
    scopes: write ? [SCOPE_READ, SCOPE_WRITE] : [SCOPE_READ],
    days: Number(parsed.data.days),
  });
  revalidatePath("/assistants");
  return { ok: true, data: { token } };
}

/** Ends a connection: your own, or any of the company's for an owner or admin. */
export async function revokeMcpToken(id: string): Promise<ActionResult> {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "notFound" };
  await requireMembership();
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_mcp_token", { p_token: parsed.data });
  if (error) return { ok: false, error: "notFound" };
  revalidatePath("/assistants");
  return { ok: true };
}
