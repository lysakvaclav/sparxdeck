"use client";

import type { FieldPack } from "@/lib/field";
import {
  clearAllDrafts,
  devicesWithDrafts,
  inspectionsWithDrafts,
  readDraft,
  draftKey,
  readOps,
} from "./check-drafts";
import { STORES, clearStores, idb } from "./idb";
import { queuedPhotoInspections } from "./photo-queue";
import { draftPending } from "@/lib/field";
import { ROUTE_VISITS_KEY, parseQueue } from "@/lib/route-visits";

// Inspections downloaded for work without a signal: the pack (IndexedDB), its
// floor plan images, and the page itself (the service worker's cache); and the
// plan for today with its stops marked visited (part 23). Wiped on signing out,
// and when another account signs in on the phone.

/** Cache of pages the service worker keeps for offline use (see public/sw.js). */
export const PAGES_CACHE = "sparxdeck-pages-v1";
const OWNER_KEY = "sparxdeck.offline.owner";

type StoredPack = { inspectionId: string; pack: FieldPack; savedAt: number };
type StoredImage = { path: string; blob: Blob };

export async function savePack(pack: FieldPack): Promise<void> {
  const entry: StoredPack = { inspectionId: pack.inspection.id, pack, savedAt: Date.now() };
  await idb(STORES.packs, "readwrite", (store) => store.put(entry));
  rememberOwner(pack.userId);
}

/** Whose data the phone keeps, so another account signing in wipes it (checkOwner). */
export function rememberOwner(userId: string) {
  try {
    localStorage.setItem(OWNER_KEY, userId);
  } catch {
    // The owner check then wipes nothing; signing out still does.
  }
}

export async function loadPack(inspectionId: string): Promise<FieldPack | null> {
  try {
    const entry = await idb<StoredPack | undefined>(STORES.packs, "readonly", (store) =>
      store.get(inspectionId),
    );
    return entry?.pack ?? null;
  } catch {
    return null;
  }
}

export async function listPacks(): Promise<StoredPack[]> {
  try {
    const all = await idb<StoredPack[]>(STORES.packs, "readonly", (store) => store.getAll());
    return all.sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

/** Forgets a downloaded inspection (completed, cancelled): pack, plan images, page. */
export async function forgetInspection(inspectionId: string): Promise<void> {
  try {
    const pack = await loadPack(inspectionId);
    await idb(STORES.packs, "readwrite", (store) => store.delete(inspectionId));
    const others = (await listPacks()).flatMap((entry) => entry.pack.plans.map((p) => p.imagePath));
    for (const plan of pack?.plans ?? [])
      if (!others.includes(plan.imagePath))
        await idb(STORES.planImages, "readwrite", (store) => store.delete(plan.imagePath));
  } catch {
    // Storage unavailable: nothing kept.
  }
  try {
    const cache = await caches.open(PAGES_CACHE);
    await cache.delete(`/inspections/${inspectionId}`);
  } catch {
    // No cache (private mode, no service worker).
  }
}

export async function savePlanImage(path: string, blob: Blob): Promise<void> {
  const entry: StoredImage = { path, blob };
  await idb(STORES.planImages, "readwrite", (store) => store.put(entry));
}

export async function planImage(path: string): Promise<Blob | null> {
  try {
    const entry = await idb<StoredImage | undefined>(STORES.planImages, "readonly", (store) =>
      store.get(path),
    );
    return entry?.blob ?? null;
  } catch {
    return null;
  }
}

/** What waits in this phone, across inspections (warned about before signing out). */
export async function pendingInPhone(): Promise<number> {
  let count = 0;
  for (const inspectionId of inspectionsWithDrafts()) {
    for (const deviceId of devicesWithDrafts(inspectionId))
      if (draftPending(readDraft(draftKey(inspectionId, deviceId)))) count++;
    count += readOps(inspectionId).length;
  }
  const photos = await queuedPhotoInspections();
  try {
    // Stops of today's route marked visited without a signal (part 23).
    count += Object.keys(parseQueue(localStorage.getItem(ROUTE_VISITS_KEY))).length;
  } catch {
    // No storage: nothing waits there.
  }
  return count + Object.values(photos).reduce((sum, n) => sum + n, 0);
}

/** Everything this account left in the phone: drafts, photos, packs, cached pages. */
export async function wipeOfflineData(): Promise<void> {
  clearAllDrafts();
  try {
    await clearStores([STORES.photos, STORES.packs, STORES.planImages]);
  } catch {
    // Storage unavailable: nothing kept.
  }
  try {
    await caches.delete(PAGES_CACHE);
  } catch {
    // No cache.
  }
  try {
    localStorage.removeItem(OWNER_KEY);
    localStorage.removeItem(ROUTE_VISITS_KEY);
  } catch {
    // No storage.
  }
}

/** Another account signed in on this phone: the previous one's data goes. */
export async function checkOwner(userId: string): Promise<void> {
  let owner: string | null = null;
  try {
    owner = localStorage.getItem(OWNER_KEY);
  } catch {
    return;
  }
  if (owner && owner !== userId) await wipeOfflineData();
}
