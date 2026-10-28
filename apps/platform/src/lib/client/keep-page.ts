"use client";

import { PAGES_CACHE } from "./offline-store";

// Pages kept in the phone for work without a signal: a downloaded inspection
// (part 16) and the technician's plan for today (part 23). The service worker
// serves the kept copy when the network doesn't answer (public/sw.js).

/** Keeps a page in the phone (once; the service worker refreshes the copy online). */
export async function keepPage(path: string) {
  const cache = await caches.open(PAGES_CACHE);
  if (await cache.match(path)) return;
  const response = await fetch(path, { credentials: "same-origin" });
  if (response.ok && !response.redirected && response.headers.get("content-type")?.includes("html"))
    await cache.put(path, response);
}

/** Next.js files this page loaded, for the service worker to keep (see public/sw.js). */
export async function keepStaticFiles() {
  const registration = await navigator.serviceWorker?.getRegistration();
  const worker = registration?.active;
  if (!worker) return;
  const urls = new Set<string>();
  for (const entry of performance.getEntriesByType("resource"))
    if (entry.name.includes("/_next/static/")) urls.add(entry.name);
  document
    .querySelectorAll<HTMLScriptElement | HTMLLinkElement>("script[src], link[href]")
    .forEach((element) => {
      const url = "src" in element ? element.src : element.href;
      if (url.includes("/_next/static/")) urls.add(url);
    });
  worker.postMessage({ type: "cache-static", urls: [...urls] });
}
