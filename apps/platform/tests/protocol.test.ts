import fs from "node:fs";
import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import cs from "../messages/cs.json";
import en from "../messages/en.json";
import { renderProtocolPdf } from "@/lib/pdf/protocol";
import {
  buildProtocol,
  protocolNumber,
  type ProtocolCheck,
  type ProtocolInput,
  type Translate,
} from "@/lib/protocol";

const translate = (locale: "cs" | "en"): Translate =>
  createTranslator({
    locale,
    messages: locale === "cs" ? cs : en,
    namespace: "protocol.pdf",
  }) as unknown as Translate;

const check = (values: Partial<ProtocolCheck>): ProtocolCheck => ({
  labelNumber: 1,
  typeName: "Hasicí přístroj",
  locationName: null,
  locationOrder: null,
  serialNumber: null,
  outcome: "passed",
  nextDueOn: "2027-10-13",
  checkedBy: "Tomáš Technik",
  note: null,
  answers: [],
  ...values,
});

const input: ProtocolInput = {
  locale: "cs",
  timeZone: "Europe/Prague",
  year: 2026,
  number: 7,
  organization: {
    name: "Revize Novák",
    legalName: "Revize Novák s.r.o.",
    companyId: "12345678",
    vatId: null,
    address: "Lipová 1\n110 00 Praha 1",
    email: "info@revize-novak.cz",
    phone: null,
    footer: "Zapsáno v obchodním rejstříku.",
  },
  customer: {
    name: "Bytové družstvo Lipová",
    companyId: null,
    vatId: null,
    contactPerson: "Jana Malá",
    billingAddress: "Lipová 12, Praha",
  },
  site: { name: "Lipová 12", address: "Lipová 12\nPraha 2" },
  startedAt: "2026-10-12T14:00:00Z",
  completedAt: "2026-10-13T09:30:00Z",
  generatedAt: "2026-10-13T09:30:05Z",
  completedBy: "Petr Novák",
  notes: "  Klíče vráceny správci.  ",
  checks: [
    check({ labelNumber: 3, locationName: "1. patro", locationOrder: 2 }),
    check({
      labelNumber: 5,
      locationName: "Suterén",
      locationOrder: 1,
      outcome: "failed",
      note: "Přístroj za regálem",
      answers: [
        {
          question: "Tlak",
          type: "number",
          order: 2,
          pass: null,
          number: 12.5,
          text: null,
          note: null,
        },
        {
          question: "Plomba",
          type: "pass_fail",
          order: 1,
          pass: false,
          number: null,
          text: null,
          note: "chybí",
        },
        {
          question: "Štítek",
          type: "pass_fail",
          order: 3,
          pass: true,
          number: null,
          text: null,
          note: null,
        },
        {
          question: "Poznámka",
          type: "text",
          order: 4,
          pass: null,
          number: null,
          text: "  ",
          note: null,
        },
      ],
    }),
    check({ labelNumber: 1, outcome: "not_checked", checkedBy: null, nextDueOn: "2026-11-01" }),
    // First on the route, but Tomáš checked more devices: he signs.
    check({ labelNumber: 2, locationName: "Suterén", locationOrder: 1, checkedBy: "Jan Kolega" }),
  ],
  defects: [
    {
      number: 12,
      labelNumber: 5,
      description: "Plomba: chybí",
      severity: "critical",
      again: false,
    },
    { number: 4, labelNumber: 5, description: "Tlakoměr", severity: "minor", again: true },
  ],
};

describe("protocol numbers", () => {
  it("are the year and a four-digit sequence", () => {
    expect(protocolNumber(2026, 7)).toBe("2026-0007");
    expect(protocolNumber(2027, 12345)).toBe("2027-12345");
  });
});

