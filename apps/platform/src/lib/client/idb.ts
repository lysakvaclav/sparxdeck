"use client";

// The phone's IndexedDB: photos waiting to be uploaded, inspection packs for
// work without a signal, and their floor plan images.

const DB = "sparxdeck";
const VERSION = 2;

export const STORES = {
  photos: "pending-photos",
  packs: "packs",
  planImages: "plan-images",
} as const;

type Store = (typeof STORES)[keyof typeof STORES];

const KEYS: Record<Store, string> = {
  "pending-photos": "id",
  packs: "inspectionId",
  "plan-images": "path",
};

export function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, VERSION);
    request.onupgradeneeded = () => {
      for (const store of Object.values(STORES))
        if (!request.result.objectStoreNames.contains(store))
          request.result.createObjectStore(store, { keyPath: KEYS[store] });
    };
    request.onsuccess = () => {
      // Another tab upgrading: let it.
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("IndexedDB blocked"));
  });
}

/**
 * One request in its own transaction, resolved once the transaction commits: a
 * write that fails only then (a full phone) is reported, not taken as saved.
 */
export async function idb<T>(
  store: Store,
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(store, mode);
      const request = work(transaction.objectStore(store));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error ?? request.error);
      transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB aborted"));
    });
  } finally {
    db.close();
  }
}

/** Empties stores (signing out). */
export async function clearStores(stores: Store[]): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(stores, "readwrite");
      for (const store of stores) transaction.objectStore(store).clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB aborted"));
    });
  } finally {
    db.close();
  }
}
