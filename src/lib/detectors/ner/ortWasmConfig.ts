import type { env } from "@huggingface/transformers";

/**
 * Normal-build wasm loading: served as same-origin static files (synced by
 * vite.config.ts's syncOrtWasmAsset) so the Service Worker can precache them.
 * The single-file build swaps this module out for ortWasmConfig.inline.ts
 * (see vite.singlefile.config.ts's resolve.alias) which embeds the wasm
 * binary instead, since there is no "/ort/" to serve it from.
 */
export async function configureOrtWasm(ortEnv: typeof env): Promise<void> {
  if (ortEnv.backends.onnx.wasm) {
    ortEnv.backends.onnx.wasm.wasmPaths = "/ort/";
  }
}
