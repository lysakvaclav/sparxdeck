import { describe, expect, it } from "vitest";
import {
  buildRows,
  cellText,
  decodeText,
  detectMapping,
  headerRowIndex,
  IMPORT_FIELDS,
  normalizeCompanyId,
  normalizeHeader,
  parseCsv,
  parseDate,
  parseYear,
  planImport,
  type DeviceTypeOption,
  type ExistingData,
} from "@/lib/import";

const types: DeviceTypeOption[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Hasicí přístroj",
    code: "fire_extinguisher",
  },
  { id: "22222222-2222-4222-8222-222222222222", name: "Hydrant", code: "hydrant" },
];

describe("columns", () => {
  it("headers are compared without case, accents and punctuation", () => {
    expect(normalizeHeader("Výr. č.")).toBe("vyr c");
    expect(normalizeHeader("  E-mail ")).toBe("e mail");
    expect(normalizeHeader("Datum poslední revize")).toBe("datum posledni revize");
  });

  it("recognizes a typical Czech list", () => {
    const mapping = detectMapping([
      "Zákazník",
      "IČO",
      "Objekt",
      "Adresa",
      "Umístění",
      "Druh",
      "Výr. č.",
      "Výrobce",
      "Rok výroby",
      "Poslední revize",
      "Hasivo",
      "Hmotnost náplně",
      "Poznámka",
    ]);
    expect(mapping).toEqual({
      customerName: 0,
      companyId: 1,
      siteName: 2,
      siteAddress: 3,
      locationName: 4,
      deviceType: 5,
      serialNumber: 6,
      manufacturer: 7,
      manufactureYear: 8,
      lastInspectionOn: 9,
      agent: 10,
      size: 11,
      notes: 12,
    });
  });

  it("recognizes English, prefers specific headers and uses a column once", () => {
    const mapping = detectMapping([
      "Customer",
      "Billing address",
      "Building",
      "Address",
      "Serial number",
      "Type of unit",
      "Last inspection",
    ]);
    expect(mapping.customerName).toBe(0);
    expect(mapping.customerAddress).toBe(1);
    expect(mapping.siteAddress).toBe(3);
    expect(mapping.serialNumber).toBe(4);
    expect(mapping.lastInspectionOn).toBe(6);
    // "Type of unit" starts with a known name.
    expect(mapping.deviceType).toBe(5);
    expect(new Set(Object.values(mapping)).size).toBe(Object.keys(mapping).length);
  });

  it("the template's headers map to every field, in both languages", async () => {
    for (const locale of ["cs", "en"]) {
      const messages = (await import(`../messages/${locale}.json`)).default;
      const headers = IMPORT_FIELDS.map((field) => messages.import.fields[field] as string);
      expect(detectMapping(headers)).toEqual(
        Object.fromEntries(IMPORT_FIELDS.map((field, index) => [field, index])),
      );
    }
  });

  it("finds the header row under a title", () => {
    const rows = [
      ["Soupis hasicích přístrojů 2026"],
      [],
      ["Zákazník", "Budova", "Výrobní číslo"],
      ["A", "B", "123"],
    ];
    expect(headerRowIndex(rows)).toBe(2);
    expect(
      headerRowIndex([
        ["x", "y"],
        ["1", "2"],
      ]),
    ).toBe(0);
  });
});

