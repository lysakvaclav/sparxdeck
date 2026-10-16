"use client";

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

const DB = "sparxdeck";
const STORE = "pending-photos";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE))
        request.result.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = work(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export async function queuePhoto(photo: Omit<PendingPhoto, "createdAt">): Promise<boolean> {
  try {
    const entry: PendingPhoto = { ...photo, createdAt: Date.now() };
    await run("readwrite", (store) => store.put(entry));
    return true;
  } catch {
    return false;
  }
}

export async function removePhoto(id: string): Promise<void> {
  try {
    await run("readwrite", (store) => store.delete(id));
  } catch {
    // Already gone or storage unavailable.
  }
}

export async function queuedPhotos(
  inspectionId: string,
  deviceId: string,
): Promise<PendingPhoto[]> {
  try {
    const all = await run<PendingPhoto[]>("readonly", (store) => store.getAll());
    return all
      .filter((photo) => photo.inspectionId === inspectionId && photo.deviceId === deviceId)
      .sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return [];
  }
}
