import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL("./package.json", import.meta.url)), "utf-8"),
) as { version: string };

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src/sw",
      filename: "service-worker.ts",
      injectManifest: {
        // Model assets are large; raise the default 2 MiB precache limit.
        maximumFileSizeToCacheInBytes: 80 * 1024 * 1024,
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
