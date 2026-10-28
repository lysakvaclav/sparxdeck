// Stops marked visited on a phone without a signal (part 23): kept in the
// phone, shown at once, sent with the time they were marked when there is a
// connection. Pure functions; the storage is src/lib/client/route-visits.ts.

/** localStorage key of the queue (wiped with the rest of the phone's data). */
export const ROUTE_VISITS_KEY = "sparxdeck.routeVisits";

export type VisitMark = { visited: boolean; at: string };
/** By stop id: the last mark not sent yet. */
export type VisitQueue = Record<string, VisitMark>;

/**
 * The queue after a stop is marked: a mark back to what the server already
 * has is no change to send, so it leaves the queue.
 */
export function markVisit(
  queue: VisitQueue,
  stopId: string,
  visited: boolean,
  at: string,
  serverVisited: boolean,
): VisitQueue {
  const next = { ...queue };
  if (visited === serverVisited) delete next[stopId];
  else next[stopId] = { visited, at };
  return next;
}

/** Stops as the phone shows them: the server's state with the waiting marks over it. */
export function withMarks<T extends { id: string; visitedAt: string | null }>(
  stops: readonly T[],
  queue: VisitQueue,
): (T & { waiting: boolean })[] {
  return stops.map((stop) => {
    const mark = queue[stop.id];
    if (!mark) return { ...stop, waiting: false };
    return { ...stop, visitedAt: mark.visited ? mark.at : null, waiting: true };
  });
}

/** Reads a stored queue; anything malformed is left out. */
export function parseQueue(text: string | null): VisitQueue {
  if (!text) return {};
  try {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const queue: VisitQueue = {};
    for (const [id, mark] of Object.entries(value as Record<string, unknown>)) {
      const { visited, at } = (mark ?? {}) as { visited?: unknown; at?: unknown };
      if (typeof visited === "boolean" && typeof at === "string" && !Number.isNaN(Date.parse(at)))
        queue[id] = { visited, at };
    }
    return queue;
  } catch {
    return {};
  }
}
