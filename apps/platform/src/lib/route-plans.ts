import { addDays } from "@/lib/due";
import { distanceMeters, type Coordinates } from "@/lib/scan-location";

// Routes for technicians (part 23; not src/lib/routes.ts, the paths of the app): the order of a day's visits by straight-line
// distance. Not navigation: no roads, no traffic, no driving times, and the
// pages say so. Pure functions; the database keeps the saved order
// (20261101090000_routes.sql).

/** As the database's check on route_plan_stops.position. */
export const ROUTE_MAX_STOPS = 30;
/** "Due soon nearby": buildings this close to a stop… */
export const NEARBY_DEFAULT_RADIUS_M = 3000;
export const NEARBY_MAX_RADIUS_M = 50_000;
/** …whose next inspection is due within this many days, or overdue. */
export const NEARBY_DUE_DAYS = 30;

/**
 * How far apart two points are, in metres. One implementation for now
 * (straight line on the sphere); road routing would be another provider.
 */
export interface DistanceProvider {
  distance(a: Coordinates, b: Coordinates): number;
}

export const straightLine: DistanceProvider = { distance: distanceMeters };

export type RouteOptions = {
  /** Come back to the start point at the end of the day. */
  returnToStart: boolean;
  /** The first stop stays first. */
  lockFirst: boolean;
  /** The last stop stays last. */
  lockLast: boolean;
};

/** Some floating-point noise is not an improvement (and would loop forever). */
const EPSILON = 1e-6;

/** Length of a path through the points in this order (open, or closed back to the first). */
function pathLength(points: readonly Coordinates[], closed: boolean, provider: DistanceProvider) {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += provider.distance(points[i - 1]!, points[i]!);
  if (closed && points.length > 1) total += provider.distance(points.at(-1)!, points[0]!);
  return total;
}

/**
 * Nearest neighbour from `from` through `free` (indices into `points`); on a
 * tie the stop that came first wins, so the result never depends on chance.
 */
function nearestNeighbour(
  from: Coordinates | null,
  free: readonly number[],
  points: readonly Coordinates[],
  provider: DistanceProvider,
): number[] {
  const left = [...free];
  const order: number[] = [];
  let here = from;
  while (left.length) {
    let best = 0;
    if (here) {
      let bestDistance = Infinity;
      for (let i = 0; i < left.length; i++) {
        const distance = provider.distance(here, points[left[i]!]!);
        if (distance < bestDistance - EPSILON) {
          bestDistance = distance;
          best = i;
        }
      }
    }
    const [next] = left.splice(best, 1);
    order.push(next!);
    here = points[next!]!;
  }
  return order;
}

/**
 * 2-opt: reverses a stretch of the free part of the sequence while that makes
 * the path shorter. `sequence` holds points; the stretch lo..hi (inclusive) may
 * move, the points around it stay. `closed`: the last point leads back to the first.
 */
function twoOpt(
  sequence: Coordinates[],
  ids: number[],
  lo: number,
  hi: number,
  closed: boolean,
  provider: DistanceProvider,
) {
  const d = (a: number, b: number) => {
    const n = sequence.length;
    if (b >= n) return closed ? provider.distance(sequence[a]!, sequence[0]!) : 0;
    if (a < 0) return 0;
    return provider.distance(sequence[a]!, sequence[b]!);
  };
  // Bounded: each pass improves the length, and 30 stops settle within a few passes.
  for (let pass = 0; pass < 200; pass++) {
    let improved = false;
    for (let i = lo; i < hi; i++) {
      for (let k = i + 1; k <= hi; k++) {
        const delta = d(i - 1, k) + d(i, k + 1) - d(i - 1, i) - d(k, k + 1);
        if (delta < -EPSILON) {
          sequence.splice(i, k - i + 1, ...sequence.slice(i, k + 1).reverse());
          ids.splice(i, k - i + 1, ...ids.slice(i, k + 1).reverse());
          improved = true;
        }
      }
    }
    if (!improved) return;
  }
}

/**
 * The order of a route's stops (indices into `stops`): nearest neighbour, then
 * 2-opt. Stops without a point keep their order at the end (the technician
 * places them by hand). Without a start point the route starts at whichever
 * stop gives the shortest path (or the locked first one).
 */
export function orderRoute(
  start: Coordinates | null,
  stops: readonly (Coordinates | null)[],
  options: RouteOptions,
  provider: DistanceProvider = straightLine,
): number[] {
  const all = stops.map((_, index) => index);
  const located = all.filter((index) => stops[index] !== null);
  const unlocated = all.filter((index) => stops[index] === null);
  const points = stops as readonly Coordinates[];
  if (located.length === 0) return all;

  const first = options.lockFirst && stops[0] ? 0 : null;
  const last =
    options.lockLast && stops.length > 1 && stops.at(-1) && first !== stops.length - 1
      ? stops.length - 1
      : null;
  const free = located.filter((index) => index !== first && index !== last);
  const closed = Boolean(start) && options.returnToStart;

  /** Orders `free` after the fixed head, with the fixed tail after them; returns order and length. */
  const solve = (head: number[]) => {
    const rest = free.filter((index) => !head.includes(index));
    const from = head.length ? points[head.at(-1)!]! : start;
    const middle = nearestNeighbour(from, rest, points, provider);
    const ids = [...head, ...middle, ...(last !== null ? [last] : [])];
    const sequence = [...(start ? [start] : []), ...ids.map((index) => points[index]!)];
    const offset = start ? 1 : 0;
    const keys = [-1, ...ids].slice(start ? 0 : 1);
    const lo = offset + head.length;
    const hi = offset + head.length + middle.length - 1;
    if (hi > lo) twoOpt(sequence, keys, lo, hi, closed, provider);
    const order = keys.filter((key) => key >= 0);
    return { order, length: pathLength(sequence, closed, provider) };
  };

  let best: { order: number[]; length: number };
  if (first !== null) best = solve([first]);
  else if (start || free.length === 0) best = solve([]);
  else {
    // No start point: try each stop as the first, keep the shortest (first on a tie).
    best = { order: [], length: Infinity };
    for (const candidate of free) {
      const tried = solve([candidate]);
      if (tried.length < best.length - EPSILON) best = tried;
    }
  }
  return [...best.order, ...unlocated];
}

