import { safeLink, TEMPLATE_LIMITS, type Inline, type RichText } from "./schema";

// Formatted text of a protocol template (part 22, stage C) between the editor
// (TipTap's JSON: ProseMirror nodes) and the template (our small tree). Only
// paragraphs, headings 1–3, bullet and numbered lists, bold, italic and web or
// e-mail links pass; everything else the editor (or a paste) could hold is
// dropped here, and the template schema checks the result again.

export type EditorNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: EditorNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
};

function inlinesOf(nodes: EditorNode[] | undefined): Inline[] {
  const inlines: Inline[] = [];
  for (const node of nodes ?? []) {
    if (node.type === "hardBreak") {
      const last = inlines.at(-1);
      if (last) last.text += "\n";
      else inlines.push({ type: "text", text: "\n" });
      continue;
    }
    if (node.type !== "text" || !node.text) continue;
    const marks = node.marks ?? [];
    const href = marks.find((mark) => mark.type === "link")?.attrs?.href;
    const link = typeof href === "string" && safeLink.safeParse(href).success ? href : undefined;
    inlines.push({
      type: "text",
      text: node.text.slice(0, TEMPLATE_LIMITS.text),
      ...(marks.some((mark) => mark.type === "bold") ? { bold: true } : {}),
      ...(marks.some((mark) => mark.type === "italic") ? { italic: true } : {}),
      ...(link ? { link } : {}),
    });
  }
  return inlines.slice(0, TEMPLATE_LIMITS.inline);
}

/** A list item's text: its paragraphs one per line (nested lists are flattened). */
function itemInlines(item: EditorNode): Inline[] {
  const parts: Inline[] = [];
  for (const child of item.content ?? []) {
    const inlines =
      child.type === "bulletList" || child.type === "orderedList"
        ? (child.content ?? []).flatMap(itemInlines)
        : inlinesOf(child.content);
    if (inlines.length === 0) continue;
    if (parts.length > 0) parts.push({ type: "text", text: "\n" });
    parts.push(...inlines);
  }
  return parts.slice(0, TEMPLATE_LIMITS.inline);
}

/** The editor's document as the template's text. */
export function fromEditor(doc: EditorNode): RichText {
  const nodes: RichText = [];
  for (const node of doc.content ?? []) {
    if (node.type === "paragraph") nodes.push({ type: "paragraph", content: inlinesOf(node.content) });
    else if (node.type === "heading") {
      const level = Number(node.attrs?.level);
      nodes.push({
        type: "heading",
        level: level === 1 || level === 2 ? level : 3,
        content: inlinesOf(node.content),
      });
    } else if (node.type === "bulletList" || node.type === "orderedList") {
      const items = (node.content ?? []).map(itemInlines).filter((item) => item.length > 0).slice(0, 100);
      if (items.length > 0) nodes.push({ type: "list", ordered: node.type === "orderedList", items });
    }
  }
  // Empty paragraphs at the end are the editor's, not the text's.
  while (nodes.length > 0) {
    const last = nodes.at(-1)!;
    if (last.type === "paragraph" && last.content.every((inline) => !inline.text.trim())) nodes.pop();
    else break;
  }
  return nodes.slice(0, TEMPLATE_LIMITS.richNodes);
}

function editorText(inlines: Inline[]): EditorNode[] {
  const nodes: EditorNode[] = [];
  for (const inline of inlines) {
    const marks = [
      ...(inline.bold ? [{ type: "bold" }] : []),
      ...(inline.italic ? [{ type: "italic" }] : []),
      ...(inline.link ? [{ type: "link", attrs: { href: inline.link } }] : []),
    ];
    inline.text.split("\n").forEach((line, index) => {
      if (index > 0) nodes.push({ type: "hardBreak" });
      if (line) nodes.push({ type: "text", text: line, ...(marks.length ? { marks } : {}) });
    });
  }
  return nodes;
}

/** The template's text as the editor's document. */
export function toEditor(content: RichText): EditorNode {
  return {
    type: "doc",
    content: content.length
      ? content.map((node) => {
          if (node.type === "heading")
            return { type: "heading", attrs: { level: node.level }, content: editorText(node.content) };
          if (node.type === "list")
            return {
              type: node.ordered ? "orderedList" : "bulletList",
              content: node.items.map((item) => ({
                type: "listItem",
                content: [{ type: "paragraph", content: editorText(item) }],
              })),
            };
          return { type: "paragraph", content: editorText(node.content) };
        })
      : [{ type: "paragraph" }],
  };
}
