import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  daysBetween,
  DUE_STATES,
  dueState,
  dueWindow,
  isIsoDate,
  nextDueDate,
  startOfDayInTimeZone,
  todayInTimeZone,
  worstDueState,
  type DueWindow,
} from "@/lib/due";
import {
  buildAttributes,
  deviceName,
  deviceTypeFields,
  formatLabel,
  labelQuery,
  readAttributes,
  slugifyCode,
  type DeviceTypeField,
} from "@/lib/devices";
import { bulkDevicesSchema, deviceEditSchema, deviceSchema } from "@/lib/validation";
import { NEXT_DUE_CASES } from "./fixtures/due-cases";

describe("calendar dates", () => {
  it("recognises real calendar dates only", () => {
    expect(isIsoDate("2028-02-29")).toBe(true);
    expect(isIsoDate("2026-12-31")).toBe(true);
    for (const bad of ["2026-02-29", "2100-02-29", "2026-13-01", "2026-04-31", "2026-1-1", "", "x"])
      expect(isIsoDate(bad), bad).toBe(false);
    expect(isIsoDate("2000-02-29")).toBe(true);
  });

  it("adds months like the database, clamping to the end of the month", () => {
    for (const [last, months, next] of NEXT_DUE_CASES) {
      expect(addMonths(last, months), `${last} + ${months}`).toBe(next);
      expect(nextDueDate(last, months)).toBe(next);
    }
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
    expect(addMonths("2026-01-15", -1)).toBe("2025-12-15");
  });

  it("adds days across months, years and leap days", () => {
    expect(addDays("2026-10-12", 30)).toBe("2026-11-11");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    // Daylight saving changes don't shift calendar days.
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30");
    expect(addDays("2026-10-24", 2)).toBe("2026-10-26");
  });

  it("counts whole days between dates", () => {
    expect(daysBetween("2026-10-12", "2026-10-12")).toBe(0);
    expect(daysBetween("2026-10-12", "2026-11-11")).toBe(30);
    expect(daysBetween("2026-10-12", "2026-10-02")).toBe(-10);
    expect(daysBetween("2028-02-01", "2028-03-01")).toBe(29);
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
  });
});

describe("today in the organization's time zone", () => {
  it("follows the local midnight, not the server's", () => {
    // 22:30 UTC on 31 March = 00:30 on 1 April in Prague (summer time).
    const lateMarch = new Date("2026-03-31T22:30:00Z");
    expect(todayInTimeZone("Europe/Prague", lateMarch)).toBe("2026-04-01");
    expect(todayInTimeZone("UTC", lateMarch)).toBe("2026-03-31");
    expect(todayInTimeZone("America/New_York", lateMarch)).toBe("2026-03-31");
    expect(todayInTimeZone("Asia/Tbilisi", lateMarch)).toBe("2026-04-01");

    // New Year's Eve: Prague (winter time, UTC+1) is already in the new year.
    const newYear = new Date("2026-12-31T23:30:00Z");
    expect(todayInTimeZone("Europe/Prague", newYear)).toBe("2027-01-01");
    expect(todayInTimeZone("Asia/Riyadh", newYear)).toBe("2027-01-01");
    expect(todayInTimeZone("UTC", newYear)).toBe("2026-12-31");

    // The night summer time ends.
    const dstEnd = new Date("2026-10-25T00:30:00Z");
    expect(todayInTimeZone("Europe/Prague", dstEnd)).toBe("2026-10-25");
    expect(todayInTimeZone("Pacific/Kiritimati", dstEnd)).toBe("2026-10-25");
    expect(todayInTimeZone("Pacific/Pago_Pago", dstEnd)).toBe("2026-10-24");
  });

  it("falls back to UTC for an unknown zone", () => {
    expect(todayInTimeZone("Mars/Olympus", new Date("2026-03-31T22:30:00Z"))).toBe("2026-03-31");
    expect(startOfDayInTimeZone("2026-03-31", "Mars/Olympus").toISOString()).toBe(
      "2026-03-31T00:00:00.000Z",
    );
  });

  it("knows when a day starts in a time zone, also across summer time", () => {
    const start = (date: string, zone: string) => startOfDayInTimeZone(date, zone).toISOString();
    expect(start("2026-01-15", "Europe/Prague")).toBe("2026-01-14T23:00:00.000Z");
    expect(start("2026-07-15", "Europe/Prague")).toBe("2026-07-14T22:00:00.000Z");
    // The days summer time starts and ends: midnight is still on the old offset.
    expect(start("2026-03-29", "Europe/Prague")).toBe("2026-03-28T23:00:00.000Z");
    expect(start("2026-03-30", "Europe/Prague")).toBe("2026-03-29T22:00:00.000Z");
    expect(start("2026-10-25", "Europe/Prague")).toBe("2026-10-24T22:00:00.000Z");
    expect(start("2026-10-26", "Europe/Prague")).toBe("2026-10-25T23:00:00.000Z");
    expect(start("2026-07-15", "America/New_York")).toBe("2026-07-15T04:00:00.000Z");
    expect(start("2026-07-15", "Asia/Tbilisi")).toBe("2026-07-14T20:00:00.000Z");
    expect(start("2026-07-15", "UTC")).toBe("2026-07-15T00:00:00.000Z");
    // Round trip: the start is that day there.
    for (const zone of ["Europe/Prague", "America/New_York", "Asia/Riyadh"])
      expect(todayInTimeZone(zone, startOfDayInTimeZone("2026-10-25", zone))).toBe("2026-10-25");
  });

  it("decides the due state by the organization's date", () => {
    // Due 31 March: still "soon" in New York, already overdue in Prague.
    const lateMarch = new Date("2026-03-31T22:30:00Z");
    expect(dueState("2026-03-31", todayInTimeZone("America/New_York", lateMarch), 30)).toBe("soon");
    expect(dueState("2026-03-31", todayInTimeZone("Europe/Prague", lateMarch), 30)).toBe("overdue");
  });
});

