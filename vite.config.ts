import { defineConfig, type Plugin } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL("./package.json", import.meta.url)), "utf-8"),
) as { version: string };

// onnxruntime-web's "wasm" entry (see the resolve.alias below) resolves its
// wasm binary's URL dynamically at runtime, so Vite/Rollup can't statically
// discover and bundle it the way it does for the default (jsep) entry. We
// serve it ourselves as a same-origin static asset and point onnxruntime-web
// at it via env.backends.onnx.wasm.wasmPaths (see pipeline.ts). Synced from
// node_modules on every `vite` invocation so it can't drift after a
// dependency bump; not committed to git (see .gitignore).
function syncOrtWasmAsset(): void {
  const destDir = fileURLToPath(new URL("./public/ort/", import.meta.url));
  mkdirSync(destDir, { recursive: true });
  // The .wasm binary is loaded via wasmPaths (pipeline.ts); onnxruntime-web
  // also dynamically imports the .mjs loader next to it at init time, so
  // both must be served from the same same-origin directory.
  for (const name of ["ort-wasm-simd-threaded.wasm", "ort-wasm-simd-threaded.mjs"]) {
    const src = fileURLToPath(new URL(`./node_modules/onnxruntime-web/dist/${name}`, import.meta.url));
    const dest = `${destDir}${name}`;
    if (existsSync(dest) && statSync(dest).size === statSync(src).size) continue;
    copyFileSync(src, dest);
  }
}
syncOrtWasmAsset();

// onnxruntime-web loads its .mjs wasm-loader via a native `import()`, not a
// fetch. In `vite build`/`vite preview` that's just a same-origin static
// file request and works fine, but `vite dev`'s transform middleware
// intercepts anything imported as a module -- including files under
// public/ -- and refuses to serve them ("should not be imported from source
// code"), breaking NER model loading in dev only. Serve this one file
// ourselves, ahead of Vite's own middleware, to sidestep that guard.
function serveOrtMjsInDev(): Plugin {
  const filePath = fileURLToPath(new URL("./public/ort/ort-wasm-simd-threaded.mjs", import.meta.url));
  return {
    name: "serve-ort-mjs-in-dev",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split("?")[0] === "/ort/ort-wasm-simd-threaded.mjs") {
          res.setHeader("Content-Type", "text/javascript");
          res.end(readFileSync(filePath));
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      // @huggingface/transformers imports the bare "onnxruntime-web" entry,
      // which bundles WebGPU (JSEP) support and pulls in a ~21.6MB wasm
      // binary. This app only ever runs the "wasm" execution provider (see
      // pipeline.ts), so alias to the wasm-only build (~11.1MB wasm) instead
      // — halves the mandatory first-load download with no behavior change.
      "onnxruntime-web": "onnxruntime-web/wasm",
    },
  },
  plugins: [
    serveOrtMjsInDev(),
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src/sw",
      filename: "service-worker.ts",
      injectManifest: {
        // Model assets are large; raise the default 2 MiB precache limit.
        // The xlm-roberta-ner-japanese ONNX model alone is ~278 MB quantized
        // (see docs/MODEL_SELECTION.md) -- Workbox silently drops any file
        // over this limit from the precache manifest instead of erroring, so
        // keep this comfortably above the actual public/models/ner-ja/ size.
        maximumFileSizeToCacheInBytes: 320 * 1024 * 1024,
        // Includes the ONNX Runtime Web wasm binary (required for the core,
        // always-on NER layer) alongside JS/CSS/HTML/icons and the NER model
        // files. Excludes the wllama wasm/model: Layer 3 is opt-in/experimental
        // (see docs/MODEL_SELECTION.md), so its assets are fetched on first use
        // instead of being forced into every visitor's initial download.
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest,wasm}", "models/ner-ja/**/*"],
        globIgnores: ["**/wllama-*.wasm"],
      },
      manifest: {
        name: "個人情報マスキングツール",
        short_name: "PIIマスク",
        description: "ブラウザ完結・オフライン動作の個人情報マスキングツール",
        start_url: "/",
        display: "standalone",
        background_color: "#0f172a",
        theme_color: "#0f172a",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      devOptions: {
        enabled: false,
      },
      injectRegister: false,
    }),
  ],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.test.ts"],
  },
});
