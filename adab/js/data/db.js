// The phone's own storage (IndexedDB), the web counterpart of the Android app's Room database:
//   entries    the cache of published literature (and tombstones), filled only by the sync
//   favorites  "خوښ شوي", this phone only
//   resume     "نوبت", one reading place per genre, this phone only
//   inbox      the user's own notification list (read / hidden flags), this phone only
//   meta       sync cursor, last sync time, ...
// If IndexedDB cannot be opened (a very old or locked-down browser) everything still works in memory for the visit.

const NAME = 'pashtani-wulsi-adab';
const DB_VERSION = 1;
const STORES = {
  entries: 'id',
  favorites: 'key',
  resume: 'slug',
  inbox: 'id',
  meta: 'key',
};

let dbPromise = null;

function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    let request;
    try {
      request = indexedDB.open(NAME, DB_VERSION);
    } catch (e) {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const [store, keyPath] of Object.entries(STORES)) {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      // Another tab opened a newer version: let it upgrade.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
  return dbPromise;
}

export async function getAll(store) {
  const db = await open();
  if (!db) return [];
  try {
    return await promisify(db.transaction(store, 'readonly').objectStore(store).getAll());
  } catch (e) {
    return [];
  }
}

/** Writes several rows of several stores in ONE transaction: puts {store: [rows]} and deletes {store: [keys]}. */
export async function write(puts = {}, deletes = {}) {
  const db = await open();
  if (!db) return;
  const names = [...new Set([...Object.keys(puts), ...Object.keys(deletes)])];
  if (names.length === 0) return;
  await new Promise((resolve, reject) => {
    const tx = db.transaction(names, 'readwrite');
    for (const [store, rows] of Object.entries(puts)) {
      const os = tx.objectStore(store);
      for (const row of rows) os.put(row);
    }
    for (const [store, keys] of Object.entries(deletes)) {
      const os = tx.objectStore(store);
      for (const key of keys) os.delete(key);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