describe("due state", () => {
  const today = "2026-10-12";

  it("has exact boundaries", () => {
    expect(dueState(null, today, 30)).toBe("never");
    expect(dueState("2026-10-11", today, 30)).toBe("overdue");
    // The due day itself is not overdue yet.
    expect(dueState("2026-10-12", today, 30)).toBe("soon");
    expect(dueState("2026-11-11", today, 30)).toBe("soon");
    expect(dueState("2026-11-12", today, 30)).toBe("ok");
    expect(dueState("2026-10-13", today, 1)).toBe("soon");
    expect(dueState("2026-10-14", today, 1)).toBe("ok");
  });

  it("handles leap years and month ends", () => {
    expect(dueState("2028-02-29", "2028-02-28", 1)).toBe("soon");
    expect(dueState("2028-02-29", "2028-03-01", 30)).toBe("overdue");
    expect(dueState("2027-02-28", "2027-01-29", 30)).toBe("soon");
    expect(dueState("2027-03-01", "2027-01-29", 30)).toBe("ok");
    // A year after an inspection on 29 Feb, the due date is 28 Feb.
    expect(dueState(nextDueDate("2028-02-29", 12), "2029-03-01", 30)).toBe("overdue");
  });

  it("matches the database filter windows for every date", () => {
    const contains = (window: DueWindow, date: string | null) => {
      switch (window.kind) {
        case "none":
          return date === null;
        case "before":
          return date !== null && date < window.date;
        case "between":
          return date !== null && date >= window.from && date <= window.to;
        case "after":
          return date !== null && date > window.date;
      }
    };
    for (const soonDays of [1, 30, 45, 365]) {
      for (let offset = -400; offset <= 400; offset += 1) {
        const date = addDays(today, offset);
        const state = dueState(date, today, soonDays);
        const matching = DUE_STATES.filter((s) => contains(dueWindow(s, today, soonDays), date));
        expect(matching, `${date} / ${soonDays}`).toEqual([state]);
      }
      expect(DUE_STATES.filter((s) => contains(dueWindow(s, today, soonDays), null))).toEqual([
        "never",
      ]);
    }
  });

  it("rolls up the most urgent state", () => {
    expect(worstDueState(["ok", "never", "soon"])).toBe("soon");
    expect(worstDueState(["ok", "overdue"])).toBe("overdue");
    expect(worstDueState(["never", "ok"])).toBe("ok");
    expect(worstDueState([])).toBeNull();
  });
});

