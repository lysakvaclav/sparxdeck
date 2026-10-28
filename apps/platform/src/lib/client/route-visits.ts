"use client";

import { databaseErrorCode } from "@/lib/errors";
import { ROUTE_VISITS_KEY, parseQueue, type VisitQueue } from "@/lib/route-visits";
import { createClient } from "@/lib/supabase/client";
import { isNetworkError, requestTimeout } from "./field-sync";

// The phone's queue of stops marked visited (part 23), in localStorage like the
// drafts of checks. Sent through the database function from the browser (not a
// server action), each request with a time limit: a weak signal counts as none.

const EVENT = "sparxdeck:route-visits";
let cached: { text: string | null; queue: VisitQueue } = { text: null, queue: {} };

export function readVisitQueue(): VisitQueue {
  let text: string | null = null;
  try {
    text = localStorage.getItem(ROUTE_VISITS_KEY);
  } catch {
    return {};
  }
  // The same object while nothing changed (useSyncExternalStore compares them).
  if (text !== cached.text) cached = { text, queue: parseQueue(text) };
  return cached.queue;
}

export function writeVisitQueue(queue: VisitQueue) {
  try {
    if (Object.keys(queue).length) localStorage.setItem(ROUTE_VISITS_KEY, JSON.stringify(queue));
    else localStorage.removeItem(ROUTE_VISITS_KEY);
  } catch {
    // A full or blocked storage: the mark then goes straight to the server only.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function subscribeVisitQueue(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

const emptyQueue: VisitQueue = {};
export const serverVisitQueue = () => emptyQueue;

export type SendResult = { sent: number; dropped: number; offline: boolean };

/**
 * Sends what waits, one stop after another. Without a signal it stops and
 * keeps the rest; a stop the server refuses for good (removed from the route,
 * not the sender's) is dropped and counted.
 */
export async function sendVisitQueue(): Promise<SendResult> {
  const result: SendResult = { sent: 0, dropped: 0, offline: false };
  const supabase = createClient();
  for (const [stopId, mark] of Object.entries(readVisitQueue())) {
    const { error } = await supabase
      .rpc("set_route_stop_visited", { p_stop: stopId, p_visited: mark.visited, p_at: mark.at })
      .abortSignal(requestTimeout());
    if (error && isNetworkError(error)) {
      result.offline = true;
      break;
    }
    const code = error ? databaseErrorCode(error) : null;
    // Something passing (an expired session, a server error) waits for the next try.
    if (code && code !== "notFound" && code !== "forbidden") continue;
    const queue = { ...readVisitQueue() };
    // Marked again meanwhile: the newer mark stays to be sent.
    if (queue[stopId]?.at === mark.at) delete queue[stopId];
    writeVisitQueue(queue);
    if (code) result.dropped++;
    else result.sent++;
  }
  return result;
}
