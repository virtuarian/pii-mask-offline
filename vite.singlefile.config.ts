import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { cpSync, readFileSync, renameSync } from "node:fs";
import { fileURLToPath } from "node:url";

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL("./package.json", import.meta.url)), "utf-8"),
) as { version: string };

function absPath(relativeToConfig: string): string {
  return fileURLToPath(new URL(relativeToConfig, import.meta.url));
}

/**
 * Swaps a handful of modules for versions that embed their assets instead of
 * referencing same-origin static files (there are none in a single-file
 * build) -- see each ".inline.ts" file for why. A hand-written resolveId
 * (rather than vite's `resolve.alias`) sidesteps a cross-platform bug where
 * rollup's own alias resolution mishandles a Windows absolute replacement
 * path (treats "C:\..." as relative to the importer instead of absolute).
 */
function inlineAssetModules(): Plugin {
  const swaps: Record<string, string> = {
    ortWasmConfig: absPath("./src/lib/detectors/ner/ortWasmConfig.inline.ts"),
    createNerWorker: absPath("./src/workers/createNerWorker.inline.ts"),
  };
  return {
    name: "inline-asset-modules",
    // Must run before vite's own core resolve plugin, which otherwise
    // resolves the relative specifier to the normal (non-inline) file first
    // and short-circuits this hook.
    enforce: "pre",
    resolveId(source) {
      const base = source.replace(/\.tsx?$/, "").split(/[/\\]/).pop();
      if (base && base in swaps) return swaps[base];
      return null;
    },
  };
}

/**
 * Copies only public/models/ (the NER/LLM model files, fetched at runtime
 * next to the HTML file -- see docs/SINGLE_FILE_BUILD.md) into outDir. The rest of public/
 * (icons/, ort/) is normal-build-only: icons back the PWA manifest this
 * build doesn't have, and ort/ is the same-origin wasm this build embeds
 * instead (see ortWasmConfig.inline.ts) -- copying it too would just double
 * ~11MB of dead weight into the output.
 *
 * Also renames the emitted index.singlefile.html to index.html so a plain
 * static file server (e.g. `npx serve dist-singlefile`) serves it as the
 * directory's default document.
 */
function copyModelsOnly(): Plugin {
  return {
    name: "copy-models-only",
    closeBundle() {
      cpSync(absPath("./public/models"), absPath("./dist-singlefile/models"), { recursive: true });
      renameSync(absPath("./dist-singlefile/index.singlefile.html"), absPath("./dist-singlefile/index.html"));
    },
  };
}

/**
 * Builds the app as a single distributable index.html with no Service
 * Worker/PWA manifest and no separate JS/CSS/wasm chunk files -- everything
 * except the NER/LLM model files themselves (still fetched at runtime; see
 * docs/SINGLE_FILE_BUILD.md) is embedded in one file.
 *
 * This is a distinct build target from vite.config.ts's normal PWA build,
 * not a variant of it: several modules are swapped via inlineAssetModules()
 * above for versions that embed what the normal build serves as same-origin
 * static files (see each ".inline.ts" file for why), and there is no
 * equivalent here of vite.config.ts's Service Worker precaching, since a
 * single HTML file has nowhere for a Service Worker to precache into.
 */
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: [
      // Same halved-download rationale as vite.config.ts.
      { find: "onnxruntime-web", replacement: "onnxruntime-web/wasm" },
    ],
  },
  plugins: [
    inlineAssetModules(),
    react(),
    viteSingleFile({ removeViteModuleLoader: true }),
    copyModelsOnly(),
  ],
  build: {
    outDir: "dist-singlefile",
    copyPublicDir: false,
    rollupOptions: {
      input: fileURLToPath(new URL("./index.singlefile.html", import.meta.url)),
    },
  },
});
