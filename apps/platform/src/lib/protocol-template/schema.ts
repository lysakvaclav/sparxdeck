import { z } from "zod";

// A protocol template (part 22): what the protocol PDF shows, in which order and
// how it looks, described as data. Never HTML, CSS or script: every field is a
// plain value with a limit, unknown keys are refused, and text is text (shown
// as written, never interpreted). The same schema checks a template in the
// editor, on the server before it is stored, and again before it is rendered,
// so a stored template that does not pass is never drawn.

export const TEMPLATE_SCHEMA_VERSION = 1;

/** Limits that keep a template (and the time to render it) reasonable. */
export const TEMPLATE_LIMITS = {
  blocks: 60,
  title: 120,
  text: 4000,
  richNodes: 200,
  inline: 400,
  link: 500,
  columns: 10,
  manualColumns: 8,
  manualRows: 60,
  cell: 300,
  signatures: 4,
  photosPerDefect: 6,
  galleryPhotos: 60,
} as const;

const blockId = z.string().regex(/^[a-z0-9-]{1,32}$/, "blockId");
const plain = (max: number) => z.string().max(max, "tooLong");
/** A heading in the template's own words; null = the protocol's own (translated) one. */
const title = plain(TEMPLATE_LIMITS.title).nullable();
const millimetres = (min: number, max: number) => z.number().min(min).max(max);

// ---------------------------------------------------------------------------
// Formatted text: a small tree like the editor's (paragraphs, headings, lists;
// bold, italic, links), never markup.
// ---------------------------------------------------------------------------

/** Only web and e-mail links; anything else (javascript:, data:, file:) is refused. */
export const safeLink = z
  .string()
  .max(TEMPLATE_LIMITS.link, "tooLong")
  .refine((value) => /^(https:\/\/|mailto:)[^\s<>"']+$/i.test(value), "unsafeLink");

export const inlineSchema = z.strictObject({
  type: z.literal("text"),
  text: plain(TEMPLATE_LIMITS.text).min(1),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  link: safeLink.optional(),
});

const inlines = z.array(inlineSchema).max(TEMPLATE_LIMITS.inline);

export const richNodeSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("paragraph"), content: inlines }),
  z.strictObject({
    type: z.literal("heading"),
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    content: inlines,
  }),
  z.strictObject({
    type: z.literal("list"),
    ordered: z.boolean(),
    items: z.array(inlines).min(1).max(100),
  }),
]);

export const richTextSchema = z.array(richNodeSchema).max(TEMPLATE_LIMITS.richNodes);

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

/** Everything a block has in common: its id (for the editor) and whether it is hidden. */
const common = { id: blockId, hidden: z.boolean().optional() };

export const LOGO_POSITIONS = ["left", "center", "right"] as const;
export const COMPANY_FIELDS = ["address", "ids", "contact"] as const;
export const CUSTOMER_FIELDS = ["billingAddress", "ids", "contact"] as const;
export const FACTS = ["date", "technician", "issued", "version"] as const;
export const DEVICE_COLUMNS = [
  "label",
  "type",
  "location",
  "serial",
  "manufacturer",
  "model",
  "year",
  "result",
  "nextDue",
  "checkedBy",
  "scan",
] as const;
export type DeviceColumnKey = (typeof DEVICE_COLUMNS)[number];
export const SIGNATURE_ROLES = ["technician", "customer", "other"] as const;
export const GALLERY_SOURCES = ["inspection", "defects", "all"] as const;

const columnsSchema = z
  .array(z.strictObject({ key: z.enum(DEVICE_COLUMNS), width: z.number().min(3).max(80) }))
  .min(1)
  .max(TEMPLATE_LIMITS.columns)
  .refine((columns) => new Set(columns.map((column) => column.key)).size === columns.length, "duplicateColumn");

const fieldList = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .array(z.enum(values))
    .max(values.length)
    .refine((list) => new Set(list).size === list.length, "duplicateField");

export const headerBlockSchema = z.strictObject({
  ...common,
  type: z.literal("header"),
  logo: z.strictObject({
    show: z.boolean(),
    position: z.enum(LOGO_POSITIONS),
    heightMm: millimetres(6, 40),
  }),
  /** The company's name always shows (it identifies who issued the protocol). */
  company: fieldList(COMPANY_FIELDS),
  title,
  /** The protocol's number always shows; the date of the inspection may. */
  date: z.boolean(),
});

export const partiesBlockSchema = z.strictObject({
  ...common,
  type: z.literal("parties"),
  customer: z.strictObject({ show: z.boolean(), fields: fieldList(CUSTOMER_FIELDS) }),
  site: z.strictObject({ show: z.boolean(), address: z.boolean() }),
  facts: fieldList(FACTS),
});

export const summaryBlockSchema = z.strictObject({
  ...common,
  type: z.literal("summary"),
  title,
  /** The overall result and the counts as a sentence, or as a small table. */
  style: z.enum(["sentence", "table"]),
});

export const devicesBlockSchema = z.strictObject({
  ...common,
  type: z.literal("devices"),
  title,
  /** The sentence with the counts above the table. */
  summary: z.boolean(),
  /** Widths are shares of the line; they are scaled to fill it. */
  columns: columnsSchema,
  /**
   * The columns when the protocol reports the position of QR scans; without it
   * a scan column is added to `columns` (and the widths scaled).
   */
  columnsWithScan: columnsSchema.nullable(),
  /** Findings, notes and the position's explanation under each device. */
  details: z.boolean(),
});

