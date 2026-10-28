import { describe, expect, it } from "vitest";
import { renderProtocolPdf } from "@/lib/pdf/protocol";
import { buildProtocol } from "@/lib/protocol";
import { conditionHolds } from "@/lib/protocol-template/conditions";
import { DEFAULT_PROTOCOL_TEMPLATE } from "@/lib/protocol-template/default-template";
import { contrastOnWhite, templateProblems, usableTemplate } from "@/lib/protocol-template/requirements";
import { templateSchema, type BlockOf, type ProtocolTemplate, type TemplateBlock } from "@/lib/protocol-template/schema";
import {
  VARIABLES,
  fillVariables,
  unknownVariables,
  variablesIn,
} from "@/lib/protocol-template/variables";
import { BASE_INPUT, check, translate } from "./fixtures/protocol-cases";
import { pdfLayout } from "./support/pdf-layout";

// Protocol templates, stage C: variables, conditions, fonts, colours, table
// styles, the language and the format of dates.

const base = (): ProtocolTemplate => structuredClone(DEFAULT_PROTOCOL_TEMPLATE);
const textBlock = (id: string, text: string, extra: Partial<BlockOf<"text">> = {}): TemplateBlock => ({
  id,
  type: "text",
  title: null,
  variant: "normal",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  ...extra,
});
const words = async (template: ProtocolTemplate, input = BASE_INPUT, dateStyle?: "long") => {
  const model = buildProtocol(input, translate(input.locale), { dateStyle });
  const pages = await pdfLayout(await renderProtocolPdf(model, {}, template));
  return pages.flatMap((page) => page.text.map((item) => item.s)).join(" ");
};

describe("template variables", () => {
  const model = buildProtocol(BASE_INPUT, translate("cs"));

  it("every variable has a value from the protocol", () => {
    expect(Object.keys(model.variables).sort()).toEqual([...VARIABLES].sort());
    expect(model.variables).toMatchObject({
      "firma.nazev": "Revize Novák s.r.o.",
      "firma.ico": "12345678",
      "zakaznik.nazev": "Bytové družstvo Lipová",
      "budova.adresa": "Lipová 12, Praha 2",
      "protokol.cislo": "2026-0007",
      "technik.jmeno": "Tomáš Technik",
      "vysledek.nevyhovuje": "1",
      "zavady.pocet": "2",
      "revize.datum": "12. 10. 2026 – 13. 10. 2026",
    });
  });

  it("are filled with any spacing; an unknown one stays as written", () => {
    expect(fillVariables("Zákazník {{zakaznik.nazev}}, {{ protokol.cislo }}.", model.variables)).toBe(
      "Zákazník Bytové družstvo Lipová, 2026-0007.",
    );
    expect(fillVariables("{{zakaznik.jmeno}} a {{nic}}", model.variables)).toBe("{{zakaznik.jmeno}} a {{nic}}");
    expect(variablesIn("a {{x.y}} b {{ firma.ico }}")).toEqual(["x.y", "firma.ico"]);
  });

  it("put values in as text: markup in the data stays text", async () => {
    const input = { ...BASE_INPUT, customer: { ...BASE_INPUT.customer!, name: "<b>{{firma.ico}}</b>" } };
    const text = await words({ ...base(), blocks: [base().blocks[0]!, textBlock("t", "Pro {{zakaznik.nazev}}.")] }, input);
    // The customer's name is printed literally; a variable inside a value isn't filled again.
    expect(text).toContain("Pro <b>{{firma.ico}}</b>.");
  });

  it("are reported when unknown, with their block (or the footer)", () => {
    const template = base();
    template.blocks.push(textBlock("t", "{{zakaznik.nazev}} {{zakaznik.telefon}}"));
    template.footer = { text: "custom", custom: "{{firma.web}}", pageNumbers: true };
    expect(unknownVariables(template)).toEqual([
      { blockId: "t", variable: "zakaznik.telefon" },
      { blockId: null, variable: "firma.web" },
    ]);
    expect(templateProblems(template).map((problem) => problem.code)).toEqual(["unknownVariable", "unknownVariable"]);
    // A draft with them is still drawn (only a missing header falls back).
    expect(usableTemplate(template).fallback).toBe(false);
  });

  it("fill headings, texts, table cells, signature labels and the footer", async () => {
    const template = base();
    template.blocks = [
      { ...(template.blocks[0] as BlockOf<"header">), title: "Zpráva {{protokol.cislo}}" },
      textBlock("t", "Revizi provedl {{technik.jmeno}}.", { title: "Pro {{zakaznik.nazev}}" }),
      {
        id: "tb",
        type: "table",
        title: null,
        columns: [{ title: "{{budova.nazev}}", width: 50 }, { title: "Počet", width: 50 }],
        rows: [["Závady", "{{zavady.pocet}}"]],
      },
      { id: "s", type: "signatures", fields: [{ role: "other", label: "Za {{firma.nazev}}" }], hint: false },
    ];
    template.footer = { text: "custom", custom: "IČO {{firma.ico}}", pageNumbers: true };
    const text = await words(template);
    for (const expected of [
      "Zpráva 2026-0007",
      "Pro Bytové družstvo Lipová",
      "Revizi provedl Tomáš Technik.",
      "Lipová 12",
      "ZA REVIZE NOVÁK S.R.O.",
      "IČO 12345678",
    ])
      expect(text, expected).toContain(expected);
    expect(text).not.toContain("{{");
  });
});

