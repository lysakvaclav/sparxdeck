/**
 * Shared by tests/scan-location.test.ts and tests/rls.test.ts: the database's
 * rule (scan_location_distance, scan_location_verdict) must agree with
 * src/lib/scan-location.ts.
 */

/** Two points and their distance in metres (rounded to the metre). */
export const DISTANCE_CASES: [
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
  metres: number,
][] = [
  [50.0755, 14.4378, 50.0755, 14.4378, 0],
  // Prague, Old Town Square to the National Museum.
  [50.087465, 14.421254, 50.078905, 14.430599, 1162],
  // Prague to Brno.
  [50.0755, 14.4378, 49.1951, 16.6068, 184_333],
  // 0.001° of latitude.
  [50, 14, 50.001, 14, 111],
  // Across the antimeridian.
  [10, 179.9995, 10, -179.9995, 110],
];

/** Distance, accuracy and radius in metres, and the verdict. */
export const VERDICT_CASES: [
  distance: number | null,
  accuracy: number | null,
  radius: number | null,
  state: "matches" | "mismatch" | "unknown",
][] = [
  [0, 5, 150, "matches"],
  // The building's radius reaches exactly the edge of the reading's circle.
  [250, 100, 150, "matches"],
  [250.5, 100, 150, "mismatch"],
  [150, 0, 150, "matches"],
  [151, 0, 150, "mismatch"],
  // Precision just inside and just outside the limit.
  [30, 100, 150, "matches"],
  [30, 100.5, 150, "unknown"],
  [5000, 101, 150, "unknown"],
  // No reading, no building point, no radius.
  [null, 10, 150, "unknown"],
  [100, null, 150, "unknown"],
  [100, 10, null, "unknown"],
  [900, 20, 1000, "matches"],
  [2000, 20, 1000, "mismatch"],
];
