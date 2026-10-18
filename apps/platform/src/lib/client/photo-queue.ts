"use client";

import { STORES, idb } from "./idb";

// Photos waiting to be uploaded, kept in IndexedDB (blobs are too big for
// localStorage) until the upload succeeds, so they survive a lost signal or a
// closed tab.

export type PendingPhoto = {
  id: string;
  inspectionId: string;
  deviceId: string;
  /** The checklist question, or null for a photo of the whole device. */
  questionId: string | null;
  blob: Blob;
  createdAt: number;
};

const STORE = STORES.photos;
const CHANGE_EVENT = "sparxdeck:photo-queue";

function changed() {
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Re-reads the queue when photos are added, uploaded or removed. */
export function subscribePhotos(notify: () => void) {
  window.addEventListener(CHANGE_EVENT, notify);
  return () => window.removeEventListener(CHANGE_EVENT, notify);
}

export async function queuePhoto(photo: Omit<PendingPhoto, "createdAt">): Promise<boolean> {
  try {
    const entry: PendingPhoto = { ...photo, createdAt: Date.now() };
    await idb(STORE, "readwrite", (store) => store.put(entry));
    changed();
    return true;
  } catch {
    return false;
  }
}

export async function removePhoto(id: string): Promise<void> {
  try {
    await idb(STORE, "readwrite", (store) => store.delete(id));
    changed();
  } catch {
    // Already gone or storage unavailable.
  }
}

async function allPhotos(): Promise<PendingPhoto[]> {
  try {
    return await idb<PendingPhoto[]>(STORE, "readonly", (store) => store.getAll());
  } catch {
    return [];
  }
}

export async function queuedPhotos(
  inspectionId: string,
  deviceId: string,
): Promise<PendingPhoto[]> {
  return (await allPhotos())
    .filter((photo) => photo.inspectionId === inspectionId && photo.deviceId === deviceId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

/** Waiting photos of an inspection, by device. */
export async function queuedPhotoCounts(inspectionId: string): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const photo of await allPhotos())
    if (photo.inspectionId === inspectionId)
      counts[photo.deviceId] = (counts[photo.deviceId] ?? 0) + 1;
  return counts;
}

/** Every waiting photo's inspection (for the sign-out warning and the offline list). */
export async function queuedPhotoInspections(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const photo of await allPhotos())
    counts[photo.inspectionId] = (counts[photo.inspectionId] ?? 0) + 1;
  return counts;
}

/** Drops the waiting photos of a device (its check was discarded) or of an inspection. */
export async function removeQueuedPhotos(inspectionId: string, deviceId?: string): Promise<void> {
  for (const photo of await allPhotos())
    if (photo.inspectionId === inspectionId && (!deviceId || photo.deviceId === deviceId))
      await removePhoto(photo.id);
}
