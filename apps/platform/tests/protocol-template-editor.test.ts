import { describe, expect, it } from "vitest";
import { DEFAULT_PROTOCOL_TEMPLATE } from "@/lib/protocol-template/default-template";
import {
  BLOCK_TYPES,
  addBlock,
  canAdd,
  duplicateBlock,
  moveBlock,
  newBlock,
  record,
  redo,
  removeBlock,
  richToText,
  shiftBlock,
  startHistory,
  templateIssues,
  textToRich,
  undo,
  updateBlock,
  HISTORY_LIMIT,
} from "@/lib/protocol-template/editor";
import { templateSchema, type BlockOf, type ProtocolTemplate } from "@/lib/protocol-template/schema";

// The protocol template editor's logic (part 22, stage B).

const base = (): ProtocolTemplate => structuredClone(DEFAULT_PROTOCOL_TEMPLATE);
const ids = (template: ProtocolTemplate) => template.blocks.map((block) => block.id);

describe("protocol template editor: blocks", () => {
  it("every new block is valid on its own", () => {
    for (const type of BLOCK_TYPES) {
      const template = { ...base(), blocks: type === "header" ? [newBlock("header", "h")] : [base().blocks[0]!, newBlock(type, "x")] };
      expect(templateSchema.safeParse(template).success, type).toBe(true);
    }
  });

  it("adds after the selected block with a free id, or at the end", () => {
    const { template, id } = addBlock(base(), "devices", "header");
    expect(id).toBe("devices-2");
    expect(ids(template).slice(0, 3)).toEqual(["header", "devices-2", "parties"]);
    const end = addBlock(template, "pageBreak");
    expect(end.id).toBe("pagebreak");
    expect(ids(end.template).at(-1)).toBe("pagebreak");
    expect(templateSchema.safeParse(end.template).success).toBe(true);
  });

  it("allows one header only, and no more than the limit of blocks", () => {
    expect(canAdd(base(), "header")).toBe(false);
    expect(addBlock(base(), "header").id).toBe("");
    let template = base();
    while (canAdd(template, "divider")) template = addBlock(template, "divider").template;
    expect(template.blocks.length).toBe(60);
    expect(templateSchema.safeParse(template).success).toBe(true);
  });

  it("moves, shifts by one and ignores moves out of range", () => {
    const moved = moveBlock(base(), 0, 2);
    expect(ids(moved).slice(0, 3)).toEqual(["parties", "devices", "header"]);
    expect(ids(shiftBlock(base(), "defects", -1)).slice(2, 4)).toEqual(["defects", "devices"]);
    expect(shiftBlock(base(), "header", -1)).toEqual(base());
    expect(shiftBlock(base(), "signatures", 1)).toEqual(base());
    expect(moveBlock(base(), 0, 99)).toEqual(base());
  });

  it("copies a block right below it, never the header", () => {
    const { template, id } = duplicateBlock(base(), "devices");
    expect(id).toBe("devices-2");
    expect(ids(template).slice(2, 4)).toEqual(["devices", "devices-2"]);
    expect({ ...template.blocks[3]!, id: "devices" }).toEqual(template.blocks[2]);
    // A copy is its own: changing it leaves the original alone.
    const changed = updateBlock<BlockOf<"devices">>(template, "devices-2", (block) => ({ ...block, summary: false }));
    expect((changed.blocks[2] as BlockOf<"devices">).summary).toBe(true);
    expect(duplicateBlock(base(), "header").id).toBe("");
  });

  it("removes a block, never the header", () => {
    expect(ids(removeBlock(base(), "notes"))).not.toContain("notes");
    expect(removeBlock(base(), "header")).toEqual(base());
  });
});

describe("protocol template editor: text", () => {
  it("turns paragraphs separated by an empty line into the text tree and back", () => {
    const rich = textToRich("První odstavec.\nDruhý řádek.\n\n\n  Druhý odstavec. \n\n");
    expect(rich).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "První odstavec.\nDruhý řádek." }] },
      { type: "paragraph", content: [{ type: "text", text: "  Druhý odstavec." }] },
    ]);
    expect(richToText(rich)).toBe("První odstavec.\nDruhý řádek.\n\n  Druhý odstavec.");
    expect(textToRich("   \n\n ")).toEqual([]);
    expect(
      richToText([{ type: "list", ordered: false, items: [[{ type: "text", text: "a" }], [{ type: "text", text: "b" }]] }]),
    ).toBe("- a\n- b");
  });
});

