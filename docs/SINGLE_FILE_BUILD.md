# Single-file HTML build

`npm run build:singlefile` builds the app as one distributable `index.html`
(vite.singlefile.config.ts) instead of the normal multi-file PWA build
(vite.config.ts). This is for handing the tool to someone as a file rather
than deploying it: everything except the NER/LLM model files -- the app
code, CSS, the NER Web Worker, and the ONNX Runtime / wllama WebAssembly
binaries -- is embedded in that one HTML file (see ortWasmConfig.inline.ts
and createNerWorker.inline.ts for how).

## What's different from the normal build

- No Service Worker / PWA manifest / offline precaching -- there is nowhere
  for a Service Worker to precache into when the app is one file, so
  `useOfflineStatus`'s cache-readiness banner will always read "not cached"
  in this build. The tool still works; that status line just doesn't apply.
- Looser CSP (`index.singlefile.html`): `script-src` needs `'unsafe-inline'`
  (the whole app is one inline `<script>`) and `data:` (the ONNX Runtime
  wasm-loader glue is imported from a `data:` URL, since there's no
  same-origin file to serve it from). This is a deliberate trade specific to
  a self-contained file with no third-party content to defend against.

## What's the same

- The NER/LLM model files (`public/models/`, several hundred MB) are still
  fetched at runtime, not embedded -- ship them as a `models/` folder
  alongside the HTML file (the build copies `public/models/` into
  `dist-singlefile/models/` for you).

## Distributing it

Copy `dist-singlefile/index.html` and `dist-singlefile/models/` together,
keeping them siblings, and serve that folder with a static file server, e.g.:

```sh
npx serve dist-singlefile
```

Opening the HTML file directly via `file://` (double-click) does **not**
work: the app fetches model files from an absolute path (`/models/...`),
which resolves against the filesystem root under `file://`, not the folder
next to the HTML file.
