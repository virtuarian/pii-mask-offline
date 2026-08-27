import { detectByNer, preloadNerModel, type NerDetection } from "../lib/detectors/ner/pipeline";

export type NerWorkerRequest = { type: "preload" } | { type: "detect"; id: number; text: string };

export type NerWorkerResponse =
  | { type: "ready" }
  | { type: "error"; id?: number; message: string }
  | { type: "result"; id: number; detections: NerDetection[] };

self.onmessage = async (event: MessageEvent<NerWorkerRequest>) => {
  const message = event.data;
  try {
    if (message.type === "preload") {
      await preloadNerModel();
      postMessage({ type: "ready" } satisfies NerWorkerResponse);
      return;
    }
    if (message.type === "detect") {
      const detections = await detectByNer(message.text);
      postMessage({ type: "result", id: message.id, detections } satisfies NerWorkerResponse);
    }
  } catch (err) {
    const id = message.type === "detect" ? message.id : undefined;
    postMessage({
      type: "error",
      id,
      message: err instanceof Error ? err.message : String(err),
    } satisfies NerWorkerResponse);
  }
};
