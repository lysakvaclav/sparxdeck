import { formatLabel } from "@/lib/devices";
import { defectNumber } from "@/lib/defects";
import { CALENDAR_FORMAT, calendarDate } from "@/lib/due";
import type {
  CheckOutcome,
  ChecklistItemType,
  DefectSeverity,
} from "@/lib/supabase/database.types";

// What an inspection protocol says, assembled from the inspection's records.
// Pure, so the wording and order can be tested without rendering a PDF; the
// PDF (src/lib/pdf/protocol.tsx) only lays the model out.

export type ProtocolLocale = "cs" | "en";

/** "2026-0007": the year it was completed and its number within that year. */
export function protocolNumber(year: number, number: number): string {
  return `${year}-${String(number).padStart(4, "0")}`;
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
  outcome: CheckOutcome;
  nextDueOn: string | null;
  checkedBy: string | null;
  note: string | null;
  answers: ProtocolAnswer[];
};

export type ProtocolDefect = {
  number: number;
  labelNumber: number;
  description: string;
  severity: DefectSeverity;
  /** Already open before this inspection, found again. */
  again: boolean;
};

export type ProtocolInput = {
  locale: ProtocolLocale;
  timeZone: string;
  year: number;
  number: number;
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
};

/** Translated texts, as next-intl's `t` for the "protocol" namespace gives them. */
export type Translate = (key: string, values?: Record<string, string | number>) => string;

export type ProtocolModel = {
  locale: ProtocolLocale;
  fileName: string;
  title: string;
  numberLabel: string;
  number: string;
  organization: { name: string; lines: string[] };
  parties: { label: string; name: string; lines: string[] }[];
  facts: { label: string; value: string }[];
  summary: string;
  devicesTitle: string;
  columns: Record<"label" | "type" | "location" | "serial" | "result" | "nextDue", string>;
  devices: {
    label: string;
    type: string;
    location: string;
    serial: string;
    result: string;
    failed: boolean;
    nextDue: string;
    details: string[];
  }[];
  defectsTitle: string;
  defectColumns: Record<"number" | "device" | "description" | "severity", string>;
  defects: { number: string; device: string; description: string; severity: string }[];
  noDefects: string;
  notesTitle: string;
  notes: string | null;
  signatures: { label: string; name: string | null }[];
  signatureHint: string;
  footer: string | null;
  /** "Page 1 of 2" with the numbers filled in at render time. */
  page: (page: number, pages: number) => string;
};

const dash = "—";
const lines = (value: string | null | undefined) =>
  (value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
const joined = (parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" · ");

export function buildProtocol(input: ProtocolInput, t: Translate): ProtocolModel {
  const number = protocolNumber(input.year, input.number);
  const day = new Intl.DateTimeFormat(input.locale, {
    dateStyle: "medium",
    timeZone: input.timeZone,
  });
  const calendar = new Intl.DateTimeFormat(input.locale, CALENDAR_FORMAT);
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

  const details = (check: ProtocolCheck) => {
    const found = [...check.answers]
      .sort((a, b) => a.order - b.order)
      .flatMap((answer) => {
        const note = answer.note?.trim();
        if (answer.type === "pass_fail") {
          if (answer.pass === false)
            return [`${answer.question}: ${t("finding.failed")}${note ? ` (${note})` : ""}`];
          return note ? [`${answer.question}: ${note}`] : [];
        }
        const value =
          answer.type === "number"
            ? answer.number === null
              ? null
              : decimal.format(answer.number)
            : answer.text?.trim() || null;
        if (!value && !note) return [];
        return [`${answer.question}: ${[value, note && `(${note})`].filter(Boolean).join(" ")}`];
      });
    const note = check.note?.trim();
    return note ? [...found, `${t("finding.deviceNote")}: ${note}`] : found;
  };

  return {
    locale: input.locale,
    fileName: t("fileName", { number }),
    title: t("title"),
    numberLabel: t("number"),
    number,
    organization: {
      name: organization.legalName || organization.name,
      lines: [
        ...lines(organization.address),
        ids(organization.companyId, organization.vatId),
        joined([organization.email, organization.phone]),
      ].filter(Boolean),
    },
    parties: [
      {
        label: t("customer"),
        name: customer?.name ?? dash,
        lines: customer
          ? [
              ...lines(customer.billingAddress),
              ids(customer.companyId, customer.vatId),
              customer.contactPerson ? `${t("contact")}: ${customer.contactPerson}` : "",
            ].filter(Boolean)
          : [],
      },
      { label: t("site"), name: site?.name ?? dash, lines: lines(site?.address) },
    ],
    facts: [
      { label: t("date"), value: started === completed ? completed : `${started} – ${completed}` },
      { label: t("technician"), value: technicians.join(", ") || dash },
      { label: t("issued"), value: day.format(new Date(input.generatedAt)) },
    ],
    summary: t("summary", {
      total: checks.length,
      passed: count("passed"),
      failed: count("failed"),
      notChecked: count("not_checked"),
    }),
    devicesTitle: t("devicesTitle"),
    columns: {
      label: t("columns.label"),
      type: t("columns.type"),
      location: t("columns.location"),
      serial: t("columns.serial"),
      result: t("columns.result"),
      nextDue: t("columns.nextDue"),
    },
    devices: checks.map((check) => ({
      label: formatLabel(check.labelNumber),
      type: check.typeName,
      location: check.locationName ?? dash,
      serial: check.serialNumber ?? dash,
      result: t(`result.${check.outcome}`),
      failed: check.outcome === "failed",
      // A new date only where the check passed; elsewhere it didn't move.
      nextDue:
        check.outcome === "passed" && check.nextDueOn
          ? calendar.format(calendarDate(check.nextDueOn))
          : dash,
      details: details(check),
    })),
    defectsTitle: t("defectsTitle"),
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
        device: formatLabel(defect.labelNumber),
        description: defect.again
          ? `${defect.description} (${t("defectAgain")})`
          : defect.description,
        severity: t(`severity.${defect.severity}`),
      })),
    noDefects: t("noDefects"),
    notesTitle: t("notesTitle"),
    notes: input.notes?.trim() || null,
    signatures: [
      { label: t("signTechnician"), name: technicians[0] ?? null },
      { label: t("signCustomer"), name: null },
    ],
    signatureHint: t("signHint"),
    footer: organization.footer?.trim() || null,
    page: (page, pages) => t("page", { number, page, pages }),
  };
}
