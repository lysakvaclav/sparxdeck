import { describe, expect, it } from "vitest";
import {
  NEARBY_DEFAULT_RADIUS_M,
  ROUTE_MAX_STOPS,
  distanceParts,
  mapAppHref,
  moveItem,
  nearbySuggestions,
  orderRoute,
  routeDistance,
  routeLegs,
  routeState,
  straightLine,
  type DistanceProvider,
  type RouteOptions,
} from "@/lib/route-plans";
import type { Coordinates } from "@/lib/scan-location";

// Routes (part 23): straight-line ordering. A flat provider (x = longitude,
// y = latitude) makes the expected orders easy to check by hand; it also shows
// the distance can be swapped for another provider.

const flat: DistanceProvider = {
  distance: (a, b) => Math.hypot(a.longitude - b.longitude, a.latitude - b.latitude),
};
const p = (x: number, y: number): Coordinates => ({ latitude: y, longitude: x });
const open: RouteOptions = { returnToStart: false, lockFirst: false, lockLast: false };
const closed: RouteOptions = { ...open, returnToStart: true };

/** Length of the stops in this order (as the page shows it). */
const lengthOf = (
  start: Coordinates | null,
  stops: (Coordinates | null)[],
  order: number[],
  back: boolean,
) => routeDistance(start, order.map((index) => stops[index]!), back, flat);

/** Every order of the stops, for the shortest one there is. */
function bruteForce(start: Coordinates, stops: Coordinates[], back: boolean) {
  let best = Infinity;
  const permute = (rest: number[], done: number[]) => {
    if (!rest.length) best = Math.min(best, lengthOf(start, stops, done, back));
    rest.forEach((index, i) => permute([...rest.slice(0, i), ...rest.slice(i + 1)], [...done, index]));
  };
  permute(stops.map((_, index) => index), []);
  return best;
}

/** The same "random" points every run. */
function points(seed: number, count: number) {
  let state = seed;
  const next = () => ((state = (state * 1103515245 + 12345) % 2 ** 31) / 2 ** 31) * 100;
  return Array.from({ length: count }, () => p(next(), next()));
}

describe("ordering a route", () => {
  it("goes along a line from the start", () => {
    expect(orderRoute(p(0, 0), [p(3, 0), p(1, 0), p(2, 0)], open, flat)).toEqual([1, 2, 0]);
  });

  it("without a start point begins at the stop that gives the shortest path", () => {
    // 5, 1, 3 on a line: both ends are as good; the first tried (index 0) wins.
    expect(orderRoute(null, [p(5, 0), p(1, 0), p(3, 0)], open, flat)).toEqual([0, 2, 1]);
  });

  it("2-opt undoes what nearest neighbour gets wrong, and never makes it longer", () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const stops = points(seed, 8);
      const start = p(50, 50);
      for (const back of [false, true]) {
        const options = { ...open, returnToStart: back };
        const ordered = lengthOf(start, stops, orderRoute(start, stops, options, flat), back);
        // Nearest neighbour alone, for comparison.
        const left = stops.map((_, index) => index);
        const greedy: number[] = [];
        let here = start;
        while (left.length) {
          left.sort((a, b) => flat.distance(here, stops[a]!) - flat.distance(here, stops[b]!) || a - b);
          greedy.push(left.shift()!);
          here = stops[greedy.at(-1)!]!;
        }
        expect(ordered).toBeLessThanOrEqual(lengthOf(start, stops, greedy, back) + 1e-9);
        // Close to the best possible order (2-opt isn't exact, but near on 8 stops).
        expect(ordered / bruteForce(start, stops, back)).toBeLessThan(1.1);
      }
    }
  });

  it("keeps a locked first or last stop in place", () => {
    const stops = [p(9, 0), p(1, 0), p(2, 0), p(3, 0)];
    expect(orderRoute(p(0, 0), stops, { ...open, lockFirst: true }, flat)).toEqual([0, 3, 2, 1]);
    const last = [p(1, 0), p(9, 0), p(2, 0), p(0.5, 0)];
    const ordered = orderRoute(p(0, 0), last, { ...open, lockLast: true }, flat);
    expect(ordered.at(-1)).toBe(3);
    expect(ordered.slice(0, -1)).toEqual([0, 2, 1]);
    const both = orderRoute(null, [p(5, 0), p(1, 0), p(9, 0), p(3, 0)], { ...open, lockFirst: true, lockLast: true }, flat);
    expect(both[0]).toBe(0);
    expect(both.at(-1)).toBe(3);
  });

  it("puts stops without a point at the end in their order", () => {
    expect(orderRoute(p(0, 0), [null, p(2, 0), null, p(1, 0)], open, flat)).toEqual([3, 1, 0, 2]);
    expect(orderRoute(p(0, 0), [null, null], open, flat)).toEqual([0, 1]);
  });

  it("is the same every time, and handles 30 stops quickly", () => {
    const stops = points(42, ROUTE_MAX_STOPS);
    const startedAt = performance.now();
    const order = orderRoute(p(0, 0), stops, closed, flat);
    expect(performance.now() - startedAt).toBeLessThan(500);
    expect([...order].sort((a, b) => a - b)).toEqual(stops.map((_, index) => index));
    expect(orderRoute(p(0, 0), stops, closed, flat)).toEqual(order);
  });

  it("works on the sphere (Prague, Brno, Ostrava, Plzeň from Prague)", () => {
    const prague = { latitude: 50.0755, longitude: 14.4378 };
    const stops = [
      { latitude: 49.8209, longitude: 18.2625 }, // Ostrava
      { latitude: 49.7384, longitude: 13.3736 }, // Plzeň
      { latitude: 49.1951, longitude: 16.6068 }, // Brno
    ];
    // Out and back: Plzeň, Brno, Ostrava (or reversed); open from Prague: Plzeň first.
    expect(orderRoute(prague, stops, open, straightLine)).toEqual([1, 2, 0]);
  });
});