describe("protocol content", () => {
  const model = buildProtocol(input, translate("cs"));

  it("heads with the company, the customer, the building and when", () => {
    expect(model.number).toBe("2026-0007");
    expect(model.fileName).toBe("Protokol-2026-0007.pdf");
    expect(model.organization).toEqual({
      name: "Revize Novák s.r.o.",
      lines: ["Lipová 1", "110 00 Praha 1", "IČO: 12345678", "info@revize-novak.cz"],
    });
    expect(model.parties).toEqual([
      {
        label: "Zákazník",
        name: "Bytové družstvo Lipová",
        lines: ["Lipová 12, Praha", "Kontaktní osoba: Jana Malá"],
      },
      { label: "Budova", name: "Lipová 12", lines: ["Lipová 12", "Praha 2"] },
    ]);
    expect(model.facts).toEqual([
      { label: "Datum revize", value: "12. 10. 2026 – 13. 10. 2026" },
      { label: "Revizi provedl(a)", value: "Tomáš Technik, Jan Kolega" },
      { label: "Vystaveno", value: "13. 10. 2026" },
    ]);
  });

  it("lists devices in route order with what was found", () => {
    expect(model.devices.map((device) => device.label)).toEqual(["0002", "0005", "0003", "0001"]);
    const failed = model.devices[1]!;
    expect(failed).toMatchObject({ result: "Nevyhovuje", failed: true, nextDue: "—" });
    expect(failed.details).toEqual([
      "Plomba: nevyhovuje (chybí)",
      "Tlak: 12,5",
      "Poznámka: Přístroj za regálem",
    ]);
    expect(model.devices[0]).toMatchObject({ result: "Vyhovuje", nextDue: "13. 10. 2027" });
    // Not checked: its due date didn't move, so none is printed.
    expect(model.devices[3]).toMatchObject({ result: "Nezkontrolováno", nextDue: "—" });
    expect(model.summary).toBe(
      "Zařízení celkem: 4. Vyhovuje: 2, nevyhovuje: 1, nezkontrolováno: 1.",
    );
  });

  it("lists the defects, notes, signatures and the footer", () => {
    expect(model.defects).toEqual([
      {
        number: "Z-0004",
        device: "0005",
        description: "Tlakoměr (zjištěno opakovaně)",
        severity: "Drobná",
      },
      { number: "Z-0012", device: "0005", description: "Plomba: chybí", severity: "Kritická" },
    ]);
    expect(model.notes).toBe("Klíče vráceny správci.");
    expect(model.signatures).toEqual([
      { label: "Revizi provedl(a)", name: "Tomáš Technik" },
      { label: "Převzal(a) za zákazníka", name: null },
    ]);
    expect(model.footer).toBe("Zapsáno v obchodním rejstříku.");
    expect(model.page(1, 2)).toBe("Protokol 2026-0007 · strana 1 z 2");
  });

  it("falls back to whoever completed it, and speaks English", () => {
    const english = buildProtocol(
      {
        ...input,
        locale: "en",
        customer: null,
        startedAt: input.completedAt,
        checks: [check({ checkedBy: null, outcome: "not_checked" })],
        defects: [],
        notes: null,
      },
      translate("en"),
    );
    expect(english.fileName).toBe("Report-2026-0007.pdf");
    expect(english.facts).toEqual([
      { label: "Inspection date", value: "Oct 13, 2026" },
      { label: "Inspected by", value: "Petr Novák" },
      { label: "Issued", value: "Oct 13, 2026" },
    ]);
    expect(english.parties[0]).toEqual({ label: "Customer", name: "—", lines: [] });
    expect(english.noDefects).toBe("The inspection found no defects.");
    expect(english.notes).toBeNull();
  });
});

describe("protocol PDF", () => {
  it("renders, and a long inspection continues on further pages", async () => {
    const many = {
      ...input,
      checks: Array.from({ length: 70 }, (_, i) =>
        check({ labelNumber: i + 1, outcome: i % 9 === 4 ? "failed" : "passed" }),
      ),
    };
    const pdf = await renderProtocolPdf(buildProtocol(many, translate("cs")), null);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    const pages = pdf.toString("latin1").match(/\/Type \/Page\b/g)?.length ?? 0;
    expect(pages).toBeGreaterThan(1);
    // PROTOCOL_SAMPLE=path writes the samples for a look in a PDF viewer.
    if (process.env.PROTOCOL_SAMPLE) {
      fs.writeFileSync(process.env.PROTOCOL_SAMPLE, pdf);
      const short = await renderProtocolPdf(buildProtocol(input, translate("cs")), null);
      fs.writeFileSync(process.env.PROTOCOL_SAMPLE.replace(".pdf", "-short.pdf"), short);
    }
  });
});
