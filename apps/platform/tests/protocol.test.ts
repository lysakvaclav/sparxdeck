import fs from "node:fs";
import { createTranslator } from "next-intl";
import sharp from "sharp";
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
  version: 1,
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
  customerSignature: null,
};

describe("protocol numbers", () => {
  it("are the year and a four-digit sequence", () => {
    expect(protocolNumber(2026, 7)).toBe("2026-0007");
    expect(protocolNumber(2027, 12345)).toBe("2027-12345");
  });

  it("can read number-first or with a slash, per the organization's setting", () => {
    expect(protocolNumber(2026, 7, "number_year")).toBe("0007/2026");
    expect(protocolNumber(2026, 7, "year_slash_number")).toBe("2026/0007");
  });

  it("a slash never ends up in the file name", () => {
    const model = buildProtocol({ ...input, numberFormat: "number_year" }, translate("cs"));
    expect(model.number).toBe("0007/2026");
    expect(model.fileName).toBe("Protokol-0007-2026.pdf");
    expect(model.page(1, 1)).toBe("Protokol 0007/2026 · strana 1 z 1");
  });
});

describe("a reissued protocol and the customer's signature", () => {
  it("says which issue it replaces, with the same number", () => {
    const model = buildProtocol(
      { ...input, version: 2, previousIssuedAt: "2026-10-13T09:30:05Z" },
      translate("cs"),
    );
    expect(model.number).toBe("2026-0007");
    expect(model.facts.at(-1)).toEqual({
      label: "Verze",
      value: "2, nahrazuje vydání z 13. 10. 2026",
    });
    const first = buildProtocol(input, translate("cs"));
    expect(first.facts.map((fact) => fact.label)).not.toContain("Verze");
  });

  it("prints the customer's name and when they signed", () => {
    const model = buildProtocol(
      { ...input, customerSignature: { name: "Jana Malá", signedAt: "2026-10-13T09:31:00Z" } },
      translate("cs"),
    );
    expect(model.signatures[1]).toEqual({
      label: "Převzal(a) za zákazníka",
      name: "Jana Malá",
      signedAt: "13. 10. 2026",
    });
    const english = buildProtocol(
      {
        ...input,
        locale: "en",
        version: 3,
        previousIssuedAt: "2026-10-14T08:00:00Z",
        customerSignature: { name: null, signedAt: "2026-10-13T09:31:00Z" },
      },
      translate("en"),
    );
    expect(english.signatures[1]).toEqual({
      label: "Received for the customer",
      name: null,
      signedAt: "Oct 13, 2026",
    });
    expect(english.facts.at(-1)).toEqual({
      label: "Version",
      value: "3, replaces the issue of Oct 14, 2026",
    });
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

  it("a device left out gives its reason and the technician's note", () => {
    const left = buildProtocol(
      {
        ...input,
        checks: [
          check({
            labelNumber: 8,
            outcome: "not_checked",
            skipReason: "inaccessible",
            note: "Byt 12 zamčený",
            nextDueOn: "2026-11-01",
          }),
          check({ labelNumber: 9, outcome: "not_checked", skipReason: "missing", note: null }),
        ],
      },
      translate("cs"),
    );
    expect(left.devices[0]).toMatchObject({
      result: "Nepřístupné",
      nextDue: "—",
      details: ["Poznámka: Byt 12 zamčený"],
    });
    expect(left.devices[1]).toMatchObject({ result: "Nenalezeno" });
    expect(left.summary).toBe(
      "Zařízení celkem: 2. Vyhovuje: 0, nevyhovuje: 0, nezkontrolováno: 2.",
    );
  });

  it("lists the defects, notes, signatures and the footer", () => {
    expect(model.defects).toEqual([
      {
        number: "Z-0004",
        rawNumber: 4,
        device: "0005",
        description: "Tlakoměr (zjištěno opakovaně)",
        severity: "Drobná",
      },
      {
        number: "Z-0012",
        rawNumber: 12,
        device: "0005",
        description: "Plomba: chybí",
        severity: "Kritická",
      },
    ]);
    expect(model.notes).toBe("Klíče vráceny správci.");
    expect(model.signatures).toEqual([
      { label: "Revizi provedl(a)", name: "Tomáš Technik", signedAt: null },
      { label: "Převzal(a) za zákazníka", name: null, signedAt: null },
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
    const pdf = await renderProtocolPdf(buildProtocol(many, translate("cs")));
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    const pages = pdf.toString("latin1").match(/\/Type \/Page\b/g)?.length ?? 0;
    expect(pages).toBeGreaterThan(1);
    // A drawn signature and defect photos are drawn into it.
    // Two different images (the PDF stores identical ones only once).
    const image = (background: string) =>
      sharp({ create: { width: 90, height: 30, channels: 3, background } })
        .png()
        .toBuffer();
    const [ink, photo] = await Promise.all([image("#2b3a48"), image("#8a9ba8")]);
    const signed = buildProtocol(
      {
        ...input,
        version: 2,
        previousIssuedAt: "2026-10-13T09:30:05Z",
        customerSignature: { name: "Jana Malá", signedAt: "2026-10-13T09:31:00Z" },
      },
      translate("cs"),
    );
    const withImages = await renderProtocolPdf(signed, {
      signature: { data: ink, format: "png" },
      defectPhotos: new Map([[12, [{ data: photo, format: "png" }]]]),
    });
    expect(withImages.subarray(0, 5).toString()).toBe("%PDF-");
    const images = withImages.toString("latin1").match(/\/Subtype \/Image\b/g)?.length ?? 0;
    expect(images).toBeGreaterThanOrEqual(2);
    // PROTOCOL_SAMPLE=path writes the samples for a look in a PDF viewer.
    if (process.env.PROTOCOL_SAMPLE) {
      fs.writeFileSync(process.env.PROTOCOL_SAMPLE, pdf);
      const short = await renderProtocolPdf(buildProtocol(input, translate("cs")));
      fs.writeFileSync(process.env.PROTOCOL_SAMPLE.replace(".pdf", "-short.pdf"), short);
      fs.writeFileSync(process.env.PROTOCOL_SAMPLE.replace(".pdf", "-signed.pdf"), withImages);
    }
  });
});

describe("location of QR scans in the protocol", () => {
  const located: ProtocolInput = {
    ...input,
    scanLocation: true,
    checks: [
      check({ labelNumber: 1, scanLocation: { state: "matches", note: null } }),
      check({
        labelNumber: 2,
        scanLocation: { state: "mismatch", note: "  Sklep, bez signálu GPS " },
      }),
      check({ labelNumber: 3, scanLocation: { state: "unknown", note: null } }),
      // Opened without a scan.
      check({ labelNumber: 4, scanLocation: { state: null, note: null } }),
    ],
  };

  it("adds a column, a summary line and the note on accuracy", () => {
    const model = buildProtocol(located, translate("cs"));
    expect(model.scan).toEqual({
      column: "Poloha skenu",
      summary: "Poloha při skenu odpovídala budově u 1 z 4 zařízení.",
      disclaimer:
        "Poloha je orientační. Přesnost GPS uvnitř budov a ve sklepech může být nízká.",
    });
    expect(model.devices.map((device) => device.scan)).toEqual([
      "Odpovídá",
      "Neodpovídá",
      "Nezjištěna",
      "Nezjištěna",
    ]);
    expect(model.devices[1]!.details).toContain("Vysvětlení polohy: Sklep, bez signálu GPS");
  });

  it("speaks English", () => {
    const model = buildProtocol(located, translate("en"));
    expect(model.scan?.summary).toBe(
      "The location at scanning matched the building for 1 of 4 devices.",
    );
    expect(model.devices[0]!.scan).toBe("Matches");
  });

  it("is left out when the company doesn't record it and no check has a position", () => {
    const model = buildProtocol(
      { ...input, scanLocation: false, checks: [check({ labelNumber: 1 })] },
      translate("cs"),
    );
    expect(model.scan).toBeNull();
    expect(model.devices[0]!.scan).toBe("");
  });

  it("keeps positions recorded before the company switched it off", () => {
    const model = buildProtocol({ ...located, scanLocation: false }, translate("cs"));
    expect(model.scan?.summary).toContain("u 1 z 4");
  });

  it("renders into the PDF", async () => {
    const pdf = await renderProtocolPdf(buildProtocol(located, translate("cs")));
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
