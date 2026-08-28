/**
 * IndexedDB-based persistent cache for generated images.
 * LocalStorage has a ~5MB limit which can hold only 1-2 base64 images;
 * IndexedDB supports hundreds of MB / GB and keeps all images across refreshes.
 */

const DB_NAME = 'ai-studio-cache';
const DB_VERSION = 1;
const STORE_GENERATED = 'generated-images';
const LEGACY_LS_KEY = 'ai-studio-generated-images';

import type { GeneratedImage } from '@/components/ai-studio/types';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_GENERATED)) {
        const store = db.createObjectStore(STORE_GENERATED, { keyPath: 'timestamp' });
        store.createIndex('timestamp', 'timestamp', { unique: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('DB blocked'));
  });
}

function txPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<R>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => Promise<R> | R,
): Promise<R> {
  const db = await openDB();
  const tx = db.transaction(STORE_GENERATED, mode);
  const store = tx.objectStore(STORE_GENERATED);
  const result = await fn(store);
  return new Promise<R>((resolve, reject) => {
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Save / replace the full ordered list of generated images */
export async function saveGeneratedImages(images: GeneratedImage[]): Promise<void> {
  try {
    await withStore('readwrite', (store) => {
      // Clear existing records then bulk insert new ones, so order is preserved by timestamp
      store.clear();
      images.forEach((img) => store.add(img));
    });
  } catch (err) {
    // Quota exceeded in IndexedDB is extremely rare (GB range); fall back silently
    console.warn('IndexedDB save failed:', err);
  }
}

/** Load the full ordered list of generated images (sorted by timestamp asc → oldest first) */
export async function loadGeneratedImages(): Promise<GeneratedImage[]> {
  // Try IndexedDB first
  try {
    const list = await withStore<GeneratedImage[]>('readonly', async (store) => {
      const all = await txPromise<GeneratedImage[]>(store.getAll());
      return all || [];
    });
    // Sort ascending by timestamp (oldest first → newest appears last in the list)
    list.sort((a, b) => a.timestamp - b.timestamp);

    // Migrate legacy localStorage if IndexedDB was empty
    if (list.length === 0 && typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(LEGACY_LS_KEY);
        if (raw) {
          const migrated = JSON.parse(raw) as GeneratedImage[];
          if (Array.isArray(migrated) && migrated.length > 0) {
            await saveGeneratedImages(migrated);
            try { localStorage.removeItem(LEGACY_LS_KEY); } catch {}
            return migrated;
          }
        }
      } catch {}
    }
    return list;
  } catch (err) {
    console.warn('IndexedDB load failed:', err);
    // Fallback: legacy localStorage
    try {
      if (typeof window === 'undefined') return [];
      const raw = localStorage.getItem(LEGACY_LS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}
