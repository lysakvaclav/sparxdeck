// Import from Excel or CSV: reading CSV, recognizing columns by their headers,
// turning cells into clean values, checking rows with the app's own rules, and
// a preview of what the import will create. Pure functions shared by the
// browser and the tests; the database repeats the matching (import_records).

import { attributeFields, type DeviceAttribute } from "@/lib/devices";
import { isIsoDate, type IsoDate } from "@/lib/due";
import type { ErrorCode } from "@/lib/errors";
import {
  IMPORT_MAX_QUANTITY,
  importRecordSchema,
  isValidCompanyId,
  type ImportRecord,
  type ImportRecordInput,
} from "@/lib/validation";

// ---------------------------------------------------------------------------
// Fields and their headers
// ---------------------------------------------------------------------------

export const IMPORT_FIELDS = [
  "customerName",
  "companyId",
  "contactPerson",
  "email",
  "phone",
  "customerAddress",
  "siteName",
  "siteAddress",
  "accessNotes",
  "locationName",
  "deviceType",
  "serialNumber",
  "manufacturer",
  "model",
  "manufactureYear",
  "installedOn",
  "lastInspectionOn",
  "agent",
  "size",
  "quantity",
  "notes",
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

export const IMPORT_GROUPS: Record<"customer" | "site" | "device", readonly ImportField[]> = {
  customer: ["customerName", "companyId", "contactPerson", "email", "phone", "customerAddress"],
  site: ["siteName", "siteAddress", "accessNotes", "locationName"],
  device: [
    "deviceType",
    "serialNumber",
    "manufacturer",
    "model",
    "manufactureYear",
    "installedOn",
    "lastInspectionOn",
    "agent",
    "size",
    "quantity",
    "notes",
  ],
};

/** Every row needs these two. */
export const REQUIRED_FIELDS: readonly ImportField[] = ["customerName", "siteName"];

/** Fields that make a row a device (the others describe its customer and building). */
const DEVICE_FIELDS = IMPORT_GROUPS.device;

/** Headers as people write them (lower case, no accents, words only), Czech and English. */
const SYNONYMS: Record<ImportField, readonly string[]> = {
  customerName: [
    "zakaznik",
    "odberatel",
    "klient",
    "firma",
    "spolecnost",
    "nazev zakaznika",
    "zakaznik nazev",
    "objednatel",
    "vlastnik",
    "customer",
    "client",
    "company",
    "customer name",
  ],
  companyId: [
    "ico",
    "ic",
    "ic o",
    "identifikacni cislo",
    "company id",
    "reg no",
    "registration number",
    "business id",
  ],
  contactPerson: ["kontakt", "kontaktni osoba", "contact", "contact person"],
  email: ["email", "e mail", "mail", "e mail zakaznika", "email zakaznika"],
  phone: ["telefon", "tel", "mobil", "telefonni cislo", "phone", "phone number", "mobile"],
  customerAddress: [
    "adresa zakaznika",
    "fakturacni adresa",
    "sidlo",
    "sidlo firmy",
    "adresa sidla",
    "billing address",
    "customer address",
  ],
  siteName: [
    "budova",
    "objekt",
    "provozovna",
    "stavba",
    "nemovitost",
    "areal",
    "misto instalace",
    "building",
    "site",
    "property",
    "object",
  ],
  siteAddress: [
    "adresa",
    "adresa budovy",
    "adresa objektu",
    "adresa provozovny",
    "ulice",
    "address",
    "site address",
    "building address",
  ],
  accessNotes: [
    "pristup",
    "klice",
    "pristup do budovy",
    "poznamka k pristupu",
    "access",
    "access notes",
    "building access",
    "keys",
  ],
  locationName: [
    "lokace",
    "umisteni",
    "patro",
    "podlazi",
    "mistnost",
    "misto umisteni",
    "location",
    "floor",
    "room",
    "placement",
  ],
  deviceType: [
    "typ",
    "typ zarizeni",
    "druh",
    "druh zarizeni",
    "zarizeni",
    "type",
    "device type",
    "equipment",
  ],
  serialNumber: [
    "vyrobni cislo",
    "v c",
    "vc",
    "vyr c",
    "vyr cislo",
    "seriove cislo",
    "sn",
    "s n",
    "serial",
    "serial number",
    "serial no",
  ],
  manufacturer: ["vyrobce", "znacka", "manufacturer", "brand", "make"],
  model: ["model", "typove oznaceni", "oznaceni", "model name"],
  manufactureYear: [
    "rok vyroby",
    "rok",
    "r v",
    "rv",
    "year",
    "manufacture year",
    "year of manufacture",
  ],
  installedOn: [
    "datum instalace",
    "instalace",
    "uvedeni do provozu",
    "datum uvedeni do provozu",
    "installed",
    "installation date",
    "installed on",
  ],
  lastInspectionOn: [
    "posledni revize",
    "datum revize",
    "revize",
    "posledni kontrola",
    "datum kontroly",
    "kontrola",
    "datum posledni revize",
    "last inspection",
    "inspection date",
    "inspected",
    "last check",
  ],
  agent: ["hasivo", "napln", "druh hasiva", "druh naplne", "agent", "extinguishing agent"],
  size: ["velikost", "hmotnost naplne", "mnozstvi naplne", "objem", "kg", "size", "capacity"],
  quantity: ["pocet", "ks", "pocet ks", "mnozstvi", "pocet kusu", "quantity", "qty", "count"],
  notes: ["poznamka", "poznamky", "pozn", "notes", "note", "comment", "remarks"],
};

/** Header text for matching: "Výr. č." → "vyr c". */
export function normalizeHeader(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export type ColumnMapping = Partial<Record<ImportField, number>>;

/**
 * Which column holds which field, from the headers: exact names first, then
 * headers that start with a known name ("Typ HP"). A column serves one field.
 */
export function detectMapping(headers: readonly string[]): ColumnMapping {
  const normalized = headers.map((header) => normalizeHeader(header ?? ""));
  const mapping: ColumnMapping = {};
  const used = new Set<number>();
  const assign = (field: ImportField, index: number) => {
    mapping[field] = index;
    used.add(index);
  };
  for (const field of IMPORT_FIELDS) {
    const index = normalized.findIndex(
      (header, column) => !used.has(column) && SYNONYMS[field].includes(header),
    );
    if (index >= 0) assign(field, index);
  }
  for (const field of IMPORT_FIELDS) {
    if (mapping[field] !== undefined) continue;
    const index = normalized.findIndex(
      (header, column) =>
        !used.has(column) &&
        header.length > 0 &&
        SYNONYMS[field].some((name) => name.length >= 3 && header.startsWith(`${name} `)),
    );
    if (index >= 0) assign(field, index);
  }
  return mapping;
}

/** The header row: of the first ten rows, the one with the most recognized headers. */
export function headerRowIndex(rows: readonly (readonly unknown[])[]): number {
  let best = -1;
  let bestScore = 0;
  for (let index = 0; index < Math.min(rows.length, 10); index++) {
    const headers = (rows[index] ?? []).map((cell) => cellText(cell));
    const score = Object.keys(detectMapping(headers)).length;
    if (score > bestScore) {
      best = index;
      bestScore = score;
    }
  }
  if (best >= 0) return best;
  const firstFilled = rows.findIndex((row) => row.some((cell) => cellText(cell) !== ""));
  return Math.max(0, firstFilled);
}

// ---------------------------------------------------------------------------
// Reading files
// ---------------------------------------------------------------------------

/** Text of a CSV file: UTF-8 (with or without BOM), else Windows-1250 (Czech Excel). */
export function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^﻿/, "");
  } catch {
    return new TextDecoder("windows-1250").decode(bytes);
  }
}

