import type { ProtocolTemplate, TemplateBlock } from "./schema";

// What changed between two versions of a protocol template (part 22, stage
// D): blocks added, removed or changed (by their id), the order, and the
// template's page, look, language and footer.

export type TemplateDiff = {
  added: TemplateBlock[];
  removed: TemplateBlock[];
  changed: { before: TemplateBlock; after: TemplateBlock }[];
  /** The blocks both versions have are in another order. */
  reordered: boolean;
  settings: ("page" | "style" | "language" | "format" | "footer")[];
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function diffTemplates(before: ProtocolTemplate, after: ProtocolTemplate): TemplateDiff {
  const old = new Map(before.blocks.map((block) => [block.id, block]));
  const now = new Map(after.blocks.map((block) => [block.id, block]));
  const kept = (blocks: TemplateBlock[], other: Map<string, TemplateBlock>) =>
    blocks.filter((block) => other.has(block.id)).map((block) => block.id);
  const settings: TemplateDiff["settings"] = [];
  if (!same(before.page, after.page)) settings.push("page");
  if (!same(before.style, after.style)) settings.push("style");
  if ((before.language ?? "organization") !== (after.language ?? "organization")) settings.push("language");
  if ((before.format?.date ?? "medium") !== (after.format?.date ?? "medium")) settings.push("format");
  if (!same(before.footer, after.footer)) settings.push("footer");
  return {
    added: after.blocks.filter((block) => !old.has(block.id)),
    removed: before.blocks.filter((block) => !now.has(block.id)),
    changed: after.blocks.flatMap((block) => {
      const previous = old.get(block.id);
      return previous && !same(previous, block) ? [{ before: previous, after: block }] : [];
    }),
    reordered: !same(kept(before.blocks, now), kept(after.blocks, old)),
    settings,
  };
}

export const isEmptyDiff = (diff: TemplateDiff) =>
  diff.added.length + diff.removed.length + diff.changed.length + diff.settings.length === 0 && !diff.reordered;