/** Each stop's distance from the previous point that has one (the start for the first). */
export function routeLegs(
  start: Coordinates | null,
  stops: readonly (Coordinates | null)[],
  provider: DistanceProvider = straightLine,
): (number | null)[] {
  let previous = start;
  return stops.map((point) => {
    if (!point) return null;
    const leg = previous ? provider.distance(previous, point) : null;
    previous = point;
    return leg;
  });
}

/** The whole route in metres (straight lines), back to the start when asked. */
export function routeDistance(
  start: Coordinates | null,
  stops: readonly (Coordinates | null)[],
  returnToStart: boolean,
  provider: DistanceProvider = straightLine,
): number {
  const legs = routeLegs(start, stops, provider);
  let total = legs.reduce<number>((sum, leg) => sum + (leg ?? 0), 0);
  const lastPoint = [...stops].reverse().find((point) => point !== null);
  if (start && returnToStart && lastPoint) total += provider.distance(lastPoint, start);
  return total;
}

/** Moves one item of a list (a stop up or down, or dropped elsewhere). */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item!);
  return next;
}

export type NearbyCandidate = Coordinates & {
  site_id: string;
  /** The building's nearest next inspection (any active device), null without one. */
  next_due: string | null;
};

export type NearbySuggestion<T extends NearbyCandidate> = {
  site: T;
  /** Straight-line metres to the closest stop of the route. */
  distance: number;
  /** Index (into the stops given) of that stop. */
  nearestStop: number;
};

/**
 * Buildings near a route whose inspection is due within NEARBY_DUE_DAYS days
 * or overdue, not in the route yet: soonest due first, then the closest.
 */
export function nearbySuggestions<T extends NearbyCandidate>(
  stops: readonly (Coordinates | null)[],
  candidates: readonly T[],
  inRoute: ReadonlySet<string>,
  today: string,
  radiusM: number = NEARBY_DEFAULT_RADIUS_M,
  provider: DistanceProvider = straightLine,
): NearbySuggestion<T>[] {
  const horizon = addDays(today, NEARBY_DUE_DAYS);
  const suggestions: NearbySuggestion<T>[] = [];
  for (const site of candidates) {
    if (inRoute.has(site.site_id) || site.next_due === null || site.next_due > horizon) continue;
    let distance = Infinity;
    let nearestStop = -1;
    stops.forEach((stop, index) => {
      if (!stop) return;
      const metres = provider.distance(stop, site);
      if (metres < distance) {
        distance = metres;
        nearestStop = index;
      }
    });
    if (nearestStop >= 0 && distance <= radiusM) suggestions.push({ site, distance, nearestStop });
  }
  return suggestions.sort(
    (a, b) =>
      a.site.next_due!.localeCompare(b.site.next_due!) ||
      a.distance - b.distance ||
      a.site.site_id.localeCompare(b.site.site_id),
  );
}

/**
 * A link that opens the phone's map application at the point: geo: on Android,
 * Apple Maps on iPhone and iPad, OpenStreetMap elsewhere. Only a link with
 * coordinates, nothing is sent anywhere by us.
 */
export function mapAppHref(point: Coordinates, userAgent: string): string {
  const at = `${point.latitude.toFixed(6)},${point.longitude.toFixed(6)}`;
  if (/android/i.test(userAgent)) return `geo:${at}?q=${at}`;
  if (/iphone|ipad|ipod|macintosh.*mobile/i.test(userAgent)) return `https://maps.apple.com/?daddr=${at}`;
  return `https://www.openstreetmap.org/?mlat=${point.latitude.toFixed(6)}&mlon=${point.longitude.toFixed(6)}#map=17/${at.replace(",", "/")}`;
}

/** How far, for people: metres under a kilometre, then kilometres with one decimal under 100. */
export function distanceParts(metres: number): { value: number; unit: "m" | "km" } {
  if (metres < 1000) return { value: Math.round(metres / 10) * 10, unit: "m" };
  if (metres < 100_000) return { value: Math.round(metres / 100) / 10, unit: "km" };
  return { value: Math.round(metres / 1000), unit: "km" };
}

/** A route's state from its stops (not stored): planned, under way, done. */
export function routeState(stops: readonly { visited_at: string | null }[]): "planned" | "underway" | "done" {
  const visited = stops.filter((stop) => stop.visited_at).length;
  if (stops.length > 0 && visited === stops.length) return "done";
  return visited > 0 ? "underway" : "planned";
}