describe("block conditions", () => {
  const facts = (input = BASE_INPUT) => buildProtocol(input, translate("cs"));
  const clean = { ...BASE_INPUT, defects: [], checks: [check({})] };

  it("show a block only when its condition holds", () => {
    expect(conditionHolds(undefined, facts())).toBe(true);
    expect(conditionHolds({ when: "hasDefects" }, facts())).toBe(true);
    expect(conditionHolds({ when: "hasDefects" }, facts(clean))).toBe(false);
    expect(conditionHolds({ when: "noDefects" }, facts(clean))).toBe(true);
    expect(conditionHolds({ when: "failed" }, facts())).toBe(true);
    expect(conditionHolds({ when: "failed" }, facts(clean))).toBe(false);
    expect(conditionHolds({ when: "deviceType", type: " hasicí PŘÍSTROJ " }, facts())).toBe(true);
    expect(conditionHolds({ when: "deviceType", type: "Hydrant" }, facts())).toBe(false);
    expect(conditionHolds({ when: "notEmpty", variable: "zakaznik.kontakt" }, facts())).toBe(true);
    expect(conditionHolds({ when: "notEmpty", variable: "zakaznik.dic" }, facts())).toBe(false);
    expect(conditionHolds({ when: "notEmpty", variable: "neni.znama" }, facts())).toBe(false);
  });

  it("decide what the PDF shows", async () => {
    const template = base();
    template.blocks.push(
      textBlock("a", "Opravte závady do 30 dnů.", { condition: { when: "hasDefects" } }),
      textBlock("b", "Bez závad, děkujeme.", { condition: { when: "noDefects" } }),
      textBlock("c", "Hydranty zvlášť.", { condition: { when: "deviceType", type: "Hydrant" } }),
    );
    const withDefects = await words(template);
    expect(withDefects).toContain("Opravte závady do 30 dnů.");
    expect(withDefects).not.toContain("Bez závad, děkujeme.");
    expect(withDefects).not.toContain("Hydranty zvlášť.");
    const without = await words(template, clean);
    expect(without).toContain("Bez závad, děkujeme.");
    expect(without).not.toContain("Opravte závady");
  });

  it("can't hide the header", () => {
    const template = base();
    template.blocks[0] = { ...template.blocks[0]!, condition: { when: "failed" } };
    expect(templateProblems(template)).toEqual([{ code: "headerCondition", blockId: "header" }]);
    expect(usableTemplate(template).fallback).toBe(true);
  });

  it("are refused when malformed", () => {
    const bad = (condition: unknown) =>
      templateSchema.safeParse({ ...base(), blocks: [...base().blocks, { ...textBlock("x", "a"), condition }] }).success;
    expect(bad({ when: "hasDefects" })).toBe(true);
    expect(bad({ when: "always" })).toBe(false);
    expect(bad({ when: "deviceType", type: "" })).toBe(false);
    expect(bad({ when: "notEmpty", variable: "Zakaznik.Nazev" })).toBe(false);
    expect(bad({ when: "notEmpty", variable: "a.b", extra: 1 })).toBe(false);
  });
});

