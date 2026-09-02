// Builds standalone/ into a single self-contained dist/standalone.html: no
// build step, no server, and no external file/script requests are needed to
// run it -- just open the file. The only network access it ever makes at
// runtime is fetching the NER model from the Hugging Face Hub on first use
// (see standalone/src/worker.ts); the onnxruntime-web wasm runtime itself is
// embedded directly into the bundle as blob: URLs (see readOrtWasmAssets
// below), so it never touches the network at all.
import esbuild from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, "..");

function readOrtWasmAssets() {
  const wasmDir = path.join(root, "node_modules/onnxruntime-web/dist");
  const wasmBinary = readFileSync(path.join(wasmDir, "ort-wasm-simd-threaded.wasm"));
  const mjsSource = readFileSync(path.join(wasmDir, "ort-wasm-simd-threaded.mjs"), "utf-8");
  return { wasmBase64: wasmBinary.toString("base64"), mjsSource };
}

async function build() {
  const { wasmBase64, mjsSource } = readOrtWasmAssets();

  // @huggingface/transformers imports the bare "onnxruntime-web" entry,
  // which bundles WebGPU (JSEP) support and pulls in a ~21.6MB wasm binary.
  // This build only ever runs the "wasm" execution provider (see
  // pipeline.ts), so alias to the wasm-only build (~11.1MB wasm) instead --
  // same reasoning as vite.config.ts's alias for the PWA build.
  const sharedOptions = {
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2022",
    write: false,
    minify: true,
    alias: { "onnxruntime-web": "onnxruntime-web/wasm" },
    logLevel: "warning",
  };

  const workerResult = await esbuild.build({
    ...sharedOptions,
    entryPoints: [path.join(dir, "src/worker.ts")],
    define: {
      __ORT_WASM_BASE64__: JSON.stringify(wasmBase64),
      __ORT_MJS_SOURCE__: JSON.stringify(mjsSource),
    },
  });
  const workerSource = workerResult.outputFiles[0].text;

  const appResult = await esbuild.build({
    ...sharedOptions,
    entryPoints: [path.join(dir, "src/app.ts")],
    define: {
      __WORKER_SOURCE__: JSON.stringify(workerSource),
    },
  });
  const appSource = appResult.outputFiles[0].text;

  const css = readFileSync(path.join(dir, "src/styles.css"), "utf-8");
  const template = readFileSync(path.join(dir, "template.html"), "utf-8");

  const html = template
    .replace("/*__CSS__*/", () => css)
    .replace("/*__JS__*/", () => appSource);

  const distDir = path.join(root, "dist");
  mkdirSync(distDir, { recursive: true });
  const outPath = path.join(distDir, "standalone.html");
  writeFileSync(outPath, html, "utf-8");
  console.log(`Built ${outPath} (${(html.length / (1024 * 1024)).toFixed(2)} MB)`);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