describe("CSV", () => {
  it("reads UTF-8 with a BOM and Czech Windows-1250", () => {
    const utf8 = new TextEncoder().encode("﻿Zákazník;Budova\n");
    expect(decodeText(utf8)).toBe("Zákazník;Budova\n");
    // "Příz" in Windows-1250: P, ř (0xF8), í (0xED), z
    expect(decodeText(new Uint8Array([0x50, 0xf8, 0xed, 0x7a]))).toBe("Příz");
  });

  it("splits by the file's separator with quotes, line breaks and CRLF", () => {
    expect(parseCsv('a;b;c\r\n1;"x;y";"he said ""hi"""\r\n')).toEqual([
      ["a", "b", "c"],
      ["1", "x;y", 'he said "hi"'],
    ]);
    expect(parseCsv('name,address\n"Lipová 12","Praha,\n2"')).toEqual([
      ["name", "address"],
      ["Lipová 12", "Praha,\n2"],
    ]);
    expect(parseCsv("a\tb\n1\t2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("cells", () => {
  it("texts are trimmed; dates and numbers are written plainly", () => {
    expect(cellText("  Lipová   12 ")).toBe("Lipová 12");
    expect(cellText(27082440)).toBe("27082440");
    expect(cellText(6.5)).toBe("6.5");
    expect(cellText(new Date(Date.UTC(2024, 2, 1)))).toBe("2024-03-01");
    expect(cellText(null)).toBe("");
    // The formula guard of our own CSV exports comes off.
    expect(cellText("'+420 777 123 456")).toBe("+420 777 123 456");
    expect(cellText("'normal")).toBe("'normal");
  });

  it("dates in the usual Czech and international forms", () => {
    expect(parseDate("1. 3. 2024")).toBe("2024-03-01");
    expect(parseDate("01.03.2024")).toBe("2024-03-01");
    expect(parseDate("1.3.24")).toBe("2024-03-01");
    expect(parseDate("1/3/2024")).toBe("2024-03-01");
    expect(parseDate("2024-03-01")).toBe("2024-03-01");
    expect(parseDate("2024-03-01 10:00:00")).toBe("2024-03-01");
    expect(parseDate("03/2024")).toBe("2024-03-01");
    expect(parseDate(new Date(Date.UTC(2023, 10, 30)))).toBe("2023-11-30");
    // Excel's day number (also as text from a CSV).
    expect(parseDate(45352)).toBe("2024-03-01");
    expect(parseDate("45352")).toBe("2024-03-01");
    expect(parseDate("")).toBeNull();
    expect(parseDate(null)).toBeNull();
    expect(parseDate("31. 2. 2024")).toBe("invalid");
    expect(parseDate("loni")).toBe("invalid");
  });

  it("years, also from a date or text", () => {
    expect(parseYear(2019)).toBe("2019");
    expect(parseYear("r. 2019")).toBe("2019");
    expect(parseYear(new Date(Date.UTC(2018, 5, 1)))).toBe("2018");
    expect(parseYear("")).toBeNull();
    expect(parseYear("staré")).toBe("invalid");
    expect(parseYear("123456")).toBe("invalid");
  });

  it("company IDs get their leading zeros back when the check digit fits", () => {
    expect(normalizeCompanyId("4569873")).toBe("04569873");
    expect(normalizeCompanyId("27082440")).toBe("27082440");
    expect(normalizeCompanyId("1234567")).toBe("1234567");
    expect(normalizeCompanyId("270 82 440")).toBe("27082440");
  });
});

describe("rows", () => {
  const header = [
    "Zákazník",
    "IČO",
    "Telefon",
    "Budova",
    "Lokace",
    "Typ",
    "Výrobní číslo",
    "Rok výroby",
    "Poslední revize",
    "Hasivo",
    "Počet",
  ];
  const mapping = detectMapping(header);
  const build = (...rows: unknown[][]) => buildRows([header, ...rows], 0, mapping, types);

  it("a complete row becomes a device of its customer and building", () => {
    const [row] = build([
      "Bytové družstvo Lipová",
      "27082440",
      "+420 777 123 456",
      "Lipová 12",
      "Suterén",
      "Hasicí přístroj",
      "HP-001",
      2019,
      "1. 3. 2024",
      "prášek ABC",
      "",
    ]);
    expect(row!.errors).toEqual([]);
    expect(row!.warnings).toEqual([]);
    expect(row!.line).toBe(2);
    expect(row!.records).toHaveLength(1);
    expect(row!.records[0]).toEqual({
      customer: {
        name: "Bytové družstvo Lipová",
        companyId: "27082440",
        contactPerson: null,
        email: null,
        phone: "+420 777 123 456",
        billingAddress: null,
      },
      site: { name: "Lipová 12", address: null, accessNotes: null },
      location: "Suterén",
      device: {
        deviceTypeId: types[0]!.id,
        serialNumber: "HP-001",
        manufacturer: null,
        model: null,
        manufactureYear: 2019,
        agent: "prášek ABC",
        size: null,
        installedOn: null,
        lastInspectionOn: "2024-03-01",
        notes: null,
      },
    });
  });

  it("blank rows are skipped; a row without device data adds only customer and building", () => {
    const rows = build(
      [],
      ["", "", "", "", "", "", "", "", "", "", ""],
      ["Firma", "", "", "Sklad"],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.line).toBe(4);
    expect(rows[0]!.records[0]!.device).toBeNull();
  });

  it("the type defaults to fire extinguishers, is matched by name or code, or is an error", () => {
    const [plain, byCode, unknown] = build(
      ["A", "", "", "B", "", "", "S1"],
      ["A", "", "", "B", "", "HYDRANT", "S2"],
      ["A", "", "", "B", "", "Sprinkler", "S3"],
    );
    expect(plain!.records[0]!.device!.deviceTypeId).toBe(types[0]!.id);
    expect(byCode!.records[0]!.device!.deviceTypeId).toBe(types[1]!.id);
    expect(unknown!.errors).toEqual([{ field: "deviceType", code: "importUnknownType" }]);
    expect(unknown!.records).toEqual([]);
  });

  it("missing customer or building, a bad or future inspection date are errors", () => {
    const [missing, badDate, future] = build(
      ["", "", "", "", "", "", "S1"],
      ["A", "", "", "B", "", "", "S2", "", "loni"],
      ["A", "", "", "B", "", "", "S3", "", "1. 1. 2099"],
    );
    expect(missing!.errors.map((error) => error.field)).toEqual(["customerName", "siteName"]);
    expect(badDate!.errors).toEqual([{ field: "lastInspectionOn", code: "dateInvalid" }]);
    expect(future!.errors).toEqual([{ field: "lastInspectionOn", code: "dateInFuture" }]);
  });

  it("a bad phone, company ID or year is left out with a warning", () => {
    const [row] = build(["A", "12345678", "zavolat", "B", "", "", "S1", "1890"]);
    expect(row!.errors).toEqual([]);
    expect(row!.warnings.map((warning) => warning.field).sort()).toEqual(
      ["companyId", "manufactureYear", "phone"].sort(),
    );
    const record = row!.records[0]!;
    expect([
      record.customer.companyId,
      record.customer.phone,
      record.device!.manufactureYear,
    ]).toEqual([null, null, null]);
  });

  it("a quantity makes that many devices, but not with one serial number", () => {
    const [three, conflict, bad] = build(
      ["A", "", "", "B", "", "", "", "", "", "", "3 ks"],
      ["A", "", "", "B", "", "", "S1", "", "", "", "2"],
      ["A", "", "", "B", "", "", "", "", "", "", "0"],
    );
    expect(three!.records).toHaveLength(3);
    expect(conflict!.errors).toEqual([{ field: "serialNumber", code: "serialCountMismatch" }]);
    expect(bad!.errors).toEqual([{ field: "quantity", code: "countInvalid" }]);
  });

  it("attributes the type doesn't have are left out", () => {
    const [row] = build(["A", "", "", "B", "", "Hydrant", "H1", "", "", "voda"]);
    expect(row!.records[0]!.device!.agent).toBeNull();
  });
});

describe("preview", () => {
  const header = ["Zákazník", "IČO", "Budova", "Lokace", "Výrobní číslo"];
  const rows = (...data: unknown[][]) =>
    buildRows([header, ...data], 0, detectMapping(header), types);
  const existing: ExistingData = {
    customers: [
      { id: "c1", name: "Družstvo Lipová", companyId: "27082440" },
      { id: "c2", name: "Škola", companyId: null },
    ],
    sites: [{ id: "s1", customerId: "c1", name: "Lipová 12" }],
    locations: [{ siteId: "s1", name: "Suterén" }],
    serials: [{ siteId: "s1", serial: "hp-001" }],
  };

  it("reuses customers by company ID or name, buildings and locations by name", () => {
    const plan = planImport(
      rows(
        ["Jiný název", "27082440", "Lipová 12", "suterén", "HP-002"],
        ["ŠKOLA", "", "Tělocvična", "", "T-1"],
        ["Nová firma", "", "Sklad", "Hala", "X-1"],
        ["Nová firma", "", "Sklad", "Hala", "X-2"],
      ),
      existing,
    );
    expect(plan.customers).toEqual({ created: 1, existing: 2 });
    expect(plan.sites).toEqual({ created: 2, existing: 1 });
    expect(plan.locations).toBe(1);
    expect(plan.devices).toBe(4);
    expect(plan.skipped).toBe(0);
  });

  it("a different company ID under the same name is another customer", () => {
    const plan = planImport(rows(["Družstvo Lipová", "25596641", "Lipová 12", "", ""]), existing);
    expect(plan.customers).toEqual({ created: 1, existing: 0 });
    expect(plan.sites.created).toBe(1);
  });

  it("serial numbers already in the building, or earlier in the file, are skipped", () => {
    const plan = planImport(
      rows(
        ["Družstvo Lipová", "", "Lipová 12", "", "HP-001"],
        ["Družstvo Lipová", "", "Lipová 12", "", "HP-010"],
        ["Družstvo Lipová", "", "Lipová 12", "", "hp-010"],
      ),
      existing,
    );
    expect(plan.devices).toBe(1);
    expect(plan.skipped).toBe(2);
    expect([...plan.duplicates.keys()]).toEqual([2, 4]);
  });
});
