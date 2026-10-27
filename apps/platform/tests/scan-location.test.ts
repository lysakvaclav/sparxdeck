import { describe, expect, it } from "vitest";
import {
  SCAN_LOCATION_RULES,
  captureErrorOf,
  distanceMeters,
  parseCoordinates,
  scanLocationSummary,
  scanLocationVerdict,
  validCoordinates,
} from "@/lib/scan-location";
import { siteSchema } from "@/lib/validation";
import { DISTANCE_CASES, VERDICT_CASES } from "./fixtures/scan-location-cases";

describe("scan location: distance", () => {
  it.each(DISTANCE_CASES)("(%f, %f) to (%f, %f) is %i m", (latA, lngA, latB, lngB, metres) => {
    const distance = distanceMeters(
      { latitude: latA, longitude: lngA },
      { latitude: latB, longitude: lngB },
    );
    expect(Math.round(distance)).toBe(metres);
  });

  it("is the same both ways", () => {
    const a = { latitude: 49.8, longitude: 18.26 };
    const b = { latitude: 50.21, longitude: 15.83 };
    expect(distanceMeters(a, b)).toBeCloseTo(distanceMeters(b, a), 6);
  });
});

describe("scan location: verdict", () => {
  it.each(VERDICT_CASES)("distance %s, accuracy %s, radius %s: %s", (d, a, r, state) => {
    expect(scanLocationVerdict(d, a, r)).toBe(state);
  });

  it("treats a reading at exactly the accuracy limit as usable", () => {
    expect(scanLocationVerdict(0, SCAN_LOCATION_RULES.maxAccuracyM, 150)).toBe("matches");
    expect(scanLocationVerdict(0, SCAN_LOCATION_RULES.maxAccuracyM + 0.1, 150)).toBe("unknown");
  });
});

describe("scan location: typed and pasted coordinates", () => {
  it.each([
    ["50.0755, 14.4378", 50.0755, 14.4378],
    ["50.0755,14.4378", 50.0755, 14.4378],
    ["50.0755 14.4378", 50.0755, 14.4378],
    ["  50.0755,   14.4378 ", 50.0755, 14.4378],
    ["50,0755; 14,4378", 50.0755, 14.4378],
    ["50,0755, 14,4378", 50.0755, 14.4378],
    ["50,0755 14,4378", 50.0755, 14.4378],
    ["50.0755003N, 14.4378372E", 50.0755003, 14.4378372],
    ["14.4378E, 50.0755N", 50.0755, 14.4378],
    ["33.8688S, 151.2093E", -33.8688, 151.2093],
    ["40.7128N, 74.0060W", 40.7128, -74.006],
    ["-33.8688, 151.2093", -33.8688, 151.2093],
  ])("reads %j", (text, latitude, longitude) => {
    expect(parseCoordinates(text)).toEqual({ latitude, longitude });
  });

  it.each(["", "Praha", "50.0755", "50,0755,14,4378", "91, 14", "50, 181", "50, 14, 3", "a, b"])(
    "refuses %j",
    (text) => {
      expect(parseCoordinates(text)).toBeNull();
    },
  );

  it("checks the ranges", () => {
    expect(validCoordinates(90, 180)).toBe(true);
    expect(validCoordinates(-90, -180)).toBe(true);
    expect(validCoordinates(90.0001, 0)).toBe(false);
    expect(validCoordinates(0, -180.0001)).toBe(false);
    expect(validCoordinates(Number.NaN, 0)).toBe(false);
  });

  // The form's hidden source field is empty until a point is set; a building
  // without coordinates once failed to save without any message.
  it("saves a building without a point", () => {
    const form = {
      name: "Lipová 12",
      address: "",
      accessNotes: "",
      notes: "",
      coordinates: "",
      radius: "150",
      locationSource: "",
    };
    const parsed = siteSchema.safeParse(form);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.locationSource).toBeUndefined();
    expect(siteSchema.parse({ ...form, locationSource: "device" }).locationSource).toBe("device");
    expect(siteSchema.safeParse({ ...form, locationSource: "gps" }).success).toBe(false);
  });
});

describe("scan location: capture and summary", () => {
  it("names why the phone had no position", () => {
    expect(captureErrorOf(1)).toBe("denied");
    expect(captureErrorOf(2)).toBe("unavailable");
    expect(captureErrorOf(3)).toBe("timeout");
  });

  it("counts devices for the protocol's summary line", () => {
    expect(scanLocationSummary(["matches", "matches", "mismatch", "unknown", null])).toEqual({
      matches: 2,
      mismatch: 1,
      unknown: 2,
      total: 5,
    });
  });
});
