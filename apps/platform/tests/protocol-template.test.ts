import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { renderProtocolPdf } from "@/lib/pdf/protocol";
import { buildProtocol } from "@/lib/protocol";
import { DEFAULT_PROTOCOL_TEMPLATE } from "@/lib/protocol-template/default-template";
import { templateProblems, usableTemplate } from "@/lib/protocol-template/requirements";
import { templateSchema, type ProtocolTemplate, type TemplateBlock } from "@/lib/protocol-template/schema";
import { BASE_INPUT, check, translate } from "./fixtures/protocol-cases";
import { pdfLayout } from "./support/pdf-layout";

// Protocol templates (part 22, stage A): the schema refuses what a template
// must never hold, the required elements stay, every block renders, and a
// long protocol pages cleanly.

const clone = (): ProtocolTemplate => structuredClone(DEFAULT_PROTOCOL_TEMPLATE);
const withBlocks = (...blocks: TemplateBlock[]): ProtocolTemplate => ({
  ...clone(),
  blocks: [clone().blocks[0]!, ...blocks],
});
const refused = (value: unknown) => expect(templateSchema.safeParse(value).success).toBe(false);

describe("protocol template schema", () => {
  it("accepts the default template", () => {
    expect(templateSchema.parse(DEFAULT_PROTOCOL_TEMPLATE)).toEqual(DEFAULT_PROTOCOL_TEMPLATE);
    expect(templateProblems(DEFAULT_PROTOCOL_TEMPLATE)).toEqual([]);
  });

  it("refuses keys it doesn't know (no smuggled markup, styles or scripts)", () => {
    refused({ ...clone(), html: "<script>alert(1)</script>" });
    refused({ ...clone(), style: { ...clone().style, css: "body{}" } });
    const header = { ...clone().blocks[0]!, onload: "alert(1)" };
    refused({ ...clone(), blocks: [header] });
  });

  it("refuses unknown block types, a missing schema version and wrong types", () => {
    refused({ ...clone(), blocks: [{ id: "x", type: "html", content: "<b>" }] });
    refused({ ...clone(), schema: 2 });
    const unversioned: Partial<ProtocolTemplate> = clone();
    delete unversioned.schema;
    refused(unversioned);
    refused({ ...clone(), style: { font: "noto-sans", size: "12px" } });
    refused({ ...clone(), style: { font: "Comic Sans", size: 10 } });
    refused("not a template");
    refused(null);
  });

  it("allows only web and e-mail links", () => {
    const text = (link: string): TemplateBlock => ({
      id: "t",
      type: "text",
      title: null,
      variant: "normal",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Klikni", link }] }],
    });
    expect(templateSchema.safeParse(withBlocks(text("https://example.cz/normy"))).success).toBe(true);
    expect(templateSchema.safeParse(withBlocks(text("mailto:info@example.cz"))).success).toBe(true);
    for (const link of [
      "javascript:alert(1)",
      "JaVaScRiPt:alert(1)",
      "data:text/html,<script>",
      "file:///etc/passwd",
      "http://169.254.169.254/latest",
      "https://example.cz/\"onmouseover",
      "//example.cz",
    ])
      expect(templateSchema.safeParse(withBlocks(text(link))).success, link).toBe(false);
  });

  it("keeps text as text: markup inside it is printed, not interpreted", async () => {
    const template = withBlocks({
      id: "t",
      type: "text",
      title: "<h1>Nadpis</h1>",
      variant: "normal",
      content: [{ type: "paragraph", content: [{ type: "text", text: "<script>alert(1)</script>" }] }],
    });
    expect(templateSchema.safeParse(template).success).toBe(true);
    const pdf = await renderProtocolPdf(buildProtocol(BASE_INPUT, translate("cs")), {}, template);
    const text = (await pdfLayout(pdf)).flatMap((page) => page.text.map((item) => item.s)).join(" ");
    expect(text).toContain("<script>alert(1)</script>");
    expect(text).toContain("<h1>Nadpis</h1>");
  });

  it("enforces limits and consistency", () => {
    refused({ ...clone(), blocks: [] });
    refused({ ...clone(), blocks: Array.from({ length: 61 }, (_, i) => ({ id: `d${i}`, type: "divider" })) });
    refused({ ...clone(), blocks: [clone().blocks[0]!, { id: "header", type: "divider" }] });
    refused(withBlocks({ id: "s", type: "spacer", heightMm: 500 }));
    refused({ ...clone(), page: { ...clone().page, margins: { top: 0, right: 15, bottom: 14, left: 15 } } });
    refused(
      withBlocks({
        id: "tb",
        type: "table",
        title: null,
        columns: [{ title: "A", width: 50 }, { title: "B", width: 50 }],
        rows: [["jen jedna buňka"]],
      }),
    );
    const devices = clone().blocks.find((block) => block.type === "devices")!;
    refused(
      withBlocks({
        ...devices,
        columns: [{ key: "label", width: 10 }, { key: "label", width: 10 }],
      } as TemplateBlock),
    );
    refused(withBlocks({ id: "BAD ID", type: "divider" }));
    refused(withBlocks({ id: "t", type: "text", title: "x".repeat(121), variant: "normal", content: [] }));
  });

  it("keeps the protocol's number and the issuing company (the header)", () => {
    const [, ...rest] = clone().blocks;
    expect(templateProblems({ ...clone(), blocks: rest })).toEqual([{ code: "headerMissing" }]);
    const hidden = clone();
    hidden.blocks[0] = { ...hidden.blocks[0]!, hidden: true };
    expect(templateProblems(hidden)).toEqual([{ code: "headerHidden", blockId: "header" }]);
    const twice = clone();
    twice.blocks.push({ ...twice.blocks[0]!, id: "header-2" });
    expect(templateProblems(twice)).toEqual([{ code: "headerTwice", blockId: "header-2" }]);
  });

  it("draws a stored template only when it is valid and complete", () => {
    const custom = withBlocks({ id: "d", type: "divider" });
    expect(usableTemplate(custom)).toEqual({ template: custom, fallback: false });
    expect(usableTemplate({ junk: true })).toEqual({ template: DEFAULT_PROTOCOL_TEMPLATE, fallback: true });
    expect(usableTemplate({ ...clone(), blocks: clone().blocks.slice(1) }).fallback).toBe(true);
    expect(usableTemplate(null).fallback).toBe(true);
  });
});

