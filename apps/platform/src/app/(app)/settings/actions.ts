"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";
import { databaseErrorCode, zodFieldErrors as fieldErrors, type ActionResult } from "@/lib/errors";
import { MAX_LOGO_BYTES, ORG_ASSETS_BUCKET, sniffImage } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import {
  companyDetailsSchema,
  deadlineSettingsSchema,
  digestSettingsSchema,
  scanLocationSettingsSchema,
  protocolSettingsSchema,
  regionalSettingsSchema,
} from "@/lib/validation";

type OrganizationUpdate = Database["public"]["Tables"]["organizations"]["Update"];

async function requireManagerOrg() {
  return (await requireManager())?.organization ?? null;
}

async function updateOrganization(patch: OrganizationUpdate): Promise<ActionResult> {
  const organization = await requireManagerOrg();
  if (!organization) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  // RLS re-checks the role; .select() reveals whether a row was actually updated.
  const { data, error } = await supabase
    .from("organizations")
    .update(patch)
    .eq("id", organization.id)
    .select("id");
  if (error) return { ok: false, error: databaseErrorCode(error) };
  if (!data?.length) return { ok: false, error: "forbidden" };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function saveCompanyDetails(input: unknown): Promise<ActionResult> {
  const parsed = companyDetailsSchema.safeParse(input);
  if (!parsed.success) return fieldErrors(parsed.error);
  const { name, legalName, companyId, vatId, address, email, phone } = parsed.data;
  return updateOrganization({
    name,
    legal_name: legalName,
    company_id: companyId,
    vat_id: vatId,
    address,
    email,
    phone,
  });
}

export async function saveProtocolSettings(input: unknown): Promise<ActionResult> {
  const parsed = protocolSettingsSchema.safeParse(input);
  if (!parsed.success) return fieldErrors(parsed.error);
  return updateOrganization({
    protocol_footer_text: parsed.data.footer,
    protocol_number_format: parsed.data.numberFormat,
  });
}

export async function saveRegionalSettings(input: unknown): Promise<ActionResult> {
  const parsed = regionalSettingsSchema.safeParse(input);
  if (!parsed.success) return fieldErrors(parsed.error);
  if (!Intl.supportedValuesOf("timeZone").includes(parsed.data.timezone)) {
    return { ok: false, error: "timezoneInvalid", fieldErrors: { timezone: "timezoneInvalid" } };
  }
  return updateOrganization({
    default_locale: parsed.data.defaultLocale,
    timezone: parsed.data.timezone,
  });
}

export async function saveDeadlineSettings(input: unknown): Promise<ActionResult> {
  const parsed = deadlineSettingsSchema.safeParse(input);
  if (!parsed.success) return fieldErrors(parsed.error);
  return updateOrganization({ due_soon_days: parsed.data.dueSoonDays });
}

export async function saveDigestSettings(input: unknown): Promise<ActionResult> {
  const parsed = digestSettingsSchema.safeParse(input);
  if (!parsed.success) return fieldErrors(parsed.error);
  return updateOrganization({ weekly_digest: parsed.data.weeklyDigest });
}

export async function saveScanLocationSettings(input: unknown): Promise<ActionResult> {
  const parsed = scanLocationSettingsSchema.safeParse(input);
  if (!parsed.success) return fieldErrors(parsed.error);
  return updateOrganization({ scan_location_enabled: parsed.data.scanLocation });
}

export async function uploadLogo(formData: FormData): Promise<ActionResult> {
  const organization = await requireManagerOrg();
  if (!organization) return { ok: false, error: "forbidden" };

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "fileTypeInvalid" };
  if (file.size > MAX_LOGO_BYTES) return { ok: false, error: "fileTooLarge" };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffImage(bytes);
  if (!kind) return { ok: false, error: "fileTypeInvalid" };

  const supabase = await createClient();
  const path = `${organization.id}/logo-${randomUUID()}.${kind.ext}`;
  const { error: uploadError } = await supabase.storage
    .from(ORG_ASSETS_BUCKET)
    .upload(path, bytes, { contentType: kind.mime, upsert: false });
  if (uploadError) return { ok: false, error: "unexpected" };

  const result = await updateOrganization({ logo_path: path });
  if (!result.ok) {
    await supabase.storage.from(ORG_ASSETS_BUCKET).remove([path]);
    return result;
  }
  // Old logo is no longer referenced; existing PDFs embed their own copy.
  if (organization.logo_path) {
    await supabase.storage.from(ORG_ASSETS_BUCKET).remove([organization.logo_path]);
  }
  return { ok: true };
}

export async function removeLogo(): Promise<ActionResult> {
  const organization = await requireManagerOrg();
  if (!organization) return { ok: false, error: "forbidden" };
  if (!organization.logo_path) return { ok: true };

  const result = await updateOrganization({ logo_path: null });
  if (!result.ok) return result;
  const supabase = await createClient();
  await supabase.storage.from(ORG_ASSETS_BUCKET).remove([organization.logo_path]);
  return { ok: true };
}
