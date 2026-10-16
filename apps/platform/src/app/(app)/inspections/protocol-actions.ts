"use server";

import { revalidatePath } from "next/cache";
import { getActiveMembership } from "@/lib/auth";
import { emailEnabled } from "@/lib/email";
import { databaseErrorCode, zodFieldErrors, type ActionResult } from "@/lib/errors";
import { protocolNumber } from "@/lib/protocol";
import { emailProtocol, generateProtocol } from "@/lib/protocols";
import { createClient } from "@/lib/supabase/server";
import { idSchema, protocolEmailSchema } from "@/lib/validation";

// Every member hands protocols over: technicians on site, the office later.

/** Numbers the protocol if needed (older inspections) and creates its PDF. */
export async function createProtocol(
  inspectionId: string,
): Promise<ActionResult<{ number: string }>> {
  const active = await getActiveMembership();
  if (!active) return { ok: false, error: "forbidden" };
  if (!idSchema.safeParse(inspectionId).success) return { ok: false, error: "notFound" };

  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("ensure_protocol", {
    p_inspection: inspectionId,
  });
  if (error || !id) return { ok: false, error: databaseErrorCode(error) };
  const protocol = await generateProtocol(id);
  if (!protocol?.pdf_path) return { ok: false, error: "protocolFailed" };

  revalidatePath("/", "layout");
  return { ok: true, data: { number: protocolNumber(protocol.year, protocol.number) } };
}

/** E-mails the protocol's PDF and records who sent it where. */
export async function sendProtocol(protocolId: string, input: unknown): Promise<ActionResult> {
  const active = await getActiveMembership();
  if (!active) return { ok: false, error: "forbidden" };
  if (!idSchema.safeParse(protocolId).success) return { ok: false, error: "notFound" };
  const parsed = protocolEmailSchema.safeParse(input);
  if (!parsed.success) return zodFieldErrors(parsed.error);
  if (!emailEnabled()) return { ok: false, error: "emailDisabled" };

  const supabase = await createClient();
  const { data: protocol } = await supabase
    .from("protocols")
    .select("*")
    .eq("id", protocolId)
    .maybeSingle();
  if (!protocol) return { ok: false, error: "notFound" };
  if (!protocol.pdf_path) return { ok: false, error: "protocolMissing" };
  if (!(await emailProtocol(protocol, parsed.data.email)))
    return { ok: false, error: "emailFailed" };

  const { error } = await supabase.rpc("record_protocol_email", {
    p_protocol: protocol.id,
    p_recipient: parsed.data.email,
  });
  if (error) return { ok: false, error: databaseErrorCode(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}
