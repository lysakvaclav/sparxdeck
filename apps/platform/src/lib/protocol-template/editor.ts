import { DEFAULT_PROTOCOL_TEMPLATE } from "./default-template";
import { templateProblems, type TemplateProblem } from "./requirements";
import {
  templateSchema,
  TEMPLATE_LIMITS,
  type BlockOf,
  type ProtocolTemplate,
  type RichText,
  type TemplateBlock,
  type TemplateBlockType,
} from "./schema";

// The protocol template editor's logic (part 22, stage B), pure so it is
// tested without a browser: new blocks, adding, moving, copying and removing
// them, undo and redo, and what keeps a template from being published.

/** The blocks in the order the editor offers them. */
export const BLOCK_TYPES: readonly TemplateBlockType[] = [
  "header",
  "parties",
  "summary",
  "devices",
  "checklist",
  "defects",
  "gallery",
  "notes",
  "text",
  "table",
  "signatures",
  "divider",
  "spacer",
  "pageBreak",
];

const defaultBlock = <T extends TemplateBlockType>(type: T) =>
  DEFAULT_PROTOCOL_TEMPLATE.blocks.find((block) => block.type === type) as BlockOf<T> | undefined;

/** A free id for a block of this type ("devices-2"). */
export function blockId(type: TemplateBlockType, template: ProtocolTemplate): string {
  const taken = new Set(template.blocks.map((block) => block.id));
  const base = type.toLowerCase();
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

/** A block of the type with sensible settings (as in the default template where it has one). */
export function newBlock(type: TemplateBlockType, id: string): TemplateBlock {
  const known = defaultBlock(type);
  if (known) return structuredClone({ ...known, id });
  switch (type) {
    case "summary":
      return { id, type, title: null, style: "table" };
    case "checklist":
      return { id, type, title: null, style: "compact" };
    case "gallery":
      return { id, type, title: null, source: "inspection", perRow: 3, max: 12, captions: true };
    case "text":
      return { id, type, title: null, variant: "normal", content: [] };
    case "table":
      return {
        id,
        type,
        title: null,
        columns: [
          { title: "", width: 50 },
          { title: "", width: 50 },
        ],
        rows: [["", ""]],
      };
    case "spacer":
      return { id, type, heightMm: 5 };
    case "divider":
    case "pageBreak":
      return { id, type };
    default:
      throw new Error(`no default for ${type}`);
  }
}

/** The header (the protocol's number and the issuing company) is one and stays. */
export const isLocked = (block: TemplateBlock) => block.type === "header";

export function canAdd(template: ProtocolTemplate, type: TemplateBlockType): boolean {
  if (template.blocks.length >= TEMPLATE_LIMITS.blocks) return false;
  return type !== "header" || !template.blocks.some((block) => block.type === "header");
}

const withBlocks = (template: ProtocolTemplate, blocks: TemplateBlock[]): ProtocolTemplate => ({
  ...template,
  blocks,
});

/** Adds a new block after `afterId` (or at the end); returns the template and the block's id. */
export function addBlock(
  template: ProtocolTemplate,
  type: TemplateBlockType,
  afterId?: string | null,
): { template: ProtocolTemplate; id: string } {
  if (!canAdd(template, type)) return { template, id: "" };
  const id = blockId(type, template);
  const block = newBlock(type, id);
  const index = afterId ? template.blocks.findIndex((item) => item.id === afterId) : -1;
  const blocks = [...template.blocks];
  blocks.splice(index === -1 ? blocks.length : index + 1, 0, block);
  return { template: withBlocks(template, blocks), id };
}

export function moveBlock(template: ProtocolTemplate, from: number, to: number): ProtocolTemplate {
  const count = template.blocks.length;
  if (from === to || from < 0 || to < 0 || from >= count || to >= count) return template;
  const blocks = [...template.blocks];
  const [moved] = blocks.splice(from, 1);
  blocks.splice(to, 0, moved!);
  return withBlocks(template, blocks);
}

/** Moves a block one place up (-1) or down (+1). */
export function shiftBlock(template: ProtocolTemplate, id: string, step: -1 | 1): ProtocolTemplate {
  const index = template.blocks.findIndex((block) => block.id === id);
  return index === -1 ? template : moveBlock(template, index, index + step);
}

/** A copy right below it; returns the copy's id (none for the header). */
export function duplicateBlock(
  template: ProtocolTemplate,
  id: string,
): { template: ProtocolTemplate; id: string } {
  const index = template.blocks.findIndex((block) => block.id === id);
  const block = template.blocks[index];
  if (!block || isLocked(block) || template.blocks.length >= TEMPLATE_LIMITS.blocks)
    return { template, id: "" };
  const copyId = blockId(block.type, template);
  const blocks = [...template.blocks];
  blocks.splice(index + 1, 0, { ...structuredClone(block), id: copyId });
  return { template: withBlocks(template, blocks), id: copyId };
}

export function removeBlock(template: ProtocolTemplate, id: string): ProtocolTemplate {
  const block = template.blocks.find((item) => item.id === id);
  if (!block || isLocked(block)) return template;
  return withBlocks(
    template,
    template.blocks.filter((item) => item.id !== id),
  );
}

export function updateBlock<T extends TemplateBlock>(
  template: ProtocolTemplate,
  id: string,
  change: (block: T) => T,
): ProtocolTemplate {
  return withBlocks(
    template,
    template.blocks.map((block) => (block.id === id ? change(block as T) : block)),
  );
}

// ---------------------------------------------------------------------------
// Plain text in a text block: paragraphs split by an empty line. The rich
// editor (stage C) keeps formatting; this keeps the words.
// ---------------------------------------------------------------------------

export function textToRich(text: string): RichText {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/^\n+|\s+$/g, ""))
    .filter((paragraph) => paragraph.trim() !== "")
    .slice(0, TEMPLATE_LIMITS.richNodes)
    .map((paragraph) => ({
      type: "paragraph" as const,
      content: [{ type: "text" as const, text: paragraph.slice(0, TEMPLATE_LIMITS.text) }],
    }));
}

