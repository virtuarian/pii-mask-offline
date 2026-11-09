// `?worker&inline` makes Vite base64-embed the worker's compiled code and
// return a constructor that instantiates it from a blob: URL at runtime --
// no separate worker chunk file needed, which is required for a
// single-HTML-file distribution (see createNerWorker.ts for the normal build).
import NerWorkerConstructor from "./ner.worker.ts?worker&inline";

export function createNerWorker(): Worker {
  return new NerWorkerConstructor();
}