describe("protocol model for templates", () => {
  const model = buildProtocol(
    {
      ...BASE_INPUT,
      checks: [
        ...BASE_INPUT.checks,
        check({ labelNumber: 7, manufacturer: "Hasco", model: "P6Če", manufactureYear: 2019 }),
      ],
    },
    translate("cs"),
  );

  it("gives the overall result and the counts", () => {
    expect(model.result).toBe("1 zařízení nevyhovuje.");
    expect(model.counts).toEqual({ total: 5, passed: 3, failed: 1, notChecked: 1, defects: 2 });
    const passed = buildProtocol({ ...BASE_INPUT, checks: [check({})] }, translate("cs"));
    expect(passed.result).toBe("Všechna zkontrolovaná zařízení vyhovují.");
    const none = buildProtocol({ ...BASE_INPUT, checks: [check({ outcome: "not_checked" })] }, translate("en"));
    expect(none.result).toBe("No device was inspected.");
    const two = buildProtocol(
      { ...BASE_INPUT, checks: [check({ outcome: "failed" }), check({ labelNumber: 2, outcome: "failed" })] },
      translate("cs"),
    );
    expect(two.result).toBe("2 zařízení nevyhovují.");
  });

  it("offers the device's maker, model and year, and every answer", () => {
    const device = model.devices.find((row) => row.label === "0007")!;
    expect(device).toMatchObject({ manufacturer: "Hasco", model: "P6Če", year: "2019", checkedBy: "Tomáš Technik" });
    const failed = model.devices.find((row) => row.label === "0005")!;
    expect(failed.answers).toEqual([
      { question: "Plomba", value: "nevyhovuje (chybí)", failed: true },
      { question: "Tlak", value: "12,5", failed: false },
      { question: "Štítek", value: "vyhovuje", failed: false },
    ]);
    expect(model.devices.find((row) => row.label === "0003")!.manufacturer).toBe("—");
  });
});

