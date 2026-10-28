import { formatLabel } from "@/lib/devices";
import { defectNumber } from "@/lib/defects";
import { CALENDAR_FORMAT, calendarDate } from "@/lib/due";
import type { VariableKey } from "@/lib/protocol-template/variables";
import { scanLocationSummary } from "@/lib/scan-location";
import type {
  CheckOutcome,
  CheckSkipReason,
  ChecklistItemType,
  DefectSeverity,
  ProtocolNumberFormat,
  ScanLocationState,
} from "@/lib/supabase/database.types";

// What an inspection protocol says, assembled from the inspection's records.
// Pure, so the wording and order can be tested without rendering a PDF. The
// model offers every field a protocol template can show, already translated
// and formatted; the template (src/lib/protocol-template) picks and orders
// them, the PDF (src/lib/pdf/protocol.tsx) lays them out.

export type ProtocolLocale = "cs" | "en";

/** "2026-0007" by default; the organization's chosen format otherwise. */
export function protocolNumber(
  year: number,
  number: number,
  format: ProtocolNumberFormat = "year_number",
): string {
  const padded = String(number).padStart(4, "0");
  switch (format) {
    case "number_year":
      return `${padded}/${year}`;
    case "year_slash_number":
      return `${year}/${padded}`;
    default:
      return `${year}-${padded}`;
  }
}

/** The number as it can stand in a file name ("0007/2026" would be a folder). */
export function protocolFileNumber(number: string): string {
  return number.replaceAll("/", "-");
}

export type ProtocolAnswer = {
  question: string;
  type: ChecklistItemType;
  order: number;
  pass: boolean | null;
  number: number | null;
  text: string | null;
  note: string | null;
};

export type ProtocolCheck = {
  labelNumber: number;
  typeName: string;
  locationName: string | null;
  /** The location's place on the technician's route; null without a location. */
  locationOrder: number | null;
  serialNumber: string | null;
  manufacturer?: string | null;
  model?: string | null;
  manufactureYear?: number | null;
  outcome: CheckOutcome;
  /** Left out (inaccessible, missing): the result says why. */
  skipReason?: CheckSkipReason | null;
  nextDueOn: string | null;
  checkedBy: string | null;
  note: string | null;
  answers: ProtocolAnswer[];
  /** The position of the device's scan (part 20): null state = not scanned. */
  scanLocation?: { state: ScanLocationState | null; note: string | null } | null;
};

export type ProtocolDefect = {
  number: number;
  labelNumber: number;
  description: string;
  severity: DefectSeverity;
  /** Already open before this inspection, found again. */
  again: boolean;
};

/**
 * Everything a protocol is made from. Plain data (JSON): it is also stored
 * with the issued protocol (its snapshot), so the protocol can be drawn again
 * exactly as it was issued.
 */
export type ProtocolInput = {
  locale: ProtocolLocale;
  timeZone: string;
  year: number;
  number: number;
  numberFormat?: ProtocolNumberFormat;
  version: number;
  organization: {
    name: string;
    legalName: string | null;
    companyId: string | null;
    vatId: string | null;
    address: string | null;
    email: string | null;
    phone: string | null;
    footer: string | null;
  };
  customer: {
    name: string;
    companyId: string | null;
    vatId: string | null;
    contactPerson: string | null;
    billingAddress: string | null;
  } | null;
  site: { name: string; address: string | null } | null;
  startedAt: string;
  completedAt: string;
  generatedAt: string;
  completedBy: string | null;
  notes: string | null;
  checks: ProtocolCheck[];
  defects: ProtocolDefect[];
  customerSignature: { name: string | null; signedAt: string | null } | null;
  /** For a reissued protocol (version > 1): when the version it replaces was issued. */
  previousIssuedAt?: string | null;
  /** The company records the position of scans: the protocol reports it. */
  scanLocation?: boolean;
};

/** Translated texts, as next-intl's `t` for the "protocol" namespace gives them. */
export type Translate = (key: string, values?: Record<string, string | number>) => string;

export type FactKey = "date" | "technician" | "issued" | "version";
export type DeviceColumn =
  | "label"
  | "type"
  | "location"
  | "serial"
  | "manufacturer"
  | "model"
  | "year"
  | "result"
  | "nextDue"
  | "checkedBy"
  | "scan";