describe("protocol template editor: undo and redo", () => {
  it("undoes and redoes changes; a new change drops what was undone", () => {
    const first = removeBlock(base(), "notes");
    const second = removeBlock(first, "defects");
    let history = record(record(startHistory(base()), first, null, 0), second, null, 10);
    history = undo(history);
    expect(history.present).toBe(first);
    history = undo(history);
    expect(history.present).toEqual(base());
    expect(undo(history)).toBe(history);
    history = redo(history);
    expect(history.present).toBe(first);
    const other = removeBlock(first, "signatures");
    history = record(history, other, null, 20);
    expect(history.future).toEqual([]);
    expect(redo(history)).toBe(history);
  });

  it("typing into one field is one step", () => {
    const rename = (title: string) =>
      updateBlock<BlockOf<"devices">>(base(), "devices", (block) => ({ ...block, title }));
    let history = startHistory(base());
    history = record(history, rename("V"), "devices.title", 1000);
    history = record(history, rename("Vý"), "devices.title", 1500);
    history = record(history, rename("Výs"), "devices.title", 2200);
    expect(history.past.length).toBe(1);
    // After a pause, or in another field, a new step.
    history = record(history, rename("Výsl"), "devices.title", 5000);
    expect(history.past.length).toBe(2);
    history = record(history, rename("Výsl"), "notes.title", 5100);
    expect(history.past.length).toBe(3);
    expect(undo(history).present).toEqual(rename("Výsl"));
  });

  it("keeps a limited number of steps", () => {
    let history = startHistory(base());
    for (let i = 0; i < HISTORY_LIMIT + 20; i++)
      history = record(
        history,
        updateBlock<BlockOf<"notes">>(history.present, "notes", (block) => ({ ...block, title: `Krok ${i}` })),
        null,
        i * 2000,
      );
    expect(history.past.length).toBe(HISTORY_LIMIT);
  });
});

describe("protocol template editor: issues", () => {
  it("names the block with a value out of range, and a missing header", () => {
    expect(templateIssues(base())).toEqual([]);
    const tooTall = updateBlock<BlockOf<"spacer">>(
      addBlock(base(), "spacer", "header").template,
      "spacer",
      (block) => ({ ...block, heightMm: 500 }),
    );
    expect(templateIssues(tooTall)).toEqual([
      expect.objectContaining({ kind: "invalid", blockId: "spacer", path: "blocks.1.heightMm" }),
    ]);
    const headless = { ...base(), blocks: base().blocks.slice(1) };
    expect(templateIssues(headless)).toEqual([{ kind: "problem", code: "headerMissing" }]);
  });
});

describe("protocol template editor: sample data for the preview", () => {
  it("fills every block with something, in the company's name", async () => {
    const { sampleInput } = await import("@/lib/protocol-template/sample-input");
    const { buildProtocol } = await import("@/lib/protocol");
    const { renderProtocolPdf } = await import("@/lib/pdf/protocol");
    const { translate } = await import("./fixtures/protocol-cases");
    const { pdfLayout } = await import("./support/pdf-layout");
    const cs = (await import("../messages/cs.json")).default;
    let template = base();
    for (const type of BLOCK_TYPES) if (type !== "header" && type !== "pageBreak") template = addBlock(template, type).template;
    const input = sampleInput(
      {
        name: "Revize Vzor",
        legalName: null,
        companyId: "11223344",
        vatId: null,
        address: "Vzorová 1, Praha",
        email: "info@vzor.example",
        phone: null,
        footer: null,
        timeZone: "Europe/Prague",
        scanLocation: true,
      },
      "cs",
      cs.protocolTemplates.sample,
      new Date("2026-10-28T10:00:00Z"),
    );
    const model = buildProtocol(input, translate("cs"));
    expect(model.counts).toEqual({ total: 5, passed: 3, failed: 1, notChecked: 1, defects: 2 });
    const text = (await pdfLayout(await renderProtocolPdf(model, {}, template)))
      .flatMap((page) => page.text.map((item) => item.s))
      .join(" ");
    for (const expected of ["Revize Vzor", "IČO: 11223344", "Bytové družstvo Lipová", "HP-2402", "Kotelna zamčená", "Plomba chybí", "Tlak (bar)"])
      expect(text, expected).toContain(expected);
  });
});