describe("protocol PDF from a template", () => {
  const image = (background: string) =>
    sharp({ create: { width: 80, height: 60, channels: 3, background } }).png().toBuffer();

  it("draws every kind of block, on a landscape page", async () => {
    const [logo, photo, defect] = await Promise.all([image("#29333c"), image("#8a9ba8"), image("#b0a090")]);
    const template: ProtocolTemplate = {
      ...clone(),
      page: { size: "A4", orientation: "landscape", margins: { top: 10, right: 10, bottom: 10, left: 10 } },
      style: { font: "noto-sans", size: 9 },
      blocks: [
        {
          id: "header",
          type: "header",
          logo: { show: true, position: "right", heightMm: 12 },
          company: ["ids"],
          title: "Zpráva o kontrole",
          date: true,
        },
        {
          id: "parties",
          type: "parties",
          customer: { show: true, fields: ["contact"] },
          site: { show: false, address: false },
          facts: ["technician"],
        },
        { id: "summary", type: "summary", title: null, style: "table" },
        { id: "summary-2", type: "summary", title: "Výsledek", style: "sentence" },
        {
          id: "devices",
          type: "devices",
          title: "Přístroje",
          summary: false,
          columns: [
            { key: "label", width: 10 },
            { key: "manufacturer", width: 20 },
            { key: "year", width: 10 },
            { key: "result", width: 10 },
          ],
          columnsWithScan: null,
          details: false,
        },
        { id: "checklist", type: "checklist", title: null, style: "detailed" },
        { id: "checklist-2", type: "checklist", title: null, style: "compact" },
        { id: "defects", type: "defects", title: null, photos: { perDefect: 1, widthMm: 20 }, whenEmpty: "hide" },
        { id: "gallery", type: "gallery", title: null, source: "all", perRow: 4, max: 10, captions: true },
        { id: "notes", type: "notes", title: "Poznámka" },
        {
          id: "text",
          type: "text",
          title: "Použitá měřidla",
          variant: "normal",
          content: [
            { type: "heading", level: 2, content: [{ type: "text", text: "Kalibrace" }] },
            {
              type: "paragraph",
              content: [
                { type: "text", text: "Platnost do " },
                { type: "text", text: "31. 12. 2027", bold: true },
                { type: "text", text: ", podrobnosti na ", italic: true },
                { type: "text", text: "webu", link: "https://example.cz" },
              ],
            },
            { type: "list", ordered: true, items: [[{ type: "text", text: "Tlakoměr" }], [{ type: "text", text: "Váha" }]] },
          ],
        },
        {
          id: "table",
          type: "table",
          title: "Měřidla",
          columns: [{ title: "Přístroj", width: 20 }, { title: "Číslo", width: 10 }],
          rows: [["Tlakoměr", "T-12"], ["Váha", "V-3"]],
        },
        { id: "divider", type: "divider" },
        { id: "spacer", type: "spacer", heightMm: 5 },
        { id: "note", type: "text", title: null, variant: "note", content: [{ type: "paragraph", content: [{ type: "text", text: "Upozornění firmy." }] }] },
        { id: "break", type: "pageBreak" },
        {
          id: "signatures",
          type: "signatures",
          fields: [
            { role: "technician", label: null },
            { role: "customer", label: "Za objednatele" },
            { role: "other", label: null },
          ],
          hint: false,
        },
        { id: "hidden", type: "text", title: "Skrytý blok", hidden: true, variant: "normal", content: [] },
      ],
      footer: { text: "custom", custom: "Vlastní patička šablony", pageNumbers: true },
    };
    expect(templateSchema.safeParse(template).error?.issues).toBeUndefined();
    const model = buildProtocol(
      { ...BASE_INPUT, customerSignature: { name: "Jana Malá", signedAt: "2026-10-13T09:31:00Z" } },
      translate("cs"),
    );
    const pdf = await renderProtocolPdf(
      model,
      {
        logo: { data: logo, format: "png" },
        signature: { data: logo, format: "png" },
        defectPhotos: new Map([[12, [{ data: defect, format: "png" as const }]]]),
        inspectionPhotos: [{ image: { data: photo, format: "png" }, caption: "0005" }],
      },
      template,
    );
    const pages = await pdfLayout(pdf);
    expect(pages[0]!.width).toBeGreaterThan(pages[0]!.height);
    const text = pages.flatMap((page) => page.text.map((item) => item.s)).join("\n");
    for (const expected of [
      "Zpráva o kontrole",
      "2026-0007",
      "Celkový výsledek",
      "1 zařízení nevyhovuje.",
      "Přístroje",
      "Výrobce",
      "Výsledky kontrol",
      "Plomba",
      "Zjištěné závady",
      "Fotografie",
      "Použitá měřidla",
      "31. 12. 2027",
      "T-12",
      "Upozornění firmy.",
      "ZA OBJEDNATELE",
      "PODPIS",
      "Vlastní patička šablony",
    ])
      expect(text, expected).toContain(expected);
    expect(text).not.toContain("Skrytý blok");
    expect(text).not.toContain("Zapsáno v obchodním rejstříku");
    // The page break: the signatures start a page of their own.
    const last = pages.at(-1)!.text.map((item) => item.s);
    expect(last).toContain("REVIZI PROVEDL(A)");
    expect(last).not.toContain("Upozornění firmy.");
    // Logo, signature, the defect photo once in its block and once in the gallery, the inspection photo.
    expect(pages.flatMap((page) => page.images).length).toBe(5);
  });

  // react-pdf kept one parsed font per process: a protocol drawn after certain
  // others lost letters ("USTOMER", "yhovuje"). Every document gets its own.
  it("prints every letter, whatever was drawn before", async () => {
    const few = { ...clone(), blocks: [clone().blocks[0]!] };
    const texts = async () => {
      const pdf = await renderProtocolPdf(
        buildProtocol({ ...BASE_INPUT, locale: "en", checks: [check({ serialNumber: "SN-1" })] }, translate("en")),
      );
      return (await pdfLayout(pdf)).flatMap((page) => page.text.map((item) => item.s));
    };
    await renderProtocolPdf(buildProtocol(BASE_INPUT, translate("cs")), {}, few);
    const after = await texts();
    await Promise.all([
      renderProtocolPdf(buildProtocol(BASE_INPUT, translate("cs")), {}, few),
      renderProtocolPdf(buildProtocol(BASE_INPUT, translate("cs"))),
    ]);
    const concurrent = await Promise.all([texts(), texts()]);
    for (const text of [after, ...concurrent]) {
      expect(text).toContain("CUSTOMER");
      expect(text).toContain("SN-1");
      expect(text).toContain("Passed");
      expect(text).toContain("INSPECTION DATE");
    }
  });

  it("leaves out empty optional parts", async () => {
    const template = withBlocks(
      { id: "defects", type: "defects", title: null, photos: { perDefect: 0, widthMm: 20 }, whenEmpty: "hide" },
      { id: "gallery", type: "gallery", title: null, source: "inspection", perRow: 3, max: 6, captions: false },
      { id: "notes", type: "notes", title: null },
    );
    const model = buildProtocol({ ...BASE_INPUT, defects: [], notes: null }, translate("cs"));
    const text = (await pdfLayout(await renderProtocolPdf(model, {}, template)))
      .flatMap((page) => page.text.map((item) => item.s))
      .join(" ");
    expect(text).not.toContain("Zjištěné závady");
    expect(text).not.toContain("Fotografie");
    expect(text).not.toContain("Poznámka k revizi");
  });

  it("pages 300 devices: the table head on every page, no row split", async () => {
    const input = {
      ...BASE_INPUT,
      checks: Array.from({ length: 300 }, (_, i) =>
        check({
          labelNumber: i + 1,
          serialNumber: `SN-${10000 + i}`,
          outcome: i % 7 === 3 ? ("failed" as const) : ("passed" as const),
          answers:
            i % 7 === 3
              ? [{ question: "Plomba", type: "pass_fail" as const, order: 1, pass: false, number: null, text: null, note: "poškozená" }]
              : [],
        }),
      ),
    };
    const started = performance.now();
    const pdf = await renderProtocolPdf(buildProtocol(input, translate("cs")));
    const seconds = (performance.now() - started) / 1000;
    const pages = await pdfLayout(pdf);
    expect(pages.length).toBeGreaterThan(5);
    expect(seconds).toBeLessThan(20);
    const seen = new Map<string, number>();
    pages.forEach((page, index) => {
      const texts = page.text.map((item) => item.s);
      // Every page with devices starts the table with its head.
      if (texts.some((value) => /^SN-1\d{4}$/.test(value))) expect(texts, `page ${index + 1}`).toContain("Štítek");
      for (const item of page.text)
        if (/^SN-1\d{4}$/.test(item.s)) {
          const labelText = String(Number(item.s.slice(3)) - 10000 + 1).padStart(4, "0");
          // The row's label sits on the same page and line as its serial number.
          expect(page.text.some((other) => other.s === labelText && Math.abs(other.y - item.y) < 1), item.s).toBe(true);
          seen.set(item.s, (seen.get(item.s) ?? 0) + 1);
        }
    });
    expect(seen.size).toBe(300);
    expect([...seen.values()].every((times) => times === 1)).toBe(true);
    // A failed device's finding stays with its row (same page, just below it).
    for (const page of pages) {
      const findings = page.text.filter((item) => item.s.startsWith("Plomba: nevyhovuje"));
      for (const finding of findings)
        expect(page.text.some((item) => /^SN-1\d{4}$/.test(item.s) && item.y > finding.y && item.y - finding.y < 15)).toBe(true);
    }
  }, 60_000);
});
