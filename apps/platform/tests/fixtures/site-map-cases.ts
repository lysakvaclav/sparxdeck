/**
 * Shared by tests/site-map.test.ts and tests/rls.test.ts: the database's
 * due_state() and site_map_statuses() must agree with src/lib/due.ts dueState
 * and src/lib/site-map.ts siteStatus.
 */

/** Next due date, today, the company's "soon" days, and the state. */
export const DUE_STATE_CASES: [
  next: string | null,
  today: string,
  soonDays: number,
  state: "never" | "overdue" | "soon" | "ok",
][] = [
  [null, "2026-10-28", 30, "never"],
  ["2026-10-27", "2026-10-28", 30, "overdue"],
  // Due today is not overdue yet.
  ["2026-10-28", "2026-10-28", 30, "soon"],
  // Exactly the "soon" limit away still counts as soon; a day later is ok.
  ["2026-11-27", "2026-10-28", 30, "soon"],
  ["2026-11-28", "2026-10-28", 30, "ok"],
  ["2026-10-29", "2026-10-28", 1, "soon"],
  ["2026-10-30", "2026-10-28", 1, "ok"],
  // Across a year end and February.
  ["2027-01-27", "2026-12-28", 30, "soon"],
  ["2028-03-01", "2028-02-28", 1, "ok"],
];