describe("the template's look", () => {
  it("draws every font, upright and italic, with Czech letters", async () => {
    for (const font of ["noto-sans", "noto-serif", "inter"] as const) {
      const template = { ...base(), style: { ...base().style, font } };
      template.blocks.push({
        id: "t",
        type: "text",
        title: null,
        variant: "normal",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Příliš žluťoučký kůň", italic: true }, { type: "text", text: " úpěl ďábelské ódy", bold: true, italic: true }] }],
      });
      const text = await words(template);
      expect(text, font).toContain("Příliš žluťoučký kůň");
      expect(text, font).toContain("úpěl ďábelské ódy");
    }
  });

  it("colours headings, the header's rule and table heads with the accent; tables in a grid, with zebra rows", async () => {
    const template: ProtocolTemplate = {
      ...base(),
      style: { ...base().style, accent: "#1d4f91", table: { borders: "grid", zebra: true } },
    };
    const model = buildProtocol(
      { ...BASE_INPUT, checks: Array.from({ length: 6 }, (_, i) => check({ labelNumber: i + 1 })) },
      translate("cs"),
    );
    const pages = await pdfLayout(await renderProtocolPdf(model, {}, template));
    const shapes = pages[0]!.shapes;
    const colours = new Set(shapes.map((shape) => shape.color));
    expect(colours).toContain("#1d4f91"); // the header's rule and the table head's line
    expect(colours).toContain("#dbe3ed"); // the accent's tint behind table heads
    expect(colours).toContain("#f4f4f4"); // zebra rows
    // Grid: vertical lines between columns.
    expect(shapes.some((shape) => shape.paint === "stroke" && shape.box[0] === shape.box[2] && shape.box[1] !== shape.box[3])).toBe(true);
    // Without lines: no rule under the rows.
    const none = { ...template, style: { ...template.style, accent: null, table: { borders: "none" as const, zebra: false } } };
    const plain = (await pdfLayout(await renderProtocolPdf(model, {}, none)))[0]!.shapes;
    expect(plain.filter((shape) => shape.color === "#9a9a9a" && shape.paint === "stroke").length).toBeLessThan(
      shapes.filter((shape) => shape.color === "#9a9a9a" && shape.paint === "stroke").length,
    );
  });

  it("refuses an accent too light to read", () => {
    expect(contrastOnWhite("#000000")).toBeCloseTo(21, 0);
    const light = { ...base(), style: { ...base().style, accent: "#ffcc00" } };
    expect(templateProblems(light)).toEqual([{ code: "accentContrast" }]);
    expect(templateProblems({ ...base(), style: { ...base().style, accent: "#1d4f91" } })).toEqual([]);
    expect(templateSchema.safeParse({ ...base(), style: { ...base().style, accent: "red" } }).success).toBe(false);
  });

  it("writes dates in the template's style", async () => {
    const text = await words(base(), BASE_INPUT, "long");
    expect(text).toContain("12. října 2026 – 13. října 2026");
    expect(text).toContain("13. října 2027");
  });

  it("needs a logo file when the template has its own logo", () => {
    const template = base();
    const header = template.blocks[0] as BlockOf<"header">;
    template.blocks[0] = { ...header, logo: { ...header.logo, source: "template", path: null } };
    expect(templateProblems(template)).toEqual([{ code: "logoMissing", blockId: "header" }]);
    const path = "6f1c2a7e-1111-4222-8333-944455556666/protocol-templates/0a1b2c3d-1111-4222-8333-944455556666.png";
    template.blocks[0] = { ...header, logo: { ...header.logo, source: "template", path } };
    expect(templateProblems(template)).toEqual([]);
    for (const bad of ["../etc/passwd", "https://example.com/logo.png", "6f1c2a7e-1111-4222-8333-944455556666/logo.png"])
      expect(
        templateSchema.safeParse({ ...template, blocks: [{ ...header, logo: { ...header.logo, source: "template", path: bad } }] }).success,
        bad,
      ).toBe(false);
  });
});

describe("formatted text between the editor and the template", async () => {
  const { fromEditor, toEditor } = await import("@/lib/protocol-template/rich-text");
  const text = (value: string, marks?: { type: string; attrs?: Record<string, unknown> }[]) => ({ type: "text", text: value, ...(marks ? { marks } : {}) });

  it("keeps paragraphs, headings, lists, bold, italic and safe links, both ways", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [text("Kalibrace")] },
        { type: "paragraph", content: [text("Platnost do "), text("31. 12. 2027", [{ type: "bold" }, { type: "italic" }]), { type: "hardBreak" }, text("viz "), text("web", [{ type: "link", attrs: { href: "https://example.cz" } }])] },
        { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [text("Tlakoměr")] }] }, { type: "listItem", content: [{ type: "paragraph", content: [text("Váha {{firma.nazev}}")] }] }] },
        { type: "paragraph" },
      ],
    };
    const rich = fromEditor(doc);
    expect(rich).toEqual([
      { type: "heading", level: 2, content: [{ type: "text", text: "Kalibrace" }] },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Platnost do " },
          { type: "text", text: "31. 12. 2027\n", bold: true, italic: true },
          { type: "text", text: "viz " },
          { type: "text", text: "web", link: "https://example.cz" },
        ],
      },
      { type: "list", ordered: false, items: [[{ type: "text", text: "Tlakoměr" }], [{ type: "text", text: "Váha {{firma.nazev}}" }]] },
    ]);
    expect(templateSchema.safeParse({ ...base(), blocks: [...base().blocks, textBlock("t", "x", { content: rich })] }).success).toBe(true);
    expect(fromEditor(toEditor(rich))).toEqual(rich);
  });

  it("drops what the template doesn't know: code, quotes, images, unsafe links", () => {
    const rich = fromEditor({
      type: "doc",
      content: [
        { type: "codeBlock", content: [text("rm -rf /")] },
        { type: "blockquote", content: [{ type: "paragraph", content: [text("citace")] }] },
        { type: "image", attrs: { src: "https://evil.example/x.png" } },
        { type: "paragraph", content: [text("klik", [{ type: "link", attrs: { href: "javascript:alert(1)" } }]), text("<b>tučně</b>", [{ type: "code" }])] },
        { type: "heading", attrs: { level: 6 }, content: [text("H6")] },
      ],
    });
    expect(rich).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "klik" }, { type: "text", text: "<b>tučně</b>" }] },
      { type: "heading", level: 3, content: [{ type: "text", text: "H6" }] },
    ]);
  });

  it("starts an empty text with one empty paragraph", () => {
    expect(toEditor([])).toEqual({ type: "doc", content: [{ type: "paragraph" }] });
    expect(fromEditor({ type: "doc", content: [{ type: "paragraph" }] })).toEqual([]);
  });
});
