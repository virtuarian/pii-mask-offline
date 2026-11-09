/**
 * Normal-build worker instantiation: a separate, same-origin chunk file so
 * the Service Worker can precache it independently. The single-file build
 * swaps this module out for createNerWorker.inline.ts (see
 * vite.singlefile.config.ts's resolve.alias), which embeds the worker code
 * as base64 instead, since there is no separate file to reference.
 */
export function createNerWorker(): Worker {
  return new Worker(new URL("./ner.worker.ts", import.meta.url), { type: "module" });
}
