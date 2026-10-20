// Due dates are calendar days ("YYYY-MM-DD"), not instants: an inspection is due
// on a day, wherever the viewer happens to be. "Today" is the date in the
// organization's time zone, so a device turns overdue at the organization's
// midnight. The database computes next_due_on the same way as addMonths()
// (last inspection + the type's interval, end of month clamped: 31 Jan + 1 month
// = 28/29 Feb); tests check that the two agree.

export type IsoDate = string;

/** Worst first: lists and the map show the most urgent state of a group. */
export const DUE_STATES = ["overdue", "soon", "ok", "never"] as const;
export type DueState = (typeof DUE_STATES)[number];

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

function isLeapYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number) {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

function parse(date: IsoDate) {
  const match = ISO_DATE.exec(date);
  if (!match) throw new RangeError(`Not an ISO date: ${date}`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function format(year: number, month: number, day: number): IsoDate {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function utcTime(date: IsoDate) {
  const { year, month, day } = parse(date);
  return Date.UTC(year, month - 1, day);
}

/** A real calendar date in ISO form: 2024-02-29 is one, 2023-02-29 isn't. */
export function isIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const moved = new Date(utcTime(date) + days * DAY_MS);
  return format(moved.getUTCFullYear(), moved.getUTCMonth() + 1, moved.getUTCDate());
}

/** Calendar months; a day the target month doesn't have becomes its last day. */
export function addMonths(date: IsoDate, months: number): IsoDate {
  const { year, month, day } = parse(date);
  const index = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(index / 12);
  const targetMonth = index - targetYear * 12 + 1;
  return format(targetYear, targetMonth, Math.min(day, daysInMonth(targetYear, targetMonth)));
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((utcTime(to) - utcTime(from)) / DAY_MS);
}

/** The next due date after an inspection, as the database computes it. */
export function nextDueDate(lastInspection: IsoDate, intervalMonths: number): IsoDate {
  return addMonths(lastInspection, intervalMonths);
}

/** Today's date in a time zone (UTC if the zone is unknown to the runtime). */
export function todayInTimeZone(timeZone: string, now: Date = new Date()): IsoDate {
  const options = { year: "numeric", month: "2-digit", day: "2-digit" } as const;
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-US", { ...options, timeZone });
  } catch {
    formatter = new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" });
  }
  const parts = Object.fromEntries(
    formatter.formatToParts(now).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** How far a time zone is ahead of UTC at an instant, in milliseconds. */
function zoneOffset(instant: number, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(instant)
      .map((part) => [part.type, Number(part.value)]),
  );
  const local = Date.UTC(
    parts.year!,
    parts.month! - 1,
    parts.day!,
    parts.hour!,
    parts.minute!,
    parts.second!,
  );
  return local - Math.floor(instant / 1000) * 1000;
}

/**
 * The instant a calendar day starts in a time zone (UTC if the zone is unknown),
 * e.g. to filter timestamps by days the way the company counts them.
 */
export function startOfDayInTimeZone(date: IsoDate, timeZone: string): Date {
  const midnight = utcTime(date);
  try {
    // The offset at the guess, then at the result: right across a DST change.
    const guess = midnight - zoneOffset(midnight, timeZone);
    return new Date(midnight - zoneOffset(guess, timeZone));
  } catch {
    return new Date(midnight);
  }
}

/**
 * Due state of an active device. The due day itself still counts as "soon"
 * (the inspection can be done that day); the day after, it's overdue.
 */
export function dueState(nextDue: IsoDate | null, today: IsoDate, soonDays: number): DueState {
  if (!nextDue) return "never";
  if (nextDue < today) return "overdue";
  return nextDue <= addDays(today, soonDays) ? "soon" : "ok";
}

/** The worst of several states (a building is as urgent as its most urgent device). */
export function worstDueState(states: Iterable<DueState>): DueState | null {
  let worst: number | null = null;
  for (const state of states) {
    const rank = DUE_STATES.indexOf(state);
    if (worst === null || rank < worst) worst = rank;
  }
  return worst === null ? null : DUE_STATES[worst]!;
}

export type DueWindow =
  | { kind: "before"; date: IsoDate }
  | { kind: "between"; from: IsoDate; to: IsoDate }
  | { kind: "after"; date: IsoDate }
  | { kind: "none" };

/**
 * The next_due_on range of a state, for database filters on active devices:
 * overdue = before today, soon = today … today + soonDays, ok = later, never = empty.
 */
export function dueWindow(state: DueState, today: IsoDate, soonDays: number): DueWindow {
  switch (state) {
    case "overdue":
      return { kind: "before", date: today };
    case "soon":
      return { kind: "between", from: today, to: addDays(today, soonDays) };
    case "ok":
      return { kind: "after", date: addDays(today, soonDays) };
    case "never":
      return { kind: "none" };
  }
}

/** A calendar date for Intl formatting: UTC midnight, formatted with CALENDAR_FORMAT. */
export function calendarDate(date: IsoDate): Date {
  return new Date(utcTime(date));
}

/** Formats a calendar date the same day everywhere (the zone of the Date is UTC). */
export const CALENDAR_FORMAT = { dateStyle: "medium", timeZone: "UTC" } as const;
