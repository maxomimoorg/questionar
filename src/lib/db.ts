// Local-only persistence (IndexedDB). No cloud.
//
// loadState distinguishes "no saved profile" (resolves null) from "the database could not be
// read" (rejects): the store must never treat a failed read as a first launch, otherwise its
// auto-save would overwrite the real profile with an empty one.

const DB_NAME = "questionar";
const STORE = "state";
const KEY = "app";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => {
      const db = req.result;
      // Another tab upgrading the schema must not stay blocked by this connection.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("indexeddb_blocked"));
  });
}

/** Runs one transaction on its own connection, closed as soon as the transaction ends. */
async function run<T>(
  mode: IDBTransactionMode,
  op: (store: IDBObjectStore) => IDBRequest | void,
): Promise<T | null> {
  const db = await openDb();
  try {
    return await new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = op(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req ? ((req.result as T) ?? null) : null);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error("indexeddb_abort"));
    });
  } finally {
    db.close();
  }
}

/**
 * The saved state, or null when there is none (first launch, or no IndexedDB at all).
 * Rejects when IndexedDB exists but cannot be read.
 */
export async function loadState<T>(): Promise<T | null> {
  if (typeof indexedDB === "undefined") return null;
  return run<T>("readonly", (store) => store.get(KEY));
}

export async function saveState<T>(state: T): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try {
    await run("readwrite", (store) => {
      store.put(state, KEY);
    });
  } catch {
    /* the next change saves again */
  }
}

export async function clearState(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  await run("readwrite", (store) => {
    store.delete(KEY);
  });
}
