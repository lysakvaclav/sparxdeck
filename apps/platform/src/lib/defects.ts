import { addDays } from "@/lib/due";
import type { DefectSeverity, DefectStatus } from "@/lib/supabase/database.types";

export const DEFECT_SEVERITIES = [
  "minor",
  "major",
  "critical",
] as const satisfies readonly DefectSeverity[];

export const DEFECT_STATUSES = [
  "open",
  "in_progress",
  "resolved",
] as const satisfies readonly DefectStatus[];

/** Badge colours: severity carries the colour; only "resolved" is green among statuses. */
export const SEVERITY_BADGE = { minor: "default", major: "warning", critical: "danger" } as const;
export const STATUS_BADGE = {
  open: "outline",
  in_progress: "default",
  resolved: "success",
} as const;

/** Most urgent first. */
export const SEVERITY_RANK: Record<DefectSeverity, number> = { critical: 0, major: 1, minor: 2 };

/** The number part of a defect's reference ("Z-0012" in Czech, "D-0012" in English). */
export function defectNumber(number: number): string {
  return String(number).padStart(4, "0");
}

/**
 * A fix-by date counts as "soon" within this many days: repairs are planned in
 * days, while the company's threshold for inspections is usually a month.
 */
export const DEFECT_DUE_SOON_DAYS = 7;

/** State of a defect's fix-by date; a resolved defect has none any more. */
export function defectDueState(
  dueOn: string | null,
  status: DefectStatus,
  today: string,
): "overdue" | "soon" | "ok" | null {
  if (!dueOn || status === "resolved") return null;
  if (dueOn < today) return "overdue";
  return dueOn <= addDays(today, DEFECT_DUE_SOON_DAYS) ? "soon" : "ok";
}
