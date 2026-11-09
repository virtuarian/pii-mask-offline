import type { env } from "@huggingface/transformers";
// `&inline` forces Vite to base64-embed these regardless of size, instead of
// emitting them as separate same-origin files under "/ort/" (see the normal
// build's ortWasmConfig.ts) -- there is no server to serve those from once
// this is a single distributable HTML file. Imported by a relative
// filesystem path rather than the "onnxruntime-web" package specifier
// because onnxruntime-web's package.json "exports" map doesn't expose
// "./dist/*" as a public subpath (same reason vite.config.ts's
// syncOrtWasmAsset() copies these by filesystem path instead of importing
// them for the normal build).
import ortMjsUrl from "../../../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs?url&inline";
import ortWasmDataUrl from "../../../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm?url&inline";

let wasmBinaryPromise: Promise<Uint8Array> | null = null;

function loadOrtWasmBinary(): Promise<Uint8Array> {
  if (!wasmBinaryPromise) {
    wasmBinaryPromise = fetch(ortWasmDataUrl)
      .then((res) => res.arrayBuffer())
      .then((buf) => new Uint8Array(buf));
  }
  return wasmBinaryPromise;
}

export async function configureOrtWasm(ortEnv: typeof env): Promise<void> {
  if (!ortEnv.backends.onnx.wasm) return;
  // The small wasm-loader glue (~24KB) is imported dynamically by
  // onnxruntime-web itself; pointing it at the embedded data: URL avoids
  // needing a same-origin file for it. The wasm binary itself is passed
  // directly as bytes (wasmBinary), which skips onnxruntime-web's own fetch
  // of it entirely.
  ortEnv.backends.onnx.wasm.wasmPaths = { mjs: ortMjsUrl };
  ortEnv.backends.onnx.wasm.wasmBinary = await loadOrtWasmBinary();
}
