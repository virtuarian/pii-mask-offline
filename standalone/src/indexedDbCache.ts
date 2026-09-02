/**
 * A Web Cache API-shaped `{ match, put }` cache backed by IndexedDB instead
 * of Cache Storage, passed to pipeline.ts's configureNerPipeline() as
 * customCache.
 *
 * Why this exists: the standalone build is meant to be opened directly as a
 * local file (file://), with no server. Cache Storage's `Cache.put()`
 * rejects `file:` request URLs outright ("Request scheme 'file' is
 * unsupported" -- confirmed by testing in Chromium), so
 * @huggingface/transformers' own useBrowserCache path silently never
 * persists the downloaded NER model under file:, and every run re-fetches
 * the full ~265MB from the Hugging Face Hub. IndexedDB has no such
 * restriction (verified working under file: as well as http:), so this
 * reimplements just enough of the Cache API surface (match/put) using it.
 */

const DB_NAME = "pii-mask-standalone-model-cache";
const DB_VERSION = 1;
const STORE_NAME = "responses";

interface StoredResponse {
  body: ArrayBuffer;
  status: number;
  statusText: string;
  headers: Array<[string, string]>;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB"));
  });
}

export function createIndexedDbCache(): { match: (key: string) => Promise<Response | undefined>; put: (key: string, response: Response) => Promise<void> } {
  const dbPromise = openDb();

  return {
    async match(key: string): Promise<Response | undefined> {
      const db = await dbPromise;
      const stored = await new Promise<StoredResponse | undefined>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const req = tx.objectStore(STORE_NAME).get(key);
        req.onsuccess = () => resolve(req.result as StoredResponse | undefined);
        req.onerror = () => reject(req.error ?? new Error("IndexedDB read failed"));
      });
      if (!stored) return undefined;
      return new Response(stored.body, {
        status: stored.status,
        statusText: stored.statusText,
        headers: stored.headers,
      });
    },

    async put(key: string, response: Response): Promise<void> {
      // Clone before consuming the body: the caller (transformers.js) also
      // reads the same response after handing it to us.
      const body = await response.clone().arrayBuffer();
      const headers: Array<[string, string]> = [];
      response.headers.forEach((value, name) => headers.push([name, value]));
      const record: StoredResponse = { body, status: response.status, statusText: response.statusText, headers };

      const db = await dbPromise;
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(record, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error("IndexedDB write failed"));
      });
    },
  };
}
