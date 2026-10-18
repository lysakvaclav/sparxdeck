// SparxDeck service worker: keeps what an inspection needs to work without a
// signal. Nothing else changes: with a connection every request goes to the
// network as usual.
//
// * Next.js files (/_next/static, hashed and immutable): from the cache once
//   fetched, so the inspection page runs without a connection.
// * Inspection pages the phone downloaded (the page puts them in the cache, see
//   src/lib/client/offline-store.ts): network first, the last copy without a
//   signal or when a weak one doesn't answer within a few seconds; any
//   /inspections/<id>/check/<device> address is served by its inspection's
//   page, which shows the device itself.
// * Any other page without a signal: /offline, the list of downloaded inspections.
//
// Registered as /sw.js?dev in development: Next.js files change there with every
// edit, so they come from the network first and the cache only without a signal.

// Raising VERSION drops the cached Next.js files (and nothing else).
const VERSION = "v1";
const STATIC_CACHE = `sparxdeck-static-${VERSION}`;
// Shared with offline-store.ts (PAGES_CACHE): renaming it loses saved inspections.
const PAGES_CACHE = "sparxdeck-pages-v1";
const OFFLINE_URL = "/offline";
const STATIC_LIMIT = 500;
// How long a saved inspection's page waits for the network before the saved copy.
const PAGE_WAIT_MS = 4000;
const DEV = new URL(self.location.href).searchParams.has("dev");
const FIELD_PAGE = /^\/inspections\/([0-9a-f-]{36})(?:\/check\/[0-9a-f-]{36})?\/?$/i;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      await cacheOfflinePage();
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys())
        if (name.startsWith("sparxdeck-") && name !== STATIC_CACHE && name !== PAGES_CACHE)
          await caches.delete(name);
      await self.clients.claim();
    })(),
  );
});

async function cacheOfflinePage() {
  try {
    const response = await fetch(OFFLINE_URL, { cache: "no-store" });
    if (!response.ok || response.redirected) return;
    await cacheReferencedFiles(response.clone());
    await (await caches.open(PAGES_CACHE)).put(OFFLINE_URL, response);
  } catch {
    // No connection while installing: the next page load tries again.
  }
}

/** The Next.js files a cached page needs to run, also when it was never shown online. */
async function cacheReferencedFiles(response) {
  const html = await response.text();
  const urls = new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) ?? []);
  const cache = await caches.open(STATIC_CACHE);
  for (const url of urls) {
    if (await cache.match(url)) continue;
    try {
      const file = await fetch(url);
      if (file.ok) await cache.put(url, file);
    } catch {
      // No connection: the next copy of the page tries again.
    }
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(staticFile(event));
    return;
  }
  if (request.mode === "navigate") event.respondWith(page(event, url));
});

async function staticFile(event) {
  const cache = await caches.open(STATIC_CACHE);
  if (DEV) {
    try {
      const response = await fetch(event.request);
      if (response.ok) event.waitUntil(cache.put(event.request, response.clone()));
      return response;
    } catch {
      return (await cache.match(event.request)) ?? Response.error();
    }
  }
  const cached = await cache.match(event.request);
  if (cached) return cached;
  const response = await fetch(event.request);
  if (response.ok) event.waitUntil(cache.put(event.request, response.clone()).then(trimStatic));
  return response;
}

async function trimStatic() {
  const cache = await caches.open(STATIC_CACHE);
  const keys = await cache.keys();
  // Oldest first: files of earlier releases go before the current ones.
  for (const key of keys.slice(0, Math.max(0, keys.length - STATIC_LIMIT))) await cache.delete(key);
}

async function page(event, url) {
  const match = FIELD_PAGE.exec(url.pathname);
  const key = match ? `/inspections/${match[1]}` : null;
  const cache = await caches.open(PAGES_CACHE);
  const saved = key ? await cache.match(key) : undefined;
  const network = fetch(event.request).then((response) => {
    // A downloaded inspection's page: keep the copy fresh (without delaying the page).
    if (saved && response.ok && !response.redirected && isHtml(response)) {
      const copy = response.clone();
      event.waitUntil(
        (async () => {
          await cacheReferencedFiles(copy.clone());
          // Forgotten meanwhile (completed, signed out): not saved again.
          if (await cache.match(key)) await cache.put(key, copy);
        })(),
      );
    }
    if (url.pathname !== OFFLINE_URL) event.waitUntil(refreshOfflinePage());
    return response;
  });
  if (saved) {
    // In a basement a weak signal is more common than none: the saved copy
    // after a few seconds (or on a server error), while the network keeps going
    // to refresh it.
    event.waitUntil(network.catch(() => undefined));
    const response = await Promise.race([
      network.then((r) => (r.status >= 500 ? null : r)).catch(() => null),
      new Promise((resolve) => setTimeout(() => resolve(null), PAGE_WAIT_MS)),
    ]);
    return response ?? saved;
  }
  try {
    return await network;
  } catch {
    return (await cache.match(OFFLINE_URL)) ?? Response.error();
  }
}

/** The offline page follows releases (and the language), at most once an hour. */
let offlineRefreshedAt = 0;
async function refreshOfflinePage() {
  if (Date.now() - offlineRefreshedAt < 3600_000) return;
  offlineRefreshedAt = Date.now();
  await cacheOfflinePage();
}

function isHtml(response) {
  return (response.headers.get("content-type") ?? "").includes("text/html");
}

// The page lists the Next.js files it loaded before this worker took control,
// so they are kept too (the first visit isn't served through the worker).
self.addEventListener("message", (event) => {
  const data = event.data;
  if (data?.type !== "cache-static" || !Array.isArray(data.urls)) return;
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      for (const href of data.urls) {
        const url = new URL(href, self.location.origin);
        if (url.origin !== self.location.origin || !url.pathname.startsWith("/_next/static/"))
          continue;
        if (await cache.match(url.href)) continue;
        try {
          const response = await fetch(url.href);
          if (response.ok) await cache.put(url.href, response);
        } catch {
          // No connection: the next visit lists them again.
        }
      }
      await trimStatic();
    })(),
  );
});