export type ProtocolDeviceRow = Record<DeviceColumn, string> & {
  failed: boolean;
  /** Findings, notes and the explanation of the scan's position, one per line. */
  details: string[];
  /** Every question of its checklist with the answer, in order. */
  answers: { question: string; value: string; failed: boolean }[];
};

export type ProtocolModel = {
  locale: ProtocolLocale;
  fileName: string;
  title: string;
  numberLabel: string;
  number: string;
  organization: {
    /** The legal name when the company has one (it identifies the issuer). */
    name: string;
    address: string[];
    /** "IČO: … · DIČ: …", empty without them. */
    ids: string;
    /** E-mail and phone, empty without them. */
    contact: string;
  };
  customer: {
    label: string;
    /** "—" when the inspection has no customer. */
    name: string;
    billingAddress: string[];
    ids: string;
    contact: string;
  };
  site: { label: string; name: string; address: string[] };
  /** Only the facts that apply (the version from the second issue on). */
  facts: { key: FactKey; label: string; value: string }[];
  counts: { total: number; passed: number; failed: number; notChecked: number; defects: number };
  /** "Devices: 4. Passed: 2, …" */
  summary: string;
  /** The overall result in a sentence. */
  result: string;
  countLabels: Record<"total" | "passed" | "failed" | "notChecked" | "defects" | "result", string>;
  titles: Record<"summary" | "devices" | "checklist" | "defects" | "gallery" | "notes", string>;
  columns: Record<DeviceColumn, string>;
  devices: ProtocolDeviceRow[];
  /** The scan-location summary and the note on its accuracy; null when not reported. */
  scan: { summary: string; disclaimer: string } | null;
  defectColumns: Record<"number" | "device" | "description" | "severity", string>;
  defects: {
    number: string;
    rawNumber: number;
    device: string;
    description: string;
    severity: string;
  }[];
  noDefects: string;
  noAnswers: string;
  notes: string | null;
  signatures: Record<
    "technician" | "customer",
    { label: string; name: string | null; signedAt: string | null }
  > & { otherLabel: string };
  signatureHint: string;
  footer: string | null;
  /** "Protocol 2026-0007 · page 1 of 2" with the numbers filled in at render time. */
  page: (page: number, pages: number) => string;
  /** The values of the template's variables ({{zakaznik.nazev}}), empty where unknown. */
  variables: Record<VariableKey, string>;
};

export type ProtocolOptions = {
  /** How dates are written (the template's choice); "medium" is the protocol as before. */
  dateStyle?: "medium" | "long" | "short";
};