export const checklistBlockSchema = z.strictObject({
  ...common,
  type: z.literal("checklist"),
  title,
  /** Compact: one line per device; detailed: every question with its answer. */
  style: z.enum(["compact", "detailed"]),
});

export const defectsBlockSchema = z.strictObject({
  ...common,
  type: z.literal("defects"),
  title,
  photos: z.strictObject({
    perDefect: z.number().int().min(0).max(TEMPLATE_LIMITS.photosPerDefect),
    widthMm: millimetres(15, 80),
  }),
  /** Without defects: say so, or leave the block out. */
  whenEmpty: z.enum(["text", "hide"]),
});

export const galleryBlockSchema = z.strictObject({
  ...common,
  type: z.literal("gallery"),
  title,
  source: z.enum(GALLERY_SOURCES),
  perRow: z.number().int().min(1).max(6),
  max: z.number().int().min(1).max(TEMPLATE_LIMITS.galleryPhotos),
  captions: z.boolean(),
});

export const notesBlockSchema = z.strictObject({
  ...common,
  type: z.literal("notes"),
  title,
});

export const textBlockSchema = z.strictObject({
  ...common,
  type: z.literal("text"),
  title,
  /** "note": smaller and muted, for notices and the company's legal wording. */
  variant: z.enum(["normal", "note"]),
  content: richTextSchema,
});

export const tableBlockSchema = z
  .strictObject({
    ...common,
    type: z.literal("table"),
    title,
    columns: z
      .array(z.strictObject({ title: plain(TEMPLATE_LIMITS.title), width: z.number().min(3).max(80) }))
      .min(1)
      .max(TEMPLATE_LIMITS.manualColumns),
    rows: z
      .array(z.array(plain(TEMPLATE_LIMITS.cell)).max(TEMPLATE_LIMITS.manualColumns))
      .max(TEMPLATE_LIMITS.manualRows),
  })
  .refine((block) => block.rows.every((row) => row.length === block.columns.length), "rowLength");

export const signaturesBlockSchema = z.strictObject({
  ...common,
  type: z.literal("signatures"),
  fields: z
    .array(z.strictObject({ role: z.enum(SIGNATURE_ROLES), label: title }))
    .min(1)
    .max(TEMPLATE_LIMITS.signatures),
  /** The line under the boxes ("signature and stamp" etc.). */
  hint: z.boolean(),
});

export const dividerBlockSchema = z.strictObject({ ...common, type: z.literal("divider") });
export const spacerBlockSchema = z.strictObject({
  ...common,
  type: z.literal("spacer"),
  heightMm: millimetres(1, 100),
});
export const pageBreakBlockSchema = z.strictObject({ ...common, type: z.literal("pageBreak") });

export const blockSchema = z.discriminatedUnion("type", [
  headerBlockSchema,
  partiesBlockSchema,
  summaryBlockSchema,
  devicesBlockSchema,
  checklistBlockSchema,
  defectsBlockSchema,
  galleryBlockSchema,
  notesBlockSchema,
  textBlockSchema,
  tableBlockSchema,
  signaturesBlockSchema,
  dividerBlockSchema,
  spacerBlockSchema,
  pageBreakBlockSchema,
]);

export type TemplateBlock = z.infer<typeof blockSchema>;
export type TemplateBlockType = TemplateBlock["type"];
export type BlockOf<T extends TemplateBlockType> = Extract<TemplateBlock, { type: T }>;
export type RichText = z.infer<typeof richTextSchema>;
export type RichNode = z.infer<typeof richNodeSchema>;
export type Inline = z.infer<typeof inlineSchema>;

// ---------------------------------------------------------------------------
// The whole template
// ---------------------------------------------------------------------------

export const FONTS = ["noto-sans"] as const;

export const footerSchema = z.strictObject({
  /** The company's footer text from its settings, the template's own, or none. */
  text: z.enum(["organization", "custom", "none"]),
  custom: plain(TEMPLATE_LIMITS.text),
  /** "Protocol 2026-0007 · Page 1 of 2" on every page. */
  pageNumbers: z.boolean(),
});

export const templateSchema = z
  .strictObject({
    schema: z.literal(TEMPLATE_SCHEMA_VERSION),
    page: z.strictObject({
      size: z.literal("A4"),
      orientation: z.enum(["portrait", "landscape"]),
      margins: z.strictObject({
        top: millimetres(5, 40),
        right: millimetres(5, 40),
        bottom: millimetres(5, 40),
        left: millimetres(5, 40),
      }),
    }),
    style: z.strictObject({
      font: z.enum(FONTS),
      /** The body text size in points. */
      size: z.number().min(7).max(12),
    }),
    blocks: z.array(blockSchema).min(1).max(TEMPLATE_LIMITS.blocks),
    footer: footerSchema,
  })
  .superRefine((template, context) => {
    const ids = new Set<string>();
    template.blocks.forEach((block, index) => {
      if (ids.has(block.id))
        context.addIssue({ code: "custom", message: "duplicateBlockId", path: ["blocks", index, "id"] });
      ids.add(block.id);
    });
  });

export type ProtocolTemplate = z.infer<typeof templateSchema>;
