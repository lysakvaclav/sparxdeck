import { weekStart } from "@/lib/digest";
import { addDays, addMonths, isIsoDate, type IsoDate } from "@/lib/due";
import type { InspectionStatus } from "@/lib/supabase/database.types";

// The planning calendar: month grids, plan states and technicians' workload.
// Pure functions (dates are calendar days in the company's time zone).

const MONTH = /^(\d{4})-(\d{2})$/;

/** "2026-10" from the URL, or the month of `today` when missing or invalid. */
export function parseMonth(value: string | undefined, today: IsoDate): string {
  const match = value ? MONTH.exec(value) : null;
  if (match && isIsoDate(`${value}-01`)) return value!;
  return today.slice(0, 7);
}

export function shiftMonth(month: string, months: number): string {
  return addMonths(`${month}-01`, months).slice(0, 7);
}

/** Weeks (Monday to Sunday) covering the whole month: 4 to 6 rows of 7 days. */
export function monthGrid(month: string): IsoDate[][] {
  const first = `${month}-01`;
  const last = addDays(addMonths(first, 1), -1);
  const weeks: IsoDate[][] = [];
  for (let start = weekStart(first); start <= last; start = addDays(start, 7))
    weeks.push(Array.from({ length: 7 }, (_, index) => addDays(start, index)));
  return weeks;
}

/** First and last day shown by a month grid (days of the neighbouring months included). */
export function gridRange(month: string): { from: IsoDate; to: IsoDate } {
  const weeks = monthGrid(month);
  return { from: weeks[0]![0]!, to: weeks.at(-1)![6]! };
}

export type PlanState = "planned" | "missed" | "inProgress" | "done";

/**
 * Where a planned visit stands: carried out by an inspection (running or
 * completed), still ahead, or in the past without an inspection.
 */
export function planState(
  plannedOn: IsoDate,
  inspection: InspectionStatus | null,
  today: IsoDate,
): PlanState {
  if (inspection === "completed") return "done";
  if (inspection === "in_progress") return "inProgress";
  return plannedOn < today ? "missed" : "planned";
}

/** Mondays of `count` weeks from the week of `today`. */
export function upcomingWeeks(today: IsoDate, count: number): IsoDate[] {
  const start = weekStart(today);
  return Array.from({ length: count }, (_, index) => addDays(start, index * 7));
}

export type WorkloadPlan = { siteId: string; plannedOn: IsoDate; technicianId: string | null };
export type WorkloadCell = { visits: number; devices: number };
export type WorkloadRow = {
  technicianId: string | null;
  weeks: WorkloadCell[];
  total: WorkloadCell;
};

/**
 * Planned visits and the devices they cover, per technician and week. Rows for
 * every given technician (empty weeks included) and, when there are any,
 * unassigned visits last.
 */
export function workload(
  plans: readonly WorkloadPlan[],
  devicesBySite: Readonly<Record<string, number>>,
  technicians: readonly string[],
  weeks: readonly IsoDate[],
): WorkloadRow[] {
  const empty = (): WorkloadCell => ({ visits: 0, devices: 0 });
  const rows = new Map<string | null, WorkloadRow>();
  for (const id of technicians)
    rows.set(id, { technicianId: id, weeks: weeks.map(empty), total: empty() });
  const end = weeks.length ? addDays(weeks.at(-1)!, 7) : "";
  for (const plan of plans) {
    if (!weeks.length || plan.plannedOn < weeks[0]! || plan.plannedOn >= end) continue;
    const index = weeks.indexOf(weekStart(plan.plannedOn));
    if (index < 0) continue;
    let row = rows.get(plan.technicianId);
    if (!row) {
      row = { technicianId: plan.technicianId, weeks: weeks.map(empty), total: empty() };
      rows.set(plan.technicianId, row);
    }
    const devices = devicesBySite[plan.siteId] ?? 0;
    row.weeks[index]!.visits += 1;
    row.weeks[index]!.devices += devices;
    row.total.visits += 1;
    row.total.devices += devices;
  }
  const result = [...rows.values()].filter((row) => row.technicianId !== null);
  const unassigned = rows.get(null);
  if (unassigned) result.push(unassigned);
  return result;
}
