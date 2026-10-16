import { describe, expect, it } from "vitest";
import { dueState } from "@/lib/due";
import {
  DEFAULT_HORIZON,
  duePlan,
  horizonWindow,
  readHorizon,
  type PlanDevice,
} from "@/lib/due-plan";

const device = (siteId: string, nextDueOn: string | null): PlanDevice => ({
  siteId,
  siteName: `Site ${siteId}`,
  customerName: `Customer ${siteId}`,
  nextDueOn,
});

describe("overview horizon", () => {
  it("accepts 30, 60 or 90 days and falls back to 30", () => {
    expect(readHorizon("60")).toBe(60);
    expect(readHorizon("90")).toBe(90);
    for (const bad of [undefined, "", "45", "abc", "-30", "30.5"])
      expect(readHorizon(bad), String(bad)).toBe(DEFAULT_HORIZON);
  });

  it("runs from today to today + the horizon, across months and leap days", () => {
    expect(horizonWindow("2026-10-13", 30)).toEqual({ from: "2026-10-13", to: "2026-11-12" });
    expect(horizonWindow("2028-02-01", 30)).toEqual({ from: "2028-02-01", to: "2028-03-02" });
    expect(horizonWindow("2026-12-15", 90)).toEqual({ from: "2026-12-15", to: "2027-03-15" });
  });
});

describe("what is coming due", () => {
  const today = "2026-10-13";

  it("counts the edges: due today and on the last day are in, the day after is out", () => {
    const plan = duePlan(
      [
        device("a", "2026-10-12"), // yesterday: overdue
        device("a", "2026-10-13"), // today: still in time
        device("a", "2026-11-12"), // last day of 30
        device("a", "2026-11-13"), // one day too far
        device("a", null), // never inspected: not "coming due"
      ],
      today,
      30,
    );
    expect(plan).toMatchObject({ overdue: 1, upcoming: 2 });
    expect(plan.rows).toEqual([
      {
        siteId: "a",
        siteName: "Site a",
        customerName: "Customer a",
        overdue: 1,
        upcoming: 2,
        earliest: "2026-10-12",
      },
    ]);
  });

  it("agrees with the due states for the 'soon' boundary", () => {
    // With "soon" = 30 days, everything coming due in 30 days is "soon" and nothing else.
    for (const date of ["2026-10-13", "2026-10-20", "2026-11-12", "2026-11-13", "2026-10-12"]) {
      const inPlan = duePlan([device("a", date)], today, 30).upcoming === 1;
      expect(inPlan, date).toBe(dueState(date, today, 30) === "soon");
    }
  });

  it("widens with the horizon", () => {
    const devices = [
      device("a", "2026-11-01"),
      device("b", "2026-12-01"),
      device("c", "2027-01-05"),
    ];
    expect(duePlan(devices, today, 30).upcoming).toBe(1);
    expect(duePlan(devices, today, 60).upcoming).toBe(2);
    expect(duePlan(devices, today, 90).upcoming).toBe(3);
  });

  it("puts buildings with overdue devices first, then the earliest date", () => {
    const plan = duePlan(
      [
        device("soon", "2026-10-20"),
        device("later", "2026-11-05"),
        device("late", "2026-11-01"),
        device("late", "2026-09-30"),
        device("empty", "2027-06-01"),
      ],
      today,
      30,
    );
    expect(plan.rows.map((row) => row.siteId)).toEqual(["late", "soon", "later"]);
    expect(plan.rows[0]).toMatchObject({ overdue: 1, upcoming: 1, earliest: "2026-09-30" });
  });
});