const dash = "—";
const lines = (value: string | null | undefined) =>
  (value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
const joined = (parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" · ");

export function buildProtocol(
  input: ProtocolInput,
  t: Translate,
  { dateStyle = "medium" }: ProtocolOptions = {},
): ProtocolModel {
  const number = protocolNumber(input.year, input.number, input.numberFormat);
  const day = new Intl.DateTimeFormat(input.locale, { dateStyle, timeZone: input.timeZone });
  // Calendar days (the next due date) in the same style; medium as everywhere in the app.
  const calendar = new Intl.DateTimeFormat(
    input.locale,
    dateStyle === "medium" ? CALENDAR_FORMAT : { dateStyle, timeZone: "UTC" },
  );
  const decimal = new Intl.NumberFormat(input.locale, { maximumFractionDigits: 3 });
  const ids = (companyId: string | null, vatId: string | null) =>
    joined([companyId && `${t("companyId")}: ${companyId}`, vatId && `${t("vatId")}: ${vatId}`]);

  const { organization, customer, site } = input;
  const started = day.format(new Date(input.startedAt));
  const completed = day.format(new Date(input.completedAt));

  // Route order: locations as on the building, devices without one last.
  const checks = [...input.checks].sort(
    (a, b) =>
      (a.locationOrder ?? Number.MAX_SAFE_INTEGER) - (b.locationOrder ?? Number.MAX_SAFE_INTEGER) ||
      a.labelNumber - b.labelNumber,
  );
  // Whoever checked the most devices first (they sign); then the others.
  const checkedBy = new Map<string, number>();
  for (const check of checks)
    if (check.checkedBy) checkedBy.set(check.checkedBy, (checkedBy.get(check.checkedBy) ?? 0) + 1);
  const technicians = [...checkedBy.keys()].sort((a, b) => checkedBy.get(b)! - checkedBy.get(a)!);
  if (technicians.length === 0 && input.completedBy) technicians.push(input.completedBy);
  const count = (outcome: CheckOutcome) =>
    checks.filter((check) => check.outcome === outcome).length;
  const counts = {
    total: checks.length,
    passed: count("passed"),
    failed: count("failed"),
    notChecked: count("not_checked"),
    defects: input.defects.length,
  };
  // The position of scans: when the company records it, or a check carries one.
  const withScan =
    !!input.scanLocation || checks.some((check) => check.scanLocation?.state != null);
  const scanStates = scanLocationSummary(checks.map((check) => check.scanLocation?.state ?? null));

  const answerValue = (answer: ProtocolAnswer) => {
    if (answer.type === "pass_fail")
      return answer.pass === null ? null : t(answer.pass ? "finding.passed" : "finding.failed");
    if (answer.type === "number")
      return answer.number === null ? null : decimal.format(answer.number);
    return answer.text?.trim() || null;
  };
  const sorted = (check: ProtocolCheck) => [...check.answers].sort((a, b) => a.order - b.order);
  const details = (check: ProtocolCheck) => {
    const found = sorted(check).flatMap((answer) => {
      const note = answer.note?.trim();
      if (answer.type === "pass_fail") {
        if (answer.pass === false)
          return [`${answer.question}: ${t("finding.failed")}${note ? ` (${note})` : ""}`];
        return note ? [`${answer.question}: ${note}`] : [];
      }
      const value = answerValue(answer);
      if (!value && !note) return [];
      return [`${answer.question}: ${[value, note && `(${note})`].filter(Boolean).join(" ")}`];
    });
    const note = check.note?.trim();
    const located = withScan ? check.scanLocation?.note?.trim() : null;
    return [
      ...found,
      ...(note ? [`${t("finding.deviceNote")}: ${note}`] : []),
      ...(located ? [`${t("scanNote")}: ${located}`] : []),
    ];
  };
  const answers = (check: ProtocolCheck) =>
    sorted(check).map((answer) => {
      const note = answer.note?.trim();
      return {
        question: answer.question,
        value: [answerValue(answer) ?? dash, note && `(${note})`].filter(Boolean).join(" "),
        failed: answer.type === "pass_fail" && answer.pass === false,
      };
    });

  const facts: ProtocolModel["facts"] = [
    {
      key: "date",
      label: t("date"),
      value: started === completed ? completed : `${started} – ${completed}`,
    },
    { key: "technician", label: t("technician"), value: technicians.join(", ") || dash },
    { key: "issued", label: t("issued"), value: day.format(new Date(input.generatedAt)) },
  ];
  if (input.version > 1)
    facts.push({
      key: "version",
      label: t("version"),
      value: input.previousIssuedAt
        ? t("versionReplaces", {
            version: input.version,
            date: day.format(new Date(input.previousIssuedAt)),
          })
        : String(input.version),
    });

  const result =
    counts.failed > 0
      ? t("overall.failed", { count: counts.failed })
      : counts.passed > 0
        ? t("overall.passed")
        : t("overall.none");
  const organizationName = organization.legalName || organization.name;
  const variables: Record<VariableKey, string> = {
    "firma.nazev": organizationName,
    "firma.ico": organization.companyId ?? "",
    "firma.dic": organization.vatId ?? "",
    "firma.adresa": lines(organization.address).join(", "),
    "firma.email": organization.email ?? "",
    "firma.telefon": organization.phone ?? "",
    "zakaznik.nazev": customer?.name ?? "",
    "zakaznik.ico": customer?.companyId ?? "",
    "zakaznik.dic": customer?.vatId ?? "",
    "zakaznik.adresa": lines(customer?.billingAddress).join(", "),
    "zakaznik.kontakt": customer?.contactPerson ?? "",
    "budova.nazev": site?.name ?? "",
    "budova.adresa": lines(site?.address).join(", "),
    "revize.datum": facts[0]!.value,
    "revize.zahajeni": started,
    "revize.dokonceni": completed,
    "revize.poznamka": input.notes?.trim() ?? "",
    "technik.jmeno": technicians[0] ?? "",
    "technik.vsichni": technicians.join(", "),
    "protokol.cislo": number,
    "protokol.verze": String(input.version),
    "protokol.vystaveno": day.format(new Date(input.generatedAt)),
    "vysledek.text": result,
    "vysledek.celkem": String(counts.total),
    "vysledek.vyhovuje": String(counts.passed),
    "vysledek.nevyhovuje": String(counts.failed),
    "vysledek.nezkontrolovano": String(counts.notChecked),
    "zavady.pocet": String(counts.defects),
    "podpis.zakaznik": input.customerSignature?.name ?? "",
  };

  return {
    locale: input.locale,
    fileName: t("fileName", { number: protocolFileNumber(number) }),
    title: t("title"),
    numberLabel: t("number"),
    number,
    organization: {
      name: organizationName,
      address: lines(organization.address),
      ids: ids(organization.companyId, organization.vatId),
      contact: joined([organization.email, organization.phone]),
    },
    customer: {
      label: t("customer"),
      name: customer?.name ?? dash,
      billingAddress: lines(customer?.billingAddress),
      ids: customer ? ids(customer.companyId, customer.vatId) : "",
      contact: customer?.contactPerson ? `${t("contact")}: ${customer.contactPerson}` : "",
    },
    site: { label: t("site"), name: site?.name ?? dash, address: lines(site?.address) },
    facts,
    counts,
    summary: t("summary", {
      total: counts.total,
      passed: counts.passed,
      failed: counts.failed,
      notChecked: counts.notChecked,
    }),
    result,
    countLabels: {
      total: t("counts.total"),
      passed: t("counts.passed"),
      failed: t("counts.failed"),
      notChecked: t("counts.notChecked"),
      defects: t("counts.defects"),
      result: t("counts.result"),
    },
    titles: {
      summary: t("summaryTitle"),
      devices: t("devicesTitle"),
      checklist: t("checklistTitle"),
      defects: t("defectsTitle"),
      gallery: t("galleryTitle"),
      notes: t("notesTitle"),
    },
    columns: {
      label: t("columns.label"),
      type: t("columns.type"),
      location: t("columns.location"),
      serial: t("columns.serial"),
      manufacturer: t("columns.manufacturer"),
      model: t("columns.model"),
      year: t("columns.year"),
      result: t("columns.result"),
      nextDue: t("columns.nextDue"),
      checkedBy: t("columns.checkedBy"),
      scan: t("scanColumn"),
    },
    devices: checks.map((check) => ({
      label: formatLabel(check.labelNumber),
      type: check.typeName,
      location: check.locationName ?? dash,
      serial: check.serialNumber ?? dash,
      manufacturer: check.manufacturer?.trim() || dash,
      model: check.model?.trim() || dash,
      year: check.manufactureYear ? String(check.manufactureYear) : dash,
      result: check.skipReason ? t(`result.${check.skipReason}`) : t(`result.${check.outcome}`),
      failed: check.outcome === "failed",
      // A new date only where the check passed; elsewhere it didn't move.
      nextDue:
        check.outcome === "passed" && check.nextDueOn
          ? calendar.format(calendarDate(check.nextDueOn))
          : dash,
      checkedBy: check.checkedBy ?? dash,
      scan: withScan ? t(`scanState.${check.scanLocation?.state ?? "unknown"}`) : dash,
      details: details(check),
      answers: answers(check),
    })),
    scan: withScan
      ? {
          summary: t("scanSummary", { matches: scanStates.matches, total: scanStates.total }),
          disclaimer: t("scanDisclaimer"),
        }
      : null,
    defectColumns: {
      number: t("defectColumns.number"),
      device: t("defectColumns.device"),
      description: t("defectColumns.description"),
      severity: t("defectColumns.severity"),
    },
    defects: [...input.defects]
      .sort((a, b) => a.number - b.number)
      .map((defect) => ({
        number: t("defectNumber", { number: defectNumber(defect.number) }),
        rawNumber: defect.number,
        device: formatLabel(defect.labelNumber),
        description: defect.again
          ? `${defect.description} (${t("defectAgain")})`
          : defect.description,
        severity: t(`severity.${defect.severity}`),
      })),
    noDefects: t("noDefects"),
    noAnswers: t("noAnswers"),
    notes: input.notes?.trim() || null,
    signatures: {
      technician: { label: t("signTechnician"), name: technicians[0] ?? null, signedAt: null },
      customer: {
        label: t("signCustomer"),
        name: input.customerSignature?.name ?? null,
        signedAt: input.customerSignature?.signedAt
          ? day.format(new Date(input.customerSignature.signedAt))
          : null,
      },
      otherLabel: t("signOther"),
    },
    signatureHint: t("signHint"),
    footer: organization.footer?.trim() || null,
    page: (page, pages) => t("page", { number, page, pages }),
    variables,
  };
}
