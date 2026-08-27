/// <reference lib="webworker" />
import { APP_SHELL_CACHE_NAME, MODEL_ASSETS_CACHE_NAME, CURRENT_CACHE_NAMES } from "./cache-config";

interface ManifestEntry {
  url: string;
  revision: string | null;
}

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: ManifestEntry[] };

// Populated at build time by vite-plugin-pwa's injectManifest strategy with
// every precached file: app shell (JS/CSS/HTML/icons) *and* the NER model
// assets under public/models/ (see vite.config.ts globPatterns). Splitting
// them into two Cache Storage buckets lets an app-only release bump
// APP_CACHE_VERSION without forcing a model re-download, and vice versa
// (see docs/CACHING_STRATEGY.md).
const manifestEntries = self.__WB_MANIFEST ?? [];

function isModelAsset(url: string): boolean {
  return url.startsWith("models/") || url.includes("/models/");
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const shellCache = await caches.open(APP_SHELL_CACHE_NAME);
      const modelCache = await caches.open(MODEL_ASSETS_CACHE_NAME);
      const shellUrls: string[] = [];
      const modelUrls: string[] = [];
      for (const entry of manifestEntries) {
        (isModelAsset(entry.url) ? modelUrls : shellUrls).push(entry.url);
      }
      await Promise.all([
        shellUrls.length > 0 ? shellCache.addAll(shellUrls) : Promise.resolve(),
        modelUrls.length > 0 ? modelCache.addAll(modelUrls) : Promise.resolve(),
      ]);
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
        return await fetch(request);
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
