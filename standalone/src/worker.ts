import {
  detectByNer,
  preloadNerModel,
  configureNerPipeline,
  DEFAULT_NER_THRESHOLDS,
  type NerDetection,
  type NerThresholds,
} from "../../src/lib/detectors/ner/pipeline";

// The standalone build ships no same-origin model/wasm assets of its own
// (see build.mjs): the NER model is pulled straight from the Hugging Face
// Hub on first use (then cached by the browser -- see pipeline.ts's
// env.useBrowserCache -- so every later run is fully offline). The
// onnxruntime-web wasm runtime itself is NOT fetched over the network at
// all: build.mjs embeds it directly into this worker's bundled source as
// blob: URLs, set up in installBundledWasmRuntime() below.
declare const __ORT_WASM_BASE64__: string;
declare const __ORT_MJS_SOURCE__: string;

function base64ToBlobUrl(base64: string, mimeType: string): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
}

function installBundledWasmRuntime(): void {
  const wasmUrl = base64ToBlobUrl(__ORT_WASM_BASE64__, "application/wasm");
  const mjsUrl = URL.createObjectURL(new Blob([__ORT_MJS_SOURCE__], { type: "text/javascript" }));
  configureNerPipeline({
    modelId: "tsmatz/xlm-roberta-ner-japanese",
    allowRemoteModels: true,
    wasmPaths: { wasm: wasmUrl, mjs: mjsUrl },
  });
}
installBundledWasmRuntime();

export type NerWorkerRequest =
  | { type: "preload" }
  | { type: "detect"; id: number; text: string; thresholds?: NerThresholds };

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
      const detections = await detectByNer(message.text, message.thresholds ?? DEFAULT_NER_THRESHOLDS);
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
