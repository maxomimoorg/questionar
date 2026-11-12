// Keys of contacts' protected questionnaires, saved after a correct password so it is not asked
// again on the next launch. Separate local IndexedDB database; never shared or exported. Only the
// derived, non-extractable AES key is stored (not the password), tied to contact + keyVersion.

import type { ProtectedSection } from "./questions";

export type StoredUnlock = {
  handle: string;
  section: ProtectedSection;
  keyVersion: number;
  salt: string;
  key: CryptoKey;
  savedAt: number;
};

export interface UnlockStorage {
  get(handle: string, section: ProtectedSection): Promise<StoredUnlock | null>;
  put(entry: StoredUnlock): Promise<void>;
  remove(handle: string, section: ProtectedSection): Promise<void>;
  clear(): Promise<void>;
}

export const UNLOCK_DB_NAME = "questionar-unlocks";
const STORE = "keys";

const idOf = (handle: string, section: ProtectedSection) => `${handle}|${section}`;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(UNLOCK_DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(
  mode: IDBTransactionMode,
  op: (store: IDBObjectStore) => IDBRequest | void,
): Promise<T | null> {
  if (typeof indexedDB === "undefined") return null;
  try {
    const db = await openDb();
    return await new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = op(tx.objectStore(STORE));
      tx.oncomplete = () => {
        db.close();
        resolve(req ? ((req.result as T) ?? null) : null);
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    return null;
  }
}

export const idbUnlockStorage: UnlockStorage = {
  get: (handle, section) => run<StoredUnlock>("readonly", (s) => s.get(idOf(handle, section))),
  put: async (entry) => {
    await run("readwrite", (s) => {
      s.put(entry, idOf(entry.handle, entry.section));
    });
  },
  remove: async (handle, section) => {
    await run("readwrite", (s) => {
      s.delete(idOf(handle, section));
    });
  },
  clear: async () => {
    await run("readwrite", (s) => {
      s.clear();
    });
  },
};