describe("device helpers", () => {
  it("formats and finds label numbers", () => {
    expect(formatLabel(7)).toBe("0007");
    expect(formatLabel(12345)).toBe("12345");
    expect(deviceName("Hasicí přístroj", 12)).toBe("Hasicí přístroj 0012");
    expect(labelQuery("7")).toBe(7);
    expect(labelQuery("0007")).toBe(7);
    expect(labelQuery(" #12 ")).toBe(12);
    expect(labelQuery("# 12")).toBe(12);
    for (const bad of ["", "0", "000", "12a", "1 2", "-3", "1234567890"])
      expect(labelQuery(bad), bad).toBeNull();
  });

  const fireFields: DeviceTypeField[] = [
    { key: "agent", label: "Hasivo" },
    { key: "size", label: "Velikost" },
  ];

  it("keeps only the attributes of the device's type", () => {
    expect(
      buildAttributes(fireFields, { agent: " prášek ", size: "", model: "x" } as never),
    ).toEqual({
      agent: "prášek",
    });
    expect(buildAttributes([], { agent: "prášek" })).toEqual({});
    expect(readAttributes({ agent: "CO2", size: 6, extra: "x" }, fireFields)).toEqual({
      agent: "CO2",
    });
    expect(readAttributes(null, fireFields)).toEqual({});
    expect(readAttributes(["agent"], fireFields)).toEqual({});
  });

  it("reads a type's own fields, dropping anything malformed", () => {
    expect(deviceTypeFields(fireFields)).toEqual(fireFields);
    expect(deviceTypeFields(null)).toEqual([]);
    expect(deviceTypeFields("agent")).toEqual([]);
    expect(deviceTypeFields([{ key: "ok", label: "Ok" }, { key: "Bad Key", label: "x" }, "junk", { label: "no key" }])).toEqual([
      { key: "ok", label: "Ok" },
    ]);
  });

  it("derives a technical code from a type's name", () => {
    expect(slugifyCode("Hydrant")).toBe("hydrant");
    expect(slugifyCode("Nouzové osvětlení")).toBe("nouzove_osvetleni");
    expect(slugifyCode("  ")).toBe("t_");
    expect(slugifyCode("123")).toBe("t_123");
    expect(slugifyCode("A")).toBe("a0");
    expect(/^[a-z][a-z0-9_]{1,40}$/.test(slugifyCode("!@#"))).toBe(true);
  });
});

describe("device validation", () => {
  const type = "6f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f";
  const base = {
    siteId: "0a1b2c3d-4e5f-4a6b-9c7d-8e9f0a1b2c3d",
    deviceTypeId: type,
    locationId: "",
    serialNumber: "",
    manufacturer: "",
    model: "",
    manufactureYear: "",
    customFields: {},
    installedOn: "",
    lastInspectionOn: "",
    endOfLifeOn: "",
    notes: "",
  };

  it("turns empty optional fields into nulls", () => {
    const parsed = deviceSchema.parse({ ...base, serialNumber: " SN-1 ", manufactureYear: "2021" });
    expect(parsed).toMatchObject({
      serialNumber: "SN-1",
      manufactureYear: 2021,
      locationId: null,
      lastInspectionOn: null,
      notes: null,
    });
  });

  it("explains wrong dates, years and types", () => {
    const issue = (input: object) =>
      deviceSchema.safeParse({ ...base, ...input }).error?.issues[0]?.message;
    expect(issue({ lastInspectionOn: "2026-02-30" })).toBe("dateInvalid");
    expect(issue({ lastInspectionOn: "1989-12-31" })).toBe("dateInvalid");
    expect(issue({ lastInspectionOn: addDays(todayInTimeZone("UTC"), 3) })).toBe("dateInFuture");
    expect(issue({ manufactureYear: "21" })).toBe("yearInvalid");
    expect(issue({ manufactureYear: "1890" })).toBe("yearInvalid");
    expect(issue({ deviceTypeId: "" })).toBe("required");
    expect(issue({ siteId: "" })).toBe("required");
    expect(issue({ locationId: "nonsense" })).toBe("notFound");
    expect(deviceEditSchema.safeParse({ ...base, status: "lost" }).success).toBe(false);
    expect(deviceEditSchema.parse({ ...base, status: "removed" }).status).toBe("removed");
  });

  it("checks the count and the serial numbers of a bulk add", () => {
    const bulk = { ...base, count: "3", serialNumbers: "" };
    delete (bulk as Partial<typeof bulk>).serialNumber;
    expect(bulkDevicesSchema.parse(bulk)).toMatchObject({ count: 3, serialNumbers: [] });
    expect(
      bulkDevicesSchema.parse({ ...bulk, serialNumbers: " A1 \n\nA2\r\nA3\n" }).serialNumbers,
    ).toEqual(["A1", "A2", "A3"]);

    const issue = (input: object) =>
      bulkDevicesSchema.safeParse({ ...bulk, ...input }).error?.issues[0]?.message;
    expect(issue({ count: "0" })).toBe("countInvalid");
    expect(issue({ count: "101" })).toBe("countInvalid");
    expect(issue({ count: "2.5" })).toBe("countInvalid");
    expect(issue({ count: "abc" })).toBe("countInvalid");
    expect(issue({ serialNumbers: "A1\nA2" })).toBe("serialCountMismatch");
    expect(issue({ serialNumbers: `A1\nA2\n${"x".repeat(81)}` })).toBe("tooLong");
  });
});
