import { formatLabel } from "@/lib/devices";
import { defectNumber } from "@/lib/defects";
import { CALENDAR_FORMAT, calendarDate } from "@/lib/due";
import type { DefectSeverity } from "@/lib/supabase/database.types";
import type { ProtocolLocale, Translate } from "@/lib/protocol";

// A report across many inspections, grouped by building: not a numbered
// protocol (nothing is stored, nothing is signed), just an overview for the
// office. Pure, like protocol.ts, so it can be tested without rendering a PDF.

export type SummaryInspection = {
  date: string;
  protocolNumber: string | null;
  passed: number;
  failed: number;
  notChecked: number;
};

export type SummaryDefect = {
  number: number;
  labelNumber: number;
  description: string;
  severity: DefectSeverity;
  openSince: string;
};

export type SummaryBuilding = {
  siteName: string;
  customerName: string | null;
  inspections: SummaryInspection[];
  openDefects: SummaryDefect[];
};

export type ProtocolSummaryInput = {
  locale: ProtocolLocale;
  timeZone: string;
  generatedAt: string;
  from: string;
  to: string;
  customerName: string | null;
  siteName: string | null;
  organization: { name: string; legalName: string | null };
  buildings: SummaryBuilding[];
};

export type ProtocolSummaryModel = {
  locale: ProtocolLocale;
  fileName: string;
  title: string;
  organizationName: string;
  period: string;
  scope: string;
  generatedAt: string;
  summary: string;
  buildingsTitle: string;
  inspectionColumns: Record<"date" | "number" | "result", string>;
  defectColumns: Record<"number" | "device" | "description" | "severity" | "since", string>;
  noInspections: string;
  noDefects: string;
  buildings: {
    siteName: string;
    customerName: string | null;
    inspections: { date: string; number: string; result: string }[];
    openDefects: {
      number: string;
      device: string;
      description: string;
      severity: string;
      since: string;
    }[];
  }[];
  page: (page: number, pages: number) => string;
};

export function buildProtocolSummary(
  input: ProtocolSummaryInput,
  t: Translate,
): ProtocolSummaryModel {
  // Instants (inspections, defects, now) in the company's time zone; the
  // period's bounds are calendar days.
  const day = new Intl.DateTimeFormat(input.locale, {
    dateStyle: "medium",
    timeZone: input.timeZone,
  });
  const calendar = new Intl.DateTimeFormat(input.locale, CALENDAR_FORMAT);
  const scopeParts = [
    input.customerName ? `${t("scope.customer")}: ${input.customerName}` : null,
    input.siteName ? `${t("scope.site")}: ${input.siteName}` : null,
  ].filter((part): part is string => part !== null);

  const buildings = [...input.buildings].sort((a, b) => a.siteName.localeCompare(b.siteName));
  const inspections = buildings.flatMap((building) => building.inspections);
  const defects = buildings.flatMap((building) => building.openDefects);

  return {
    locale: input.locale,
    fileName: t("fileName"),
    title: t("title"),
    organizationName: input.organization.legalName || input.organization.name,
    period: t("period", {
      from: calendar.format(calendarDate(input.from)),
      to: calendar.format(calendarDate(input.to)),
    }),
    scope: scopeParts.length > 0 ? scopeParts.join(" · ") : t("scope.all"),
    generatedAt: day.format(new Date(input.generatedAt)),
    summary: t("summary", {
      buildings: buildings.length,
      inspections: inspections.length,
      defects: defects.length,
    }),
    buildingsTitle: t("buildingsTitle"),
    inspectionColumns: {
      date: t("inspectionColumns.date"),
      number: t("inspectionColumns.number"),
      result: t("inspectionColumns.result"),
    },
    defectColumns: {
      number: t("defectColumns.number"),
      device: t("defectColumns.device"),
      description: t("defectColumns.description"),
      severity: t("defectColumns.severity"),
      since: t("defectColumns.since"),
    },
    noInspections: t("noInspections"),
    noDefects: t("noDefects"),
    buildings: buildings.map((building) => ({
      siteName: building.siteName,
      customerName: building.customerName,
      inspections: [...building.inspections]
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .map((inspection) => ({
          date: day.format(new Date(inspection.date)),
          number: inspection.protocolNumber ?? "—",
          result: t("result", {
            passed: inspection.passed,
            failed: inspection.failed,
            notChecked: inspection.notChecked,
          }),
        })),
      openDefects: [...building.openDefects]
        .sort((a, b) => a.number - b.number)
        .map((defect) => ({
          number: t("defectNumber", { number: defectNumber(defect.number) }),
          device: formatLabel(defect.labelNumber),
          description: defect.description,
          severity: t(`severity.${defect.severity}`),
          since: day.format(new Date(defect.openSince)),
        })),
    })),
    page: (page, pages) => t("page", { page, pages }),
  };
}
