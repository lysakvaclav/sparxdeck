"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { AUTHORIZE_FIELDS, checkAuthorizeRequest, clientRedirect } from "@/lib/mcp/authorize";
import { SCOPE_READ, SCOPE_WRITE, type McpScope } from "@/lib/mcp/config";
import { createAuthCode } from "@/lib/mcp/oauth";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation";

/**
 * The member's answer on the consent page. The request is checked again (the
 * form could be changed in the browser), the company must be theirs with AI
 * assistants on, and writing is granted only if asked for, ticked and allowed
 * by the owner.
 */
export async function answerAuthorization(formData: FormData) {
  const params = Object.fromEntries(
    AUTHORIZE_FIELDS.map((key) => [key, formData.get(key)?.toString() || undefined]),
  );
  const check = await checkAuthorizeRequest(params);
  if (check.kind === "redirect") redirect(check.url);
  if (check.kind === "page") redirect("/");
  const { request } = check;
  const decline = () =>
    redirect(
      clientRedirect(request.redirectUri, {
        error: "access_denied",
        error_description: "The user did not allow access",
        state: request.state,
      }),
    );

  if (formData.get("decision") !== "allow") decline();
  const user = await requireUser();
  const organizationId = idSchema.safeParse(formData.get("organization_id"));
  if (!organizationId.success) decline();

  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("memberships")
    .select("organization:organizations(id, mcp_enabled, mcp_write_enabled)")
    .eq("user_id", user.id)
    .eq("organization_id", organizationId.data!)
    .maybeSingle();
  const organization = membership?.organization as
    | { id: string; mcp_enabled: boolean; mcp_write_enabled: boolean }
    | null
    | undefined;
  if (!organization?.mcp_enabled) decline();

  const write =
    request.scopes.includes(SCOPE_WRITE) &&
    formData.get("allow_write") === "on" &&
    organization!.mcp_write_enabled;
  const scopes: McpScope[] = write ? [SCOPE_READ, SCOPE_WRITE] : [SCOPE_READ];
  const code = await createAuthCode({
    clientId: request.client.clientId,
    organizationId: organization!.id,
    userId: user.id,
    scopes,
    redirectUri: request.redirectUri,
    codeChallenge: request.codeChallenge,
    resource: request.resource,
  });
  redirect(clientRedirect(request.redirectUri, { code, state: request.state }));
}
