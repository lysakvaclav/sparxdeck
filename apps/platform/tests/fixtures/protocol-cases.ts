import { createTranslator } from "next-intl";
import sharp from "sharp";
import cs from "../../messages/cs.json";
import en from "../../messages/en.json";
import type { ProtocolAssets } from "@/lib/pdf/protocol";
import type { ProtocolCheck, ProtocolInput, Translate } from "@/lib/protocol";

// Inspections whose protocol PDF is compared with a stored reference
// (tests/protocol-golden.test.ts): the look of today's protocol, which the
// default protocol template must keep (part 22).

export const translate = (locale: "cs" | "en"): Translate =>
  createTranslator({
    locale,
    messages: locale === "cs" ? cs : en,
    namespace: "protocol.pdf",
  }) as unknown as Translate;

export const check = (values: Partial<ProtocolCheck>): ProtocolCheck => ({
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

export const BASE_INPUT: ProtocolInput = {
  locale: "cs",
  timeZone: "Europe/Prague",
  year: 2026,
  number: 7,
  version: 1,
  organization: {
    name: "Revize Novák",
    legalName: "Revize Novák s.r.o.",
    companyId: "12345678",
    vatId: "CZ12345678",
    address: "Lipová 1\n110 00 Praha 1",
    email: "info@revize-novak.cz",
    phone: "+420 777 123 456",
    footer: "Zapsáno v obchodním rejstříku vedeném Městským soudem v Praze, oddíl C, vložka 12345.\nBankovní spojení 123456789/0100.",
  },
  customer: {
    name: "Bytové družstvo Lipová",
    companyId: "87654321",
    vatId: null,
    contactPerson: "Jana Malá",
    billingAddress: "Lipová 12, Praha",
  },
  site: { name: "Lipová 12", address: "Lipová 12\nPraha 2" },
  startedAt: "2026-10-12T14:00:00Z",
  completedAt: "2026-10-13T09:30:00Z",
  generatedAt: "2026-10-13T09:30:05Z",
  completedBy: "Petr Novák",
  notes: "Klíče vráceny správci.\nPříští revize po dohodě v říjnu.",
  checks: [
    check({ labelNumber: 3, locationName: "1. patro", locationOrder: 2, serialNumber: "PG6-2231" }),
    check({
      labelNumber: 5,
      locationName: "Suterén",
      locationOrder: 1,
      outcome: "failed",
      note: "Přístroj za regálem",
      answers: [
        { question: "Tlak", type: "number", order: 2, pass: null, number: 12.5, text: null, note: null },
        { question: "Plomba", type: "pass_fail", order: 1, pass: false, number: null, text: null, note: "chybí" },
        { question: "Štítek", type: "pass_fail", order: 3, pass: true, number: null, text: null, note: null },
      ],
    }),
    check({ labelNumber: 1, outcome: "not_checked", skipReason: "inaccessible", checkedBy: null, note: "Zamčená kotelna" }),
    check({ labelNumber: 2, locationName: "Suterén", locationOrder: 1, checkedBy: "Jan Kolega" }),
  ],
  defects: [
    { number: 12, labelNumber: 5, description: "Plomba: chybí", severity: "critical", again: false },
    { number: 4, labelNumber: 5, description: "Tlakoměr ukazuje mimo zelené pole", severity: "minor", again: true },
  ],
  customerSignature: null,
};

const image = (background: string, width = 90, height = 30) =>
  sharp({ create: { width, height, channels: 3, background } }).png().toBuffer();

export type GoldenCase = { input: ProtocolInput; assets?: () => Promise<ProtocolAssets> };

export const GOLDEN_CASES: Record<string, GoldenCase> = {
  short: { input: BASE_INPUT },
  // Long enough for several pages: the table header repeats, rows never split.
  long: {
    input: {
      ...BASE_INPUT,
      checks: Array.from({ length: 120 }, (_, i) =>
        check({
          labelNumber: i + 1,
          locationName: `Patro ${Math.floor(i / 12) + 1}`,
          locationOrder: Math.floor(i / 12),
          serialNumber: `SN-${1000 + i}`,
          outcome: i % 9 === 4 ? "failed" : "passed",
          answers:
            i % 9 === 4
              ? [{ question: "Plomba", type: "pass_fail", order: 1, pass: false, number: null, text: null, note: "poškozená" }]
              : [],
        }),
      ),
    },
  },
  // Logo, the customer's signature, defect photos, a reissue, in English.
  signed: {
    input: {
      ...BASE_INPUT,
      locale: "en",
      version: 2,
      previousIssuedAt: "2026-10-13T09:30:05Z",
      generatedAt: "2026-10-20T08:00:00Z",
      customerSignature: { name: "Jana Malá", signedAt: "2026-10-13T09:31:00Z" },
    },
    assets: async () => {
      const [logo, ink, photoA, photoB] = await Promise.all([
        image("#29333c", 120, 60),
        image("#2b3a48"),
        image("#8a9ba8", 80, 60),
        image("#b0a090", 60, 80),
      ]);
      return {
        logo: { data: logo, format: "png" },
        signature: { data: ink, format: "png" },
        defectPhotos: new Map([
          [12, [{ data: photoA, format: "png" as const }, { data: photoB, format: "png" as const }]],
        ]),
      };
    },
  },
  // The column with the position of QR scans.
  scan: {
    input: {
      ...BASE_INPUT,
      scanLocation: true,
      checks: [
        check({ labelNumber: 1, scanLocation: { state: "matches", note: null } }),
        check({ labelNumber: 2, scanLocation: { state: "mismatch", note: "Sklep, bez signálu GPS" } }),
        check({ labelNumber: 3, scanLocation: { state: "unknown", note: null } }),
      ],
    },
  },
  // Nothing optional: no customer, building, defects, notes or footer.
  bare: {
    input: {
      ...BASE_INPUT,
      organization: { ...BASE_INPUT.organization, legalName: null, address: null, vatId: null, phone: null, footer: null },
      customer: null,
      site: null,
      notes: null,
      defects: [],
      checks: [check({ labelNumber: 9 })],
    },
  },
};
