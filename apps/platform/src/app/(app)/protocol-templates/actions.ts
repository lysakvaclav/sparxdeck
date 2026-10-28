"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";
import { databaseErrorCode, zodFieldErrors, type ActionResult } from "@/lib/errors";
import { DEFAULT_PROTOCOL_TEMPLATE } from "@/lib/protocol-template/default-template";
import { templateProblems } from "@/lib/protocol-template/requirements";
import { SAMPLE_TEMPLATES, sampleTemplate } from "@/lib/protocol-template/samples";
import { templateSchema, type ProtocolTemplate } from "@/lib/protocol-template/schema";
import { TEMPLATE_FILE_MAX_BYTES, readTemplateFile } from "@/lib/protocol-template/transfer";
import type { Json } from "@/lib/supabase/database.types";
import { templateLogoPng } from "@/lib/protocol-template-logo";
import { ORG_ASSETS_BUCKET, signedUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { idListSchema, idSchema, protocolTemplateNameSchema } from "@/lib/validation";

// Protocol templates (part 22): created as a draft (from the default, a sample,
// a copy of another template or a file), edited as a draft that is saved as
// the editor goes (stage B), published as a version that never changes,
// made the default, archived, assigned (stage D: database functions that
// check the role and keep the history). Owners and admins only; RLS and the
// functions say the same.

const createSchema = protocolTemplateNameSchema.extend({
  /** The template to copy; none = the default protocol (or a sample). */
  from: idSchema.nullable(),
  sample: z.enum(SAMPLE_TEMPLATES).nullable().optional(),
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
  // A copy keeps its source in the template's history.
  if (parsed.data.from) {
    const { data: copy, error } = await supabase.rpc("copy_protocol_template", {
      p_template: parsed.data.from,
      p_name: parsed.data.name,
    });
    if (error || !copy) return { ok: false, error: databaseErrorCode(error) };
    revalidatePath("/protocol-templates");
    return { ok: true, data: { id: copy } };
  }
  const content: unknown = parsed.data.sample ? sampleTemplate(parsed.data.sample) : DEFAULT_PROTOCOL_TEMPLATE;
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

const noteSchema = z.string().trim().min(1, "noteRequired").max(500, "tooLong");

/**
 * Publishes the draft as the template's next version, with a note. Only a
 * template with nothing left to fix (templateProblems) is published; issued
 * protocols keep the version they were drawn by.
 */
export async function publishProtocolTemplate(
  id: unknown,
  note: unknown,
): Promise<ActionResult<{ version: number }>> {
  const active = await requireManager();
  if (!active) return { ok: false, error: "forbidden" };
  const templateId = idSchema.safeParse(id);
  if (!templateId.success) return { ok: false, error: "notFound" };
  const parsedNote = noteSchema.safeParse(note);
  if (!parsedNote.success)
    return { ok: false, error: "noteRequired", fieldErrors: { note: "noteRequired" } };
  const supabase = await createClient();
  const template = templateSchema.safeParse(await contentOf(supabase, templateId.data));
  if (!template.success) return { ok: false, error: "templateInvalid" };
  if (templateProblems(template.data).length > 0) return { ok: false, error: "templateProblems" };
  const { data, error } = await supabase.rpc("publish_protocol_template", {
    p_template: templateId.data,
    p_content: template.data as unknown as Json,
    p_note: parsedNote.data,
  });
  if (error || data === null) return { ok: false, error: databaseErrorCode(error) };
  revalidatePath("/protocol-templates", "layout");
  return { ok: true, data: { version: data } };
}

/** One call to a template's management function (default, archive, restore). */
async function manage(
  fn: "set_default_protocol_template" | "archive_protocol_template" | "unarchive_protocol_template",
  id: unknown,
): Promise<ActionResult> {
  const active = await requireManager();
  if (!active) return { ok: false, error: "forbidden" };
  const templateId = idSchema.safeParse(id);
  if (!templateId.success) return { ok: false, error: "notFound" };
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, { p_template: templateId.data });
  if (error) return { ok: false, error: databaseErrorCode(error) };
  revalidatePath("/protocol-templates", "layout");
  return { ok: true };
}

export async function setDefaultProtocolTemplate(id: unknown) {
  return manage("set_default_protocol_template", id);
}

export async function archiveProtocolTemplate(id: unknown) {
  return manage("archive_protocol_template", id);
}

export async function unarchiveProtocolTemplate(id: unknown) {
  return manage("unarchive_protocol_template", id);
}

/** An older version becomes the template's draft again. */
export async function restoreProtocolTemplateVersion(versionId: unknown): Promise<ActionResult> {
  const active = await requireManager();
  if (!active) return { ok: false, error: "forbidden" };
  const id = idSchema.safeParse(versionId);
  if (!id.success) return { ok: false, error: "notFound" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("restore_protocol_template_version", { p_version: id.data });
  if (error) return { ok: false, error: databaseErrorCode(error) };
  revalidatePath("/protocol-templates", "layout");
  return { ok: true };
}

/** The customers and device types a published template is for. */
export async function setProtocolTemplateAssignments(
  id: unknown,
  customers: unknown,
  deviceTypes: unknown,
): Promise<ActionResult> {
  const active = await requireManager();
  if (!active) return { ok: false, error: "forbidden" };
  const templateId = idSchema.safeParse(id);
  const customerIds = idListSchema.safeParse(customers);
  const typeIds = idListSchema.safeParse(deviceTypes);
  if (!templateId.success || !customerIds.success || !typeIds.success)
    return { ok: false, error: "notFound" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_protocol_template_assignments", {
    p_template: templateId.data,
    p_customers: [...new Set(customerIds.data)],
    p_device_types: [...new Set(typeIds.data)],
  });
  if (error) return { ok: false, error: databaseErrorCode(error) };
  revalidatePath("/protocol-templates", "layout");
  return { ok: true };
}

/**
 * A template from a file exported elsewhere: read with limits, checked by the
 * schema, its own logo (if any) checked and converted again and stored in
 * this company's folder. It arrives as a draft.
 */
export async function importProtocolTemplate(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const active = await requireManager();
  if (!active) return { ok: false, error: "forbidden" };
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "templateFileInvalid" };
  if (file.size > TEMPLATE_FILE_MAX_BYTES) return { ok: false, error: "fileTooLarge" };
  const read = readTemplateFile(await file.text());
  if (!read.ok) return { ok: false, error: read.error };

  const supabase = await createClient();
  let template: ProtocolTemplate = read.template;
  const header = template.blocks.find((block) => block.type === "header");
  if (header?.type === "header" && header.logo.source === "template") {
    let path: string | null = null;
    if (read.logo) {
      const logo = await templateLogoPng(new Uint8Array(Buffer.from(read.logo, "base64")));
      if ("png" in logo) {
        path = `${active.organization.id}/protocol-templates/${randomUUID()}.png`;
        const { error } = await supabase.storage
          .from(ORG_ASSETS_BUCKET)
          .upload(path, logo.png, { contentType: "image/png", upsert: false });
        if (error) path = null;
      }
    }
    // Without a usable logo of its own, the template shows the company's.
    template = {
      ...template,
      blocks: template.blocks.map((block) =>
        block.type === "header"
          ? {
              ...block,
              logo: path
                ? { ...block.logo, path }
                : { ...block.logo, source: undefined, path: undefined },
            }
          : block,
      ),
    };
  }
  const chosen = formData.get("name");
  const name = (typeof chosen === "string" ? chosen.trim() : "") || read.name;
  if (!name) return { ok: false, error: "required", fieldErrors: { name: "required" } };
  const { data, error } = await supabase.rpc("import_protocol_template", {
    p_name: name.slice(0, 120),
    p_description: read.description,
    p_content: template as unknown as Json,
  });
  if (error || !data) return { ok: false, error: databaseErrorCode(error) };
  revalidatePath("/protocol-templates");
  return { ok: true, data: { id: data } };
}