export function richToText(content: RichText): string {
  return content
    .map((node) => {
      if (node.type === "list")
        return node.items
          .map((item, index) => `${node.ordered ? `${index + 1}.` : "-"} ${item.map((inline) => inline.text).join("")}`)
          .join("\n");
      return node.content.map((inline) => inline.text).join("");
    })
    .join("\n\n");
}

// ---------------------------------------------------------------------------
// Undo and redo
// ---------------------------------------------------------------------------

export type History = {
  past: ProtocolTemplate[];
  present: ProtocolTemplate;
  future: ProtocolTemplate[];
  /** Typing into one field within a moment is one step, not one per letter. */
  mergeKey: string | null;
  mergeAt: number;
};

export const HISTORY_LIMIT = 100;
const MERGE_MS = 1200;

export const startHistory = (template: ProtocolTemplate): History => ({
  past: [],
  present: template,
  future: [],
  mergeKey: null,
  mergeAt: 0,
});

/** A change; `mergeKey` joins quick changes of the same field into one step. */
export function record(
  history: History,
  next: ProtocolTemplate,
  mergeKey: string | null = null,
  now = Date.now(),
): History {
  if (next === history.present) return history;
  const merge = mergeKey !== null && mergeKey === history.mergeKey && now - history.mergeAt < MERGE_MS;
  return {
    past: merge ? history.past : [...history.past, history.present].slice(-HISTORY_LIMIT),
    present: next,
    future: [],
    mergeKey,
    mergeAt: now,
  };
}

export function undo(history: History): History {
  const previous = history.past.at(-1);
  if (!previous) return history;
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
    mergeKey: null,
    mergeAt: 0,
  };
}

export function redo(history: History): History {
  const [next, ...rest] = history.future;
  if (!next) return history;
  return {
    past: [...history.past, history.present],
    present: next,
    future: rest,
    mergeKey: null,
    mergeAt: 0,
  };
}

// ---------------------------------------------------------------------------
// What is wrong with a template
// ---------------------------------------------------------------------------

export type TemplateIssue =
  | (TemplateProblem & { kind: "problem" })
  | { kind: "invalid"; code: string; blockId?: string; path: string };

/**
 * Everything that keeps the template from being published: values outside
 * their limits (by block) and missing required elements.
 */
export function templateIssues(template: ProtocolTemplate): TemplateIssue[] {
  const parsed = templateSchema.safeParse(template);
  if (!parsed.success)
    return parsed.error.issues.map((issue) => {
      const [first, index] = issue.path;
      const blockId =
        first === "blocks" && typeof index === "number" ? template.blocks[index]?.id : undefined;
      return {
        kind: "invalid" as const,
        code: issue.message,
        path: issue.path.join("."),
        ...(blockId ? { blockId } : {}),
      };
    });
  return templateProblems(parsed.data).map((problem) => ({ kind: "problem" as const, ...problem }));
}
