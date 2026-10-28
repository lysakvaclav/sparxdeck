"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";
import { databaseErrorCode, zodFieldErrors, type ActionResult } from "@/lib/errors";
import { DEFAULT_PROTOCOL_TEMPLATE } from "@/lib/protocol-template/default-template";
import { templateSchema } from "@/lib/protocol-template/schema";
import type { Json } from "@/lib/supabase/database.types";
import { templateLogoPng } from "@/lib/protocol-template-logo";
import { ORG_ASSETS_BUCKET, signedUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { idSchema, protocolTemplateNameSchema } from "@/lib/validation";

// Protocol templates (part 22, stage B): created as a draft copied from the
// default or another template of the company, edited as a draft that is saved
// as the editor goes. Publishing (a new version that never changes) is a
// database function (stage D). Owners and admins only; RLS says the same.

const createSchema = protocolTemplateNameSchema.extend({
  /** The template to start from; none = the default protocol. */
  from: idSchema.nullable(),
});

/** The content a template is edited from: its draft, else its current version. */
async function contentOf(supabase: Awaited<ReturnType<typeof createClient>>, id: string) {
  const { data } = await supabase
    .from("protocol_templates")
    .select("draft, current_version_id")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  if (data.draft || !data.current_version_id) return data.draft;
  const { data: version } = await supabase
    .from("protocol_template_versions")
    .select("content")
    .eq("id", data.current_version_id)
    .maybeSingle();
  return version?.content ?? null;
}

export async function createProtocolTemplate(input: unknown): Promise<ActionResult<{ id: string }>> {
  const active = await requireManager();
  if (!active) return { ok: false, error: "forbidden" };
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return zodFieldErrors(parsed.error);

  const supabase = await createClient();
  let content: unknown = DEFAULT_PROTOCOL_TEMPLATE;
  if (parsed.data.from) {
    content = await contentOf(supabase, parsed.data.from);
    if (!content) return { ok: false, error: "notFound" };
  }
  const draft = templateSchema.safeParse(content);
  const { data, error } = await supabase
    .from("protocol_templates")
    .insert({
      organization_id: active.organization.id,
      name: parsed.data.name,
      description: parsed.data.description || null,
      // A source that no longer passes the schema starts from the default.
      draft: (draft.success ? draft.data : DEFAULT_PROTOCOL_TEMPLATE) as unknown as Json,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: databaseErrorCode(error) };
  revalidatePath("/protocol-templates");
  return { ok: true, data: { id: data.id } };
}

/** Stores the editor's draft. It must pass the schema (required elements may still be missing). */
export async function saveProtocolTemplateDraft(
  id: unknown,
  draft: unknown,
): Promise<ActionResult<{ savedAt: string }>> {
  const active = await requireManager();
  if (!active) return { ok: false, error: "forbidden" };
  const templateId = idSchema.safeParse(id);
  const parsed = templateSchema.safeParse(draft);
  if (!templateId.success) return { ok: false, error: "notFound" };
  if (!parsed.success) return { ok: false, error: "templateInvalid" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("protocol_templates")
    .update({ draft: parsed.data as unknown as Json })
    .eq("id", templateId.data)
    .neq("status", "archived")
    .select("draft_updated_at")
    .maybeSingle();
  if (error) return { ok: false, error: databaseErrorCode(error) };
  if (!data) return { ok: false, error: "notFound" };
  return { ok: true, data: { savedAt: data.draft_updated_at ?? new Date().toISOString() } };
}

/** Drops the draft: the template is edited from its published version again. */
export async function discardProtocolTemplateDraft(id: unknown): Promise<ActionResult> {
  const active = await requireManager();
  if (!active) return { ok: false, error: "forbidden" };
  const templateId = idSchema.safeParse(id);
  if (!templateId.success) return { ok: false, error: "notFound" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("protocol_templates")
    .update({ draft: null })
    .eq("id", templateId.data)
    // A template never published has nothing to go back to.
    .not("current_version_id", "is", null)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: databaseErrorCode(error) };
  if (!data) return { ok: false, error: "notFound" };
  revalidatePath(`/protocol-templates/${templateId.data}`);
  return { ok: true };
}

export async function renameProtocolTemplate(id: unknown, input: unknown): Promise<ActionResult> {
  const active = await requireManager();
  if (!active) return { ok: false, error: "forbidden" };
  const templateId = idSchema.safeParse(id);
  const parsed = protocolTemplateNameSchema.safeParse(input);
  if (!templateId.success) return { ok: false, error: "notFound" };
  if (!parsed.success) return zodFieldErrors(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("protocol_templates")
    .update({ name: parsed.data.name, description: parsed.data.description || null })
    .eq("id", templateId.data)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: databaseErrorCode(error) };
  if (!data) return { ok: false, error: "notFound" };
  revalidatePath("/protocol-templates", "layout");
  return { ok: true };
}

/**
 * A template's own logo (stage C): checked by its content, an SVG cleaned,
 * stored as a PNG in the company's folder. Returns its path (the editor puts
 * it into the header block) and a short-lived link to show it. Earlier logos
 * stay: published versions may draw them.
 */
export async function uploadProtocolTemplateLogo(
  id: unknown,
  formData: FormData,
): Promise<ActionResult<{ path: string; url: string | null }>> {
  const active = await requireManager();
  if (!active) return { ok: false, error: "forbidden" };
  const templateId = idSchema.safeParse(id);
  if (!templateId.success) return { ok: false, error: "notFound" };
  const supabase = await createClient();
  const { data: template } = await supabase
    .from("protocol_templates")
    .select("id")
    .eq("id", templateId.data)
    .eq("organization_id", active.organization.id)
    .maybeSingle();
  if (!template) return { ok: false, error: "notFound" };

  const file = formData.get("logo");
  if (!(file instanceof File)) return { ok: false, error: "fileTypeInvalid" };
  const result = await templateLogoPng(new Uint8Array(await file.arrayBuffer()));
  if ("error" in result) return { ok: false, error: result.error };

  const path = `${active.organization.id}/protocol-templates/${randomUUID()}.png`;
  const { error } = await supabase.storage
    .from(ORG_ASSETS_BUCKET)
    .upload(path, result.png, { contentType: "image/png", upsert: false });
  if (error) return { ok: false, error: "unexpected" };
  return { ok: true, data: { path, url: await signedUrl(path) } };
}
