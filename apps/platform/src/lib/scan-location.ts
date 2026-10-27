import type { ScanLocationError, ScanLocationState } from "@/lib/supabase/database.types";

// The location of a QR scan against its building (part 20). The server decides
// (record_scan_location in 20261027100000_scan_location.sql); this mirrors its
// rule for tests and for what the phone may say before it has sent the reading.
// An indication for the protocol, never a condition for the check.

/** The same numbers as public.scan_location_rules() (tests compare them). */
export const SCAN_LOCATION_RULES = {
  /** A reading less precise than this tells nothing about the building. */
  maxAccuracyM: 100,
  /** The radius a building gets until someone sets its own. */
  defaultRadiusM: 150,
  minRadiusM: 10,
  maxRadiusM: 5000,
} as const;

/** How long the phone may look for a position after a scan. */
export const SCAN_LOCATION_TIMEOUT_MS = 8000;
/** A position this recent is good enough (the phone may have one already). */
export const SCAN_LOCATION_MAX_AGE_MS = 30_000;

/** The mean Earth radius PostGIS uses for geography on the sphere. */
const EARTH_RADIUS_M = 6_371_008.7714;

export type Coordinates = { latitude: number; longitude: number };

/** Great-circle distance in metres (as public.scan_location_distance). */
export function distanceMeters(a: Coordinates, b: Coordinates): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLng = (b.longitude - a.longitude) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * unknown: no distance (no reading or no building point) or a reading less
 * precise than the limit; matches: the building's radius reaches the reading's
 * circle of uncertainty; mismatch: otherwise (as public.scan_location_verdict).
 */
export function scanLocationVerdict(
  distanceM: number | null,
  accuracyM: number | null,
  radiusM: number | null,
): ScanLocationState {
  if (distanceM === null || accuracyM === null || radiusM === null) return "unknown";
  if (accuracyM > SCAN_LOCATION_RULES.maxAccuracyM) return "unknown";
  return distanceM - accuracyM <= radiusM ? "matches" : "mismatch";
}

export function validCoordinates(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

const HEMISPHERE = /^([+-]?\d+(?:[.,]\d+)?)\s*°?\s*([NSEW])?$/i;

function coordinate(text: string): { value: number; hemisphere: string | null } | null {
  const match = HEMISPHERE.exec(text.trim());
  if (!match) return null;
  return {
    value: Number(match[1]!.replace(",", ".")),
    hemisphere: match[2]?.toUpperCase() ?? null,
  };
}

/**
 * Reads a point pasted from a map application or typed in: "50.0755, 14.4378",
 * "50.0755N, 14.4378E" (Mapy.cz), "50,0755; 14,4378" or "50.0755 14.4378".
 * Latitude first; a hemisphere letter may set the sign. Null when it isn't one.
 */
export function parseCoordinates(text: string): Coordinates | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  // The two numbers are split by ";", by a comma and a space, by spaces, or by a
  // lone comma (then the numbers can't have decimal commas themselves).
  const parts = trimmed.includes(";")
    ? trimmed.split(";")
    : /,\s/.test(trimmed)
      ? trimmed.split(/,\s+/)
      : /\s/.test(trimmed)
        ? trimmed.split(/\s+/)
        : trimmed.split(",");
  if (parts.length !== 2) return null;
  const first = coordinate(parts[0]!);
  const second = coordinate(parts[1]!);
  if (!first || !second) return null;
  let latitude = first.value;
  let longitude = second.value;
  // Letters can name the axes in either order (14.43E, 50.07N).
  if (first.hemisphere === "E" || first.hemisphere === "W") {
    [latitude, longitude] = [second.value, first.value];
    if (first.hemisphere === "W") longitude = -longitude;
    if (second.hemisphere === "S") latitude = -latitude;
  } else {
    if (first.hemisphere === "S") latitude = -latitude;
    if (second.hemisphere === "W") longitude = -longitude;
  }
  if (!validCoordinates(latitude, longitude)) return null;
  return { latitude, longitude };
}

/** What the phone captured at a scan: a position, or why there is none. */
export type ScanCapture =
  | { latitude: number; longitude: number; accuracyM: number; capturedAt: string }
  | { error: ScanLocationError; capturedAt: string };

/** The reason for a missing position from a Geolocation API error code. */
export function captureErrorOf(code: number): ScanLocationError {
  // 1 PERMISSION_DENIED, 2 POSITION_UNAVAILABLE, 3 TIMEOUT
  if (code === 1) return "denied";
  if (code === 3) return "timeout";
  return "unavailable";
}

/** Counts for the protocol's summary line ("matched for 18 of 20 devices"). */
export function scanLocationSummary(states: readonly (ScanLocationState | null)[]): {
  matches: number;
  mismatch: number;
  unknown: number;
  total: number;
} {
  const summary = { matches: 0, mismatch: 0, unknown: 0, total: states.length };
  for (const state of states) summary[state ?? "unknown"]++;
  return summary;
}
