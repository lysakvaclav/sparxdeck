import { describe, expect, it } from "vitest";
import {
  gridRange,
  monthGrid,
  parseMonth,
  planState,
  shiftMonth,
  upcomingWeeks,
  workload,
} from "@/lib/calendar";

describe("planning calendar", () => {
  it("reads the month from the URL or falls back to today's", () => {
    expect(parseMonth("2026-02", "2026-10-24")).toBe("2026-02");
    for (const bad of [undefined, "", "2026-13", "2026-1", "abc", "2026-02-01"])
      expect(parseMonth(bad, "2026-10-24"), String(bad)).toBe("2026-10");
  });

  it("moves between months across years", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-03", 0)).toBe("2026-03");
  });

  it("covers the month in whole weeks from Monday", () => {
    // October 2026 starts on a Thursday and ends on a Saturday.
    const october = monthGrid("2026-10");
    expect(october).toHaveLength(5);
    expect(october[0]).toEqual([
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
    ]);
    expect(october.at(-1)!.at(-1)).toBe("2026-11-01");
    expect(october.every((week) => week.length === 7)).toBe(true);
    // February 2027 starts on a Monday and has exactly four weeks.
    expect(monthGrid("2027-02")).toHaveLength(4);
    // A leap February.
    expect(monthGrid("2028-02").flat()).toContain("2028-02-29");
    // August 2026 needs six rows (Saturday the 1st, Monday the 31st).
    expect(monthGrid("2026-08")).toHaveLength(6);
    expect(gridRange("2026-10")).toEqual({ from: "2026-09-28", to: "2026-11-01" });
  });

  it("tells a planned visit from a done, running or missed one", () => {
    expect(planState("2026-10-30", null, "2026-10-24")).toBe("planned");
    expect(planState("2026-10-24", null, "2026-10-24")).toBe("planned");
    expect(planState("2026-10-23", null, "2026-10-24")).toBe("missed");
    expect(planState("2026-10-23", "in_progress", "2026-10-24")).toBe("inProgress");
    expect(planState("2026-10-30", "completed", "2026-10-24")).toBe("done");
  });

  it("counts visits and devices per technician and week, unassigned last", () => {
    const weeks = upcomingWeeks("2026-10-24", 3);
    expect(weeks).toEqual(["2026-10-19", "2026-10-26", "2026-11-02"]);
    const rows = workload(
      [
        { siteId: "a", plannedOn: "2026-10-20", technicianId: "petr" },
        { siteId: "b", plannedOn: "2026-10-25", technicianId: "petr" },
        { siteId: "a", plannedOn: "2026-11-03", technicianId: null },
        { siteId: "b", plannedOn: "2026-11-09", technicianId: "petr" }, // after the weeks shown
        { siteId: "b", plannedOn: "2026-10-18", technicianId: "petr" }, // before them
        { siteId: "c", plannedOn: "2026-10-27", technicianId: "former" }, // not in the team list
      ],
      { a: 6, b: 3 },
      ["petr", "jana"],
      weeks,
    );
    expect(rows.map((row) => row.technicianId)).toEqual(["petr", "jana", "former", null]);
    expect(rows[0]!.weeks).toEqual([
      { visits: 2, devices: 9 },
      { visits: 0, devices: 0 },
      { visits: 0, devices: 0 },
    ]);
    expect(rows[0]!.total).toEqual({ visits: 2, devices: 9 });
    expect(rows[1]!.total).toEqual({ visits: 0, devices: 0 });
    expect(rows[2]!.weeks[1]).toEqual({ visits: 1, devices: 0 });
    expect(rows[3]!.weeks[2]).toEqual({ visits: 1, devices: 6 });
    expect(workload([], {}, [], weeks)).toEqual([]);
  });
});
