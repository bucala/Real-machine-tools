// Rozpracovaná práca na moderných strojoch (program, nastavenie, obrábaný obrobok) v IndexedDB tohto prehliadača.
// IndexedDB a nie localStorage: voxelový obrobok má stovky kB až jednotky MB (Int8Array sa uloží priamo).
// Bez IndexedDB (súkromné okno, zakázané úložisko) sa nič neuloží a aplikácia funguje ďalej.
const DB = 'rmt-work',
  STORE = 'sessions',
  VERSION = 1;

let dbPromise = null;
function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const req = globalThis.indexedDB?.open(DB, VERSION);
      if (!req) return resolve(null);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}
const run = async (mode, fn) => {
  const db = await open();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, mode),
        req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req?.result ?? true);
      tx.onerror = tx.onabort = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
};

export const saveWork = (machine, data) => run('readwrite', (s) => s.put({ ...data, savedAt: Date.now() }, machine));
// prázdne úložisko vráti null (nie true z run) – inak by sa ukázala lišta s „Invalid Date“
export const loadWork = async (machine) => {
  const r = await run('readonly', (s) => s.get(machine));
  return r && typeof r === 'object' && Number.isFinite(r.savedAt) ? r : null;
};
export const clearWork = (machine) => run('readwrite', (s) => s.delete(machine));

// súhrn obrobku do uloženia: vzdialenostné pole, odobraný objem a podpis rozmerov
export const stockSnapshot = (stock, sig) => stock && { sig, field: stock.field.slice(), removed: stock.removed() };
