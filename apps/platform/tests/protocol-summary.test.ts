import fs from "node:fs";
import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import cs from "../messages/cs.json";
import en from "../messages/en.json";
import { renderProtocolSummaryPdf } from "@/lib/pdf/protocol-summary";
import type { Translate } from "@/lib/protocol";
import { buildProtocolSummary, type ProtocolSummaryInput } from "@/lib/protocol-summary";

const translate = (locale: "cs" | "en"): Translate =>
  createTranslator({
    locale,
    messages: locale === "cs" ? cs : en,
    namespace: "protocol.summaryPdf",
  }) as unknown as Translate;

const input: ProtocolSummaryInput = {
  locale: "cs",
  timeZone: "Europe/Prague",
  generatedAt: "2026-10-20T10:00:00Z",
  from: "2025-10-20",
  to: "2026-10-20",
  customerName: "Bytové družstvo Lipová",
  siteName: null,
  organization: { name: "Revize Novák", legalName: "Revize Novák s.r.o." },
  buildings: [
    {
      siteName: "Lipová 14",
      customerName: "Bytové družstvo Lipová",
      inspections: [],
      openDefects: [
        {
          number: 9,
          labelNumber: 4,
          description: "Tlakoměr",
          severity: "minor",
          openSince: "2026-03-02T08:00:00Z",
        },
      ],
    },
    {
      siteName: "Lipová 12",
      customerName: "Bytové družstvo Lipová",
      inspections: [
        {
          date: "2026-03-01T09:00:00Z",
          protocolNumber: "2026-0002",
          passed: 4,
          failed: 1,
          notChecked: 0,
        },
        {
          date: "2026-10-13T09:30:00Z",
          protocolNumber: "2026-0007",
          passed: 5,
          failed: 0,
          notChecked: 1,
        },
      ],
      openDefects: [
        {
          number: 12,
          labelNumber: 5,
          description: "Plomba: chybí",
          severity: "critical",
          openSince: "2026-10-13T09:30:00Z",
        },
        {
          number: 4,
          labelNumber: 2,
          description: "Štítek nečitelný",
          severity: "major",
          openSince: "2026-03-01T09:00:00Z",
        },
      ],
    },
  ],
};

describe("summary report", () => {
  const model = buildProtocolSummary(input, translate("cs"));

  it("heads with the company, the period and what it covers", () => {
    expect(model.title).toBe("Souhrnný protokol");
    expect(model.organizationName).toBe("Revize Novák s.r.o.");
    expect(model.period).toBe("Období: 20. 10. 2025 – 20. 10. 2026");
    expect(model.scope).toBe("Zákazník: Bytové družstvo Lipová");
    expect(model.summary).toBe("Budov: 2. Revizí: 2. Otevřených závad: 3.");
    expect(model.fileName).toBe("Souhrnny-protokol.pdf");
  });

  it("lists buildings by name, newest inspection first, defects by number", () => {
    expect(model.buildings.map((building) => building.siteName)).toEqual([
      "Lipová 12",
      "Lipová 14",
    ]);
    const [first] = model.buildings;
    expect(first!.inspections).toEqual([
      {
        date: "13. 10. 2026",
        number: "2026-0007",
        result: "Vyhovuje 5, nevyhovuje 0, nezkontrolováno 1",
      },
      {
        date: "1. 3. 2026",
        number: "2026-0002",
        result: "Vyhovuje 4, nevyhovuje 1, nezkontrolováno 0",
      },
    ]);
    expect(first!.openDefects.map((defect) => [defect.number, defect.device])).toEqual([
      ["Z-0004", "0002"],
      ["Z-0012", "0005"],
    ]);
    expect(first!.openDefects[1]).toMatchObject({ severity: "Kritická", since: "13. 10. 2026" });
  });

  it("names a building alone, or everything, and speaks English", () => {
    const english = buildProtocolSummary(
      { ...input, locale: "en", customerName: null, buildings: [] },
      translate("en"),
    );
    expect(english.scope).toBe("All customers");
    expect(english.summary).toBe("Buildings: 0. Inspections: 0. Open defects: 0.");
    expect(english.fileName).toBe("Summary-report.pdf");
    const site = buildProtocolSummary(
      { ...input, siteName: "Lipová 12" },
      translate("cs"),
    );
    expect(site.scope).toBe("Zákazník: Bytové družstvo Lipová · Budova: Lipová 12");
  });

  it("renders to a PDF", async () => {
    const pdf = await renderProtocolSummaryPdf(model);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    // PROTOCOL_SAMPLE=path writes a sample for a look in a PDF viewer.
    if (process.env.PROTOCOL_SAMPLE)
      fs.writeFileSync(process.env.PROTOCOL_SAMPLE.replace(".pdf", "-summary.pdf"), pdf);
    const empty = await renderProtocolSummaryPdf(
      buildProtocolSummary({ ...input, buildings: [] }, translate("cs")),
    );
    expect(empty.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
