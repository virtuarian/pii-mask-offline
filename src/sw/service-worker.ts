/// <reference lib="webworker" />
import { APP_SHELL_CACHE_NAME, MODEL_ASSETS_CACHE_NAME, CURRENT_CACHE_NAMES } from "./cache-config";

interface ManifestEntry {
  url: string;
  revision: string | null;
}

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: ManifestEntry[] };

// Populated at build time by vite-plugin-pwa's injectManifest strategy with
// every precached file: app shell (JS/CSS/HTML/icons) *and* the NER model
// assets under public/models/ (see vite.config.ts globPatterns). Only the
// app shell entries are addAll'd eagerly below -- model assets are cached
// lazily by the fetch handler instead (see the install handler's comment).
// Splitting them into two Cache Storage buckets still lets an app-only
// release bump APP_CACHE_VERSION without forcing a model re-download, and
// vice versa (see docs/CACHING_STRATEGY.md).
const manifestEntries = self.__WB_MANIFEST ?? [];

function isModelAsset(url: string): boolean {
  return url.startsWith("models/") || url.includes("/models/");
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      // Only the (small) app shell is eagerly precached here. Model assets
      // are deliberately NOT addAll'd on install: the NER pipeline already
      // fetches them itself the moment the page loads (see useNerModel's
      // mount effect), and on a first visit that request isn't yet
      // SW-controlled, so it always hits the network regardless. Eagerly
      // addAll-ing the same huge files here raced that fetch -- two
      // independent ~280MB downloads of the same file at once, which the
      // dev/preview static server couldn't reliably serve concurrently and
      // sometimes failed outright ("Failed to fetch"). The fetch handler
      // below caches model responses as a side effect of that one real
      // request instead, so the model still ends up fully cached for
      // offline use after the first visit, with exactly one download.
      // Deduplicated: vite-plugin-pwa's manifest injection and this app's
      // own broad globPatterns (see vite.config.ts) both add the manifest
      // icons and manifest.webmanifest itself, so the raw entry list has
      // duplicate URLs. Cache.addAll() throws InvalidStateError on
      // duplicates and is all-or-nothing, which was silently failing this
      // entire install step (confirmed: app-shell-v1 stayed empty even
      // though registration itself succeeded) -- addAll never even reached
      // the network, let alone a real 404, so the failure was invisible
      // without an explicit onRegisterError handler (see main.tsx) and
      // this reproduction.
      const shellUrls = [...new Set(manifestEntries.filter((e) => !isModelAsset(e.url)).map((e) => e.url))];
      if (shellUrls.length > 0) {
        const shellCache = await caches.open(APP_SHELL_CACHE_NAME);
        await shellCache.addAll(shellUrls);
      }
    })(),
  );
  void self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const existingCacheNames = await caches.keys();
      await Promise.all(
        existingCacheNames
          .filter((name) => !CURRENT_CACHE_NAMES.includes(name))
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  event.respondWith(
    (async () => {
      const cached = await caches.match(request, { ignoreSearch: true });
      if (cached) return cached;

      try {
        const response = await fetch(request);
        if (response.ok && isModelAsset(new URL(request.url).pathname)) {
          const modelCache = await caches.open(MODEL_ASSETS_CACHE_NAME);
          await modelCache.put(request, response.clone());
        }
        return response;
      } catch (err) {
        // Offline and this exact resource was never cached (e.g. a deep-link
        // navigation): fall back to the cached app shell entry point.
        if (request.mode === "navigate") {
          const shellCache = await caches.open(APP_SHELL_CACHE_NAME);
          const fallback = await shellCache.match("/index.html");
          if (fallback) return fallback;
        }
        throw err;
      }
    })(),
  );
});
