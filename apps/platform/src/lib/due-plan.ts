import { addDays, type IsoDate } from "@/lib/due";

// What is coming due, building by building: the office plans inspections per
// building, so the overview groups devices by where the technician has to go.

/** How far ahead the overview looks, in days. */
export const HORIZONS = [30, 60, 90] as const;
export type Horizon = (typeof HORIZONS)[number];
export const DEFAULT_HORIZON: Horizon = 30;

export function readHorizon(value: string | undefined): Horizon {
  const number = Number(value);
  return HORIZONS.includes(number as Horizon) ? (number as Horizon) : DEFAULT_HORIZON;
}

/**
 * The next_due_on range "coming due within the horizon": from today (the due
 * day itself still counts, as in dueState) to today + horizon, both included.
 * Overdue devices (before today) are counted apart.
 */
export function horizonWindow(today: IsoDate, horizon: number): { from: IsoDate; to: IsoDate } {
  return { from: today, to: addDays(today, horizon) };
}

export type PlanDevice = {
  siteId: string;
  siteName: string;
  customerName: string | null;
  nextDueOn: IsoDate | null;
};

export type PlanRow = {
  siteId: string;
  siteName: string;
  customerName: string | null;
  overdue: number;
  upcoming: number;
  /** The earliest due date in the building (overdue ones included). */
  earliest: IsoDate;
};

export type DuePlan = { rows: PlanRow[]; overdue: number; upcoming: number };

/**
 * Buildings with overdue devices or devices due within the horizon: overdue
 * buildings first, then by the earliest date, then by name.
 */
export function duePlan(devices: readonly PlanDevice[], today: IsoDate, horizon: number): DuePlan {
  const { to } = horizonWindow(today, horizon);
  const bySite = new Map<string, PlanRow>();
  let overdue = 0;
  let upcoming = 0;
  for (const device of devices) {
    const due = device.nextDueOn;
    if (!due || due > to) continue;
    const late = due < today;
    if (late) overdue++;
    else upcoming++;
    const row = bySite.get(device.siteId) ?? {
      siteId: device.siteId,
      siteName: device.siteName,
      customerName: device.customerName,
      overdue: 0,
      upcoming: 0,
      earliest: due,
    };
    if (late) row.overdue++;
    else row.upcoming++;
    if (due < row.earliest) row.earliest = due;
    bySite.set(device.siteId, row);
  }
  const rows = [...bySite.values()].sort(
    (a, b) =>
      Number(b.overdue > 0) - Number(a.overdue > 0) ||
      a.earliest.localeCompare(b.earliest) ||
      a.siteName.localeCompare(b.siteName),
  );
  return { rows, overdue, upcoming };
}
