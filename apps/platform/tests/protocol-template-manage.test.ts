import { describe, expect, it } from "vitest";
import { renderProtocolPdf } from "@/lib/pdf/protocol";
import { buildProtocol } from "@/lib/protocol";
import { DEFAULT_PROTOCOL_TEMPLATE } from "@/lib/protocol-template/default-template";
import { diffTemplates, isEmptyDiff } from "@/lib/protocol-template/diff";
import { addBlock, moveBlock, removeBlock, updateBlock } from "@/lib/protocol-template/editor";
import { templateProblems } from "@/lib/protocol-template/requirements";
import { SAMPLE_TEMPLATES, sampleTemplate } from "@/lib/protocol-template/samples";
import { templateSchema, type BlockOf, type ProtocolTemplate } from "@/lib/protocol-template/schema";
import { TEMPLATE_FILE_FORMAT, readTemplateFile, toTemplateFile } from "@/lib/protocol-template/transfer";
import { BASE_INPUT, translate } from "./fixtures/protocol-cases";
import { pdfLayout } from "./support/pdf-layout";

// Protocol templates, stage D: comparing versions, the template file for
// export and import, and the sample templates.

const base = (): ProtocolTemplate => structuredClone(DEFAULT_PROTOCOL_TEMPLATE);

describe("comparing two versions", () => {
  it("finds nothing between equal templates", () => {
    expect(isEmptyDiff(diffTemplates(base(), base()))).toBe(true);
  });

  it("lists blocks added, removed and changed, the order and the settings", () => {
    let after = addBlock(base(), "divider").template;
    after = removeBlock(after, "notes");
    after = updateBlock<BlockOf<"devices">>(after, "devices", (block) => ({ ...block, summary: false }));
    after = moveBlock(after, 2, 3);
    after = { ...after, style: { ...after.style, accent: "#1d4f91" }, language: "en" };
    const diff = diffTemplates(base(), after);
    expect(diff.added.map((block) => block.id)).toEqual(["divider"]);
    expect(diff.removed.map((block) => block.id)).toEqual(["notes"]);
    expect(diff.changed.map((change) => change.after.id)).toEqual(["devices"]);
    expect(diff.reordered).toBe(true);
    expect(diff.settings).toEqual(["style", "language"]);
  });

  it("a language left to the company equals none", () => {
    expect(diffTemplates(base(), { ...base(), language: "organization" }).settings).toEqual([]);
  });
});

describe("the template file", () => {
  const logoPath = "6f1c2a7e-1111-4222-8333-944455556666/protocol-templates/0a1b2c3d-1111-4222-8333-944455556666.png";
  const withLogo = (): ProtocolTemplate => {
    const template = base();
    const header = template.blocks[0] as BlockOf<"header">;
    template.blocks[0] = { ...header, logo: { ...header.logo, source: "template", path: logoPath } };
    return template;
  };

  it("goes there and back, without the path into this company's storage", () => {
    const file = toTemplateFile("Firemní", "Popis", withLogo(), "iVBORw0KGgo=");
    expect(file.format).toBe(TEMPLATE_FILE_FORMAT);
    expect(JSON.stringify(file)).not.toContain(logoPath);
    const read = readTemplateFile(JSON.stringify(file));
    expect(read).toMatchObject({ ok: true, name: "Firemní", description: "Popis", logo: "iVBORw0KGgo=" });
    if (read.ok) expect((read.template.blocks[0] as BlockOf<"header">).logo).toMatchObject({ source: "template", path: null });
  });

  it("drops a storage path smuggled in, keeps nothing outside the schema", () => {
    const file = { ...toTemplateFile("X", "", base(), null), template: withLogo() };
    const read = readTemplateFile(JSON.stringify(file));
    expect(read.ok && (read.template.blocks[0] as BlockOf<"header">).logo.path).toBeNull();
    const smuggled = { ...file, template: { ...base(), script: "<script>alert(1)</script>" } };
    expect(readTemplateFile(JSON.stringify(smuggled))).toMatchObject({ ok: false, error: "templateInvalid" });
  });

  it("refuses what isn't a template file", () => {
    for (const text of ["", "nonsense", "null", "[]", JSON.stringify({ format: "other", version: 1 }), JSON.stringify({ ...toTemplateFile("X", "", base(), null), version: 2 })])
      expect(readTemplateFile(text), text).toMatchObject({ ok: false, error: "templateFileInvalid" });
    expect(readTemplateFile("x".repeat(3_500_001))).toMatchObject({ ok: false, error: "fileTooLarge" });
    const badTemplate = { ...toTemplateFile("X", "", base(), null), template: { ...base(), blocks: [] } };
    expect(readTemplateFile(JSON.stringify(badTemplate))).toMatchObject({ ok: false, error: "templateInvalid", detail: "blocks" });
    // A logo that isn't base64 is left out rather than trusted.
    const badLogo = { ...toTemplateFile("X", "", base(), null), logo: "<svg onload=alert(1)>" };
    expect(readTemplateFile(JSON.stringify(badLogo))).toMatchObject({ ok: true, logo: null });
  });
});

describe("sample templates", () => {
  for (const sample of SAMPLE_TEMPLATES)
    it(`${sample}: valid, publishable, drawn in Czech and English`, async () => {
      const template = sampleTemplate(sample);
      expect(templateSchema.safeParse(template).success).toBe(true);
      expect(templateProblems(template)).toEqual([]);
      for (const locale of ["cs", "en"] as const) {
        const model = buildProtocol({ ...BASE_INPUT, locale }, translate(locale));
        const pages = await pdfLayout(await renderProtocolPdf(model, {}, template));
        const text = pages.flatMap((page) => page.text.map((item) => item.s)).join(" ");
        expect(text).toContain("2026-0007");
        expect(text).toContain(locale === "cs" ? "Protokol o revizi" : "Inspection report");
      }
    });
});
