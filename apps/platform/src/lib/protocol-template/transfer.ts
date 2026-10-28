import { templateSchema, type ProtocolTemplate } from "./schema";

// A protocol template as a file (part 22, stage D), to take it to another
// company: its name, description, content and its own logo (a PNG, carried
// in the file because the other company can't read this one's storage).
// A file coming in is never trusted: it is read with limits, the template
// must pass the schema, the logo is checked and converted again on the
// server, and a path to someone else's storage is dropped.

export const TEMPLATE_FILE_FORMAT = "sparxdeck-protocol-template";
export const TEMPLATE_FILE_VERSION = 1;
/** The content (≤ 512 kB) and a logo (≤ 2 MB, base64) with room around them. */
export const TEMPLATE_FILE_MAX_BYTES = 3_500_000;

export type TemplateFile = {
  format: typeof TEMPLATE_FILE_FORMAT;
  version: typeof TEMPLATE_FILE_VERSION;
  name: string;
  description: string;
  template: ProtocolTemplate;
  /** The template's own logo as base64 PNG; null when it uses the company's. */
  logo: string | null;
};

/** The template with its own logo's storage path removed (it means nothing elsewhere). */
export function withoutLogoPath(template: ProtocolTemplate): ProtocolTemplate {
  return {
    ...template,
    blocks: template.blocks.map((block) =>
      block.type === "header" && block.logo.path
        ? { ...block, logo: { ...block.logo, path: null } }
        : block,
    ),
  };
}

export function toTemplateFile(
  name: string,
  description: string | null,
  template: ProtocolTemplate,
  logo: string | null,
): TemplateFile {
  return {
    format: TEMPLATE_FILE_FORMAT,
    version: TEMPLATE_FILE_VERSION,
    name,
    description: description ?? "",
    template: withoutLogoPath(template),
    logo,
  };
}

export type ReadTemplateFile =
  | { ok: true; name: string; description: string; template: ProtocolTemplate; logo: string | null }
  | { ok: false; error: "fileTooLarge" | "templateFileInvalid" | "templateInvalid"; detail?: string };

/** Reads a file someone chose; refuses anything that isn't a valid template file. */
export function readTemplateFile(text: string): ReadTemplateFile {
  if (text.length > TEMPLATE_FILE_MAX_BYTES) return { ok: false, error: "fileTooLarge" };
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, error: "templateFileInvalid" };
  }
  if (!value || typeof value !== "object") return { ok: false, error: "templateFileInvalid" };
  const file = value as Partial<Record<keyof TemplateFile, unknown>>;
  if (file.format !== TEMPLATE_FILE_FORMAT || file.version !== TEMPLATE_FILE_VERSION)
    return { ok: false, error: "templateFileInvalid" };
  const template = templateSchema.safeParse(file.template);
  if (!template.success)
    return { ok: false, error: "templateInvalid", detail: template.error.issues[0]?.path.join(".") };
  const name = typeof file.name === "string" ? file.name.trim().slice(0, 120) : "";
  const description = typeof file.description === "string" ? file.description.trim().slice(0, 500) : "";
  const logo =
    typeof file.logo === "string" && /^[A-Za-z0-9+/]+={0,2}$/.test(file.logo) && file.logo.length <= 2_900_000
      ? file.logo
      : null;
  return { ok: true, name, description, template: withoutLogoPath(template.data), logo };
}