describe("distances", () => {
  it("legs from the start and the previous stop with a point", () => {
    expect(routeLegs(p(0, 0), [p(3, 4), null, p(3, 0)], flat)).toEqual([5, null, 4]);
    expect(routeLegs(null, [p(3, 4), p(3, 0)], flat)).toEqual([null, 4]);
  });

  it("the whole route, back to the start when asked", () => {
    expect(routeDistance(p(0, 0), [p(3, 4), null, p(3, 0)], false, flat)).toBe(9);
    expect(routeDistance(p(0, 0), [p(3, 4), null, p(3, 0)], true, flat)).toBe(12);
    expect(routeDistance(null, [p(3, 4), p(3, 0)], true, flat)).toBe(4);
    expect(routeDistance(p(0, 0), [], true, flat)).toBe(0);
  });

  it("reads as metres, then kilometres", () => {
    expect(distanceParts(0)).toEqual({ value: 0, unit: "m" });
    expect(distanceParts(994)).toEqual({ value: 990, unit: "m" });
    expect(distanceParts(1049)).toEqual({ value: 1, unit: "km" });
    expect(distanceParts(12_345)).toEqual({ value: 12.3, unit: "km" });
    expect(distanceParts(123_456)).toEqual({ value: 123, unit: "km" });
  });
});

describe("due soon nearby", () => {
  const today = "2026-11-01";
  const site = (id: string, x: number, due: string | null) => ({ site_id: id, next_due: due, ...p(x, 0) });

  it("offers buildings within the radius, due within 30 days or overdue, not in the route", () => {
    const stops = [p(0, 0), null, p(10_000, 0)];
    const candidates = [
      site("edge", NEARBY_DEFAULT_RADIUS_M, "2026-11-20"),
      site("beyond", NEARBY_DEFAULT_RADIUS_M + 1, "2026-11-20"),
      site("day30", 10_500, "2026-12-01"),
      site("day31", 10_500, "2026-12-02"),
      site("overdue", 9_000, "2025-01-01"),
      site("never", 100, null),
      site("planned", 200, "2026-11-02"),
    ];
    const result = nearbySuggestions(stops, candidates, new Set(["planned"]), today, NEARBY_DEFAULT_RADIUS_M, flat);
    expect(result.map((item) => [item.site.site_id, item.nearestStop, item.distance])).toEqual([
      ["overdue", 2, 1000],
      ["edge", 0, 3000],
      ["day30", 2, 500],
    ]);
  });

  it("a smaller radius, and nothing without a stop that has a point", () => {
    const candidates = [site("a", 900, "2026-11-05"), site("b", 1500, "2026-11-05")];
    expect(nearbySuggestions([p(0, 0)], candidates, new Set(), today, 1000, flat).map((item) => item.site.site_id)).toEqual(["a"]);
    expect(nearbySuggestions([null], candidates, new Set(), today, 1000, flat)).toEqual([]);
  });
});

describe("helpers", () => {
  it("moves a stop", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(moveItem(["a", "b", "c"], 1, 9)).toEqual(["a", "c", "b"]);
  });

  it("links to the phone's map application", () => {
    const point = { latitude: 50.0755, longitude: 14.4378 };
    expect(mapAppHref(point, "Mozilla/5.0 (Linux; Android 14; Pixel 8)")).toBe("geo:50.075500,14.437800?q=50.075500,14.437800");
    expect(mapAppHref(point, "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).toBe(
      "https://maps.apple.com/?daddr=50.075500,14.437800",
    );
    expect(mapAppHref(point, "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe(
      "https://www.openstreetmap.org/?mlat=50.075500&mlon=14.437800#map=17/50.075500/14.437800",
    );
  });

  it("a route's state follows its stops", () => {
    expect(routeState([])).toBe("planned");
    expect(routeState([{ visited_at: null }, { visited_at: null }])).toBe("planned");
    expect(routeState([{ visited_at: "x" }, { visited_at: null }])).toBe("underway");
    expect(routeState([{ visited_at: "x" }])).toBe("done");
  });
});