/** The separator of a CSV file: the most frequent of ; , and tab on its first line. */
function delimiterOf(text: string): string {
  const line = text.split(/\r?\n/).find((candidate) => candidate.trim()) ?? "";
  let best = ";";
  let bestCount = -1;
  for (const candidate of [";", ",", "\t"]) {
    let count = 0;
    let quoted = false;
    for (const char of line) {
      if (char === '"') quoted = !quoted;
      else if (!quoted && char === candidate) count++;
    }
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

/** Rows of a CSV file (RFC 4180 quoting; ; , or tab separated). */
export function parseCsv(text: string): string[][] {
  const input = text.replace(/^﻿/, "");
  const delimiter = delimiterOf(input);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < input.length; index++) {
    const char = input[index]!;
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') {
        cell += '"';
        index++;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell === "") quoted = true;
    else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[index + 1] === "\n") index++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Cells
// ---------------------------------------------------------------------------

const pad = (value: number) => String(value).padStart(2, "0");

function isoFromParts(year: number, month: number, day: number): IsoDate | null {
  const iso = `${year}-${pad(month)}-${pad(day)}`;
  return isIsoDate(iso) ? iso : null;
}

/** Excel's day numbers (1 = 1900-01-01, with its 1900 leap-year quirk). */
function excelSerialDate(serial: number): IsoDate | null {
  if (!Number.isFinite(serial) || serial < 1 || serial > 2958465) return null;
  const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86_400_000);
  return isoFromParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

/** A cell as trimmed text (dates as ISO, whole numbers without decimals). */
export function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? ""
      : `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)));
  }
  if (typeof value === "boolean") return value ? "1" : "0";
  const text = String(value).replace(/\s+/g, " ").trim();
  // Our CSV exports guard formulas with an apostrophe ("'+420 …"); take it off again.
  return /^'[=+\-@]/.test(text) ? text.slice(1) : text;
}

/**
 * A calendar date from a cell: an Excel date, "1. 3. 2024", "1.3.24", "2024-03-01",
 * "1/3/2024" (day first) or a month ("03/2024", "3.2024" → its first day, the
 * earlier and so safer choice for due dates). Empty → null; unreadable → "invalid".
 */
export function parseDate(value: unknown): IsoDate | null | "invalid" {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return cellText(value) || "invalid";
  if (typeof value === "number") return excelSerialDate(value) ?? "invalid";
  const text = cellText(value);
  if (!text) return null;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/.exec(text);
  if (match) return isoFromParts(+match[1]!, +match[2]!, +match[3]!) ?? "invalid";
  match = /^(\d{1,2})\s*[./]\s*(\d{1,2})\s*[./]\s*(\d{4}|\d{2})(?:\s+\d{1,2}:\d{2}.*)?$/.exec(text);
  if (match) {
    const year = match[3]!.length === 2 ? 2000 + +match[3]! : +match[3]!;
    return isoFromParts(year, +match[2]!, +match[1]!) ?? "invalid";
  }
  match = /^(\d{1,2})\s*[./]\s*(\d{4})$/.exec(text);
  if (match) return isoFromParts(+match[2]!, +match[1]!, 1) ?? "invalid";
  if (/^\d{5}(\.\d+)?$/.test(text)) return excelSerialDate(Number(text)) ?? "invalid";
  return "invalid";
}

/** A year: 2019, "2019", "r. 2019" or the year of a date. */
export function parseYear(value: unknown): string | null | "invalid" {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return cellText(value).slice(0, 4) || "invalid";
  const text = cellText(value);
  if (!text) return null;
  const year = /\b(19|20)\d{2}\b/.exec(text);
  if (year && !/\d{5}/.test(text)) return year[0];
  return "invalid";
}

/** Czech company IDs lose leading zeros in Excel (04569876 → 4569876): put them back. */
export function normalizeCompanyId(text: string): string {
  const compact = text.replace(/\s+/g, "");
  if (/^\d{6,7}$/.test(compact)) {
    const padded = compact.padStart(8, "0");
    if (isValidCompanyId(padded)) return padded;
  }
  return compact;
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

export type DeviceTypeOption = { id: string; name: string; code: string };

export type FieldIssue = { field: ImportField; code: ErrorCode };

export type ImportRow = {
  /** Row number in the spreadsheet (1-based, as Excel shows it). */
  line: number;
  /** Cell texts by field, for showing the row. */
  values: Partial<Record<ImportField, string>>;
  /** Checked records (one per device, "quantity" expanded); empty with errors. */
  records: ImportRecord[];
  /** The same records as cleaned text, for the server to check again. */
  inputs: ImportRecordInput[];
  /** Block the row. */
  errors: FieldIssue[];
  /** The value is left out, the row is imported. */
  warnings: FieldIssue[];
};

/** Fields that are nice to have: a bad value is dropped with a warning, the row stays. */
const SOFT_FIELDS: readonly ImportField[] = [
  "companyId",
  "email",
  "phone",
  "manufactureYear",
  "installedOn",
];

/** The device type a row names (by name or code, any case), or the default one. */
function resolveType(
  text: string,
  types: readonly DeviceTypeOption[],
): DeviceTypeOption | null | "unknown" {
  if (!text) {
    return types.find((type) => type.code === "fire_extinguisher") ?? types[0] ?? null;
  }
  const wanted = normalizeHeader(text);
  return (
    types.find(
      (type) => normalizeHeader(type.name) === wanted || normalizeHeader(type.code) === wanted,
    ) ?? "unknown"
  );
}

/** The field a schema issue is about, from its path in the record. */
function fieldOfPath(path: readonly PropertyKey[]): ImportField {
  const [group, key] = path.map(String);
  const byPath: Record<string, ImportField> = {
    "customer.name": "customerName",
    "customer.companyId": "companyId",
    "customer.contactPerson": "contactPerson",
    "customer.email": "email",
    "customer.phone": "phone",
    "customer.billingAddress": "customerAddress",
    "site.name": "siteName",
    "site.address": "siteAddress",
    "site.accessNotes": "accessNotes",
    "location.undefined": "locationName",
    "device.deviceTypeId": "deviceType",
    "device.serialNumber": "serialNumber",
    "device.manufacturer": "manufacturer",
    "device.model": "model",
    "device.manufactureYear": "manufactureYear",
    "device.installedOn": "installedOn",
    "device.lastInspectionOn": "lastInspectionOn",
    "device.agent": "agent",
    "device.size": "size",
    "device.notes": "notes",
  };
  return byPath[`${group}.${key}`] ?? "notes";
}

/**
 * Turns the spreadsheet rows under the header into checked import rows. Blank
 * rows are left out. Soft fields that don't check out (company ID, e-mail,
 * phone, year) become warnings and are left empty; anything else is an error.
 */
export function buildRows(
  table: readonly (readonly unknown[])[],
  headerIndex: number,
  mapping: ColumnMapping,
  types: readonly DeviceTypeOption[],
): ImportRow[] {
  const rows: ImportRow[] = [];
  for (let index = headerIndex + 1; index < table.length; index++) {
    const cells = table[index] ?? [];
    const raw = (field: ImportField) => {
      const column = mapping[field];
      return column === undefined ? undefined : cells[column];
    };
    const values: Partial<Record<ImportField, string>> = {};
    for (const field of IMPORT_FIELDS) {
      const text = cellText(raw(field));
      if (text) values[field] = text;
    }
    if (Object.keys(values).length === 0) continue;

    const errors: FieldIssue[] = [];
    const warnings: FieldIssue[] = [];
    const text = (field: ImportField) => values[field] ?? "";

    for (const field of REQUIRED_FIELDS) if (!text(field)) errors.push({ field, code: "required" });

    const dates: Partial<Record<"installedOn" | "lastInspectionOn", string>> = {};
    for (const field of ["installedOn", "lastInspectionOn"] as const) {
      const parsed = parseDate(raw(field));
      // The last inspection decides the due date, so it has to be right.
      if (parsed === "invalid")
        (field === "lastInspectionOn" ? errors : warnings).push({ field, code: "dateInvalid" });
      else if (parsed) dates[field] = parsed;
    }
    let year = "";
    const parsedYear = parseYear(raw("manufactureYear"));
    if (parsedYear === "invalid") warnings.push({ field: "manufactureYear", code: "yearInvalid" });
    else if (parsedYear) year = parsedYear;

    let quantity = 1;
    if (text("quantity")) {
      const count = Number(text("quantity").replace(/\s*(ks|pcs)\.?$/i, ""));
      if (!Number.isInteger(count) || count < 1 || count > IMPORT_MAX_QUANTITY)
        errors.push({ field: "quantity", code: "countInvalid" });
      else quantity = count;
    }
    if (quantity > 1 && text("serialNumber"))
      errors.push({ field: "serialNumber", code: "serialCountMismatch" });

    const isDevice = DEVICE_FIELDS.some((field) => text(field));
    let type: DeviceTypeOption | null = null;
    if (isDevice) {
      const resolved = resolveType(text("deviceType"), types);
      if (resolved === "unknown") errors.push({ field: "deviceType", code: "importUnknownType" });
      else if (!resolved) errors.push({ field: "deviceType", code: "noDeviceType" });
      else type = resolved;
    }

    const attributeValues: Partial<Record<DeviceAttribute, string>> = {
      agent: text("agent"),
      size: text("size"),
    };
    const typeAttributes = type ? attributeFields(type.code) : [];
    const input: ImportRecordInput = {
      customer: {
        name: text("customerName"),
        companyId: text("companyId") ? normalizeCompanyId(text("companyId")) : "",
        contactPerson: text("contactPerson"),
        email: text("email"),
        phone: text("phone"),
        billingAddress: text("customerAddress"),
      },
      site: {
        name: text("siteName"),
        address: text("siteAddress"),
        accessNotes: text("accessNotes"),
      },
      location: text("locationName"),
      device:
        isDevice && type
          ? {
              deviceTypeId: type.id,
              serialNumber: text("serialNumber"),
              manufacturer: text("manufacturer"),
              model: text("model"),
              manufactureYear: year,
              // Only attributes the type has (the rest would be ignored by the app).
              agent: typeAttributes.includes("agent") ? (attributeValues.agent ?? "") : "",
              size: typeAttributes.includes("size") ? (attributeValues.size ?? "") : "",
              installedOn: dates.installedOn ?? "",
              lastInspectionOn: dates.lastInspectionOn ?? "",
              notes: text("notes"),
            }
          : null,
    };

    // Soft fields first: what doesn't check out is dropped with a warning.
    let parsed = importRecordSchema.safeParse(input);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = fieldOfPath(issue.path);
        if (!SOFT_FIELDS.includes(field)) continue;
        warnings.push({ field, code: issue.message as ErrorCode });
        if (field === "companyId") input.customer.companyId = "";
        if (field === "email") input.customer.email = "";
        if (field === "phone") input.customer.phone = "";
        if (field === "manufactureYear" && input.device) input.device.manufactureYear = "";
        if (field === "installedOn" && input.device) input.device.installedOn = "";
      }
      parsed = importRecordSchema.safeParse(input);
    }
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = fieldOfPath(issue.path);
        if (!errors.some((error) => error.field === field))
          errors.push({ field, code: issue.message as ErrorCode });
      }
    }

    const valid = errors.length === 0 && parsed.success;
    rows.push({
      line: index + 1,
      values,
      records: valid ? Array(quantity).fill(parsed.data) : [],
      inputs: valid ? Array(quantity).fill(input) : [],
      errors,
      warnings,
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Preview: what the import will create
// ---------------------------------------------------------------------------

export type ExistingData = {
  customers: { id: string; name: string; companyId: string | null }[];
  sites: { id: string; customerId: string; name: string }[];
  locations: { siteId: string; name: string }[];
  /** Serial numbers already in buildings (lower case). */
  serials: { siteId: string; serial: string }[];
};

export type ImportPlan = {
  customers: { created: number; existing: number };
  sites: { created: number; existing: number };
  locations: number;
  devices: number;
  /** Devices whose serial number is already in the building (or earlier in the file). */
  skipped: number;
  /** Per row: which devices will be skipped as duplicates. */
  duplicates: Map<number, number>;
};

const key = (text: string | null | undefined) => (text ?? "").trim().toLowerCase();

/**
 * Simulates import_records on the valid rows: customers by company ID, else by
 * name (unless the IDs differ); buildings and locations by name; devices with
 * a serial number already in the building are skipped.
 */
export function planImport(rows: readonly ImportRow[], existing: ExistingData): ImportPlan {
  type Customer = { id: string; name: string; companyId: string | null; isNew: boolean };
  const customers: Customer[] = existing.customers.map((customer) => ({
    ...customer,
    isNew: false,
  }));
  const sites = new Map(
    existing.sites.map((site) => [
      `${site.customerId}|${key(site.name)}`,
      { id: site.id, isNew: false },
    ]),
  );
  const locations = new Set(
    existing.locations.map((location) => `${location.siteId}|${key(location.name)}`),
  );
  const serials = new Set(existing.serials.map((entry) => `${entry.siteId}|${key(entry.serial)}`));
  const seenCustomers = new Set<string>();
  const seenSites = new Set<string>();
  const plan: ImportPlan = {
    customers: { created: 0, existing: 0 },
    sites: { created: 0, existing: 0 },
    locations: 0,
    devices: 0,
    skipped: 0,
    duplicates: new Map(),
  };
  let counter = 0;

  for (const row of rows) {
    for (const record of row.records) {
      const companyId = record.customer.companyId;
      let customer =
        (companyId && customers.find((candidate) => candidate.companyId === companyId)) ||
        customers.find(
          (candidate) =>
            key(candidate.name) === key(record.customer.name) &&
            (!candidate.companyId || !companyId || candidate.companyId === companyId),
        );
      if (!customer) {
        customer = { id: `new-${counter++}`, name: record.customer.name, companyId, isNew: true };
        customers.push(customer);
        plan.customers.created++;
      } else if (!customer.isNew && !seenCustomers.has(customer.id)) plan.customers.existing++;
      seenCustomers.add(customer.id);

      const siteKey = `${customer.id}|${key(record.site.name)}`;
      let site = sites.get(siteKey);
      if (!site) {
        site = { id: `new-${counter++}`, isNew: true };
        sites.set(siteKey, site);
        plan.sites.created++;
      } else if (!site.isNew && !seenSites.has(site.id)) plan.sites.existing++;
      seenSites.add(site.id);

      if (record.location && !locations.has(`${site.id}|${key(record.location)}`)) {
        locations.add(`${site.id}|${key(record.location)}`);
        plan.locations++;
      }

      if (record.device) {
        const serial = record.device.serialNumber;
        if (serial && serials.has(`${site.id}|${key(serial)}`)) {
          plan.skipped++;
          plan.duplicates.set(row.line, (plan.duplicates.get(row.line) ?? 0) + 1);
          continue;
        }
        if (serial) serials.add(`${site.id}|${key(serial)}`);
        plan.devices++;
      }
    }
  }
  return plan;
}
