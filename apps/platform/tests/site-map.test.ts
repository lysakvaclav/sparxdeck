import { describe, expect, it } from "vitest";
import { dueState } from "@/lib/due";
import {
  graticule,
  mapHref,
  pointsBounds,
  readMapFilters,
  siteStatus,
  sitePoints,
  sortSites,
  worstStatus,
  type SiteCounts,
  type SiteMapRow,
} from "@/lib/site-map";
import { DUE_STATE_CASES } from "./fixtures/site-map-cases";

const counts = (patch: Partial<SiteCounts> = {}): SiteCounts => ({
  devices: 3,
  overdue: 0,
  soon: 0,
  never: 0,
  defects_critical: 0,
  defects_major: 0,
  defects_minor: 0,
  ...patch,
});

const row = (patch: Partial<SiteMapRow>): SiteMapRow => ({
  site_id: "s",
  name: "Budova",
  address: null,
  customer_id: "c",
  customer_name: "Zákazník",
  latitude: 50,
  longitude: 14,
  status: "ok",
  next_due: null,
  ...counts(),
  ...patch,
});

describe("due-date rule shared with the database", () => {
  it.each(DUE_STATE_CASES)("next %s, today %s, soon %i days: %s", (next, today, soon, state) => {
    expect(dueState(next, today, soon)).toBe(state);
  });
});

describe("a building's state", () => {
  it("is grey without active devices", () => {
    expect(siteStatus(counts({ devices: 0, defects_critical: 2 }))).toBe("none");
  });
  it("is red for an overdue device or an open critical defect", () => {
    expect(siteStatus(counts({ overdue: 1 }))).toBe("critical");
    expect(siteStatus(counts({ defects_critical: 1, soon: 2 }))).toBe("critical");
  });
  it("is yellow for a device due soon or never inspected, or a major or minor defect", () => {
    expect(siteStatus(counts({ soon: 1 }))).toBe("warning");
    expect(siteStatus(counts({ never: 1 }))).toBe("warning");
    expect(siteStatus(counts({ defects_major: 1 }))).toBe("warning");
    expect(siteStatus(counts({ defects_minor: 1 }))).toBe("warning");
  });
  it("is green when everything is in time and nothing is open", () => {
    expect(siteStatus(counts())).toBe("ok");
  });
  it("takes the worst of several (a cluster)", () => {
    expect(worstStatus(["ok", "warning", "none"])).toBe("warning");
    expect(worstStatus(["ok", "critical"])).toBe("critical");
    expect(worstStatus([])).toBeNull();
  });
});

describe("the list beside the map", () => {
  it("puts the most urgent first, then more overdue, nearer due dates, names", () => {
    const rows = [
      row({ site_id: "a", name: "Bez", status: "ok", next_due: "2027-05-01" }),
      row({ site_id: "b", name: "Červená 1", status: "critical", overdue: 1 }),
      row({ site_id: "c", name: "Červená 2", status: "critical", overdue: 4 }),
      row({ site_id: "d", name: "Žlutá", status: "warning", next_due: "2026-11-02" }),
      row({ site_id: "e", name: "Prázdná", status: "none", devices: 0 }),
      row({ site_id: "f", name: "Áčko", status: "ok", next_due: "2027-05-01" }),
    ];
    expect(sortSites(rows, "cs").map((r) => r.site_id)).toEqual(["c", "b", "d", "f", "a", "e"]);
  });
});

describe("filters in the address", () => {
  const id = "0b9f6a0e-5f4c-4d8b-9c6e-2a1b3c4d5e6f";
  it("keeps valid ids and states, drops the rest", () => {
    expect(
      readMapFilters({ customer: id, type: "nope", technician: [id], status: "critical" }),
    ).toEqual({ customer: id, type: undefined, technician: id, status: "critical" });
    expect(readMapFilters({ status: "purple" }).status).toBeUndefined();
  });
  it("writes only what is set", () => {
    expect(mapHref({})).toBe("/map");
    expect(mapHref({ status: "warning", customer: id })).toBe(`/map?customer=${id}&status=warning`);
  });
});

describe("what the map draws", () => {
  it("draws only buildings with a point, longitude first", () => {
    const points = sitePoints([
      row({ site_id: "a", latitude: 50.08, longitude: 14.42, status: "warning" }),
      row({ site_id: "b", latitude: null, longitude: null }),
    ]);
    expect(points.features).toEqual([
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [14.42, 50.08] },
        properties: { id: "a", status: "warning", rank: 1 },
      },
    ]);
  });
  it("fits all buildings, or none without points", () => {
    expect(
      pointsBounds([
        row({ latitude: 50, longitude: 14 }),
        row({ latitude: 49, longitude: 17 }),
        row({ latitude: null, longitude: null }),
      ]),
    ).toEqual([14, 49, 17, 50]);
    expect(pointsBounds([row({ latitude: null, longitude: null })])).toBeNull();
  });
  it("draws a grid of degrees for orientation", () => {
    const grid = graticule(10);
    expect(grid.features.length).toBe(37 + 17);
  });
});
