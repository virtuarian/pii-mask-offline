import { useEffect, useState } from "react";
import { APP_SHELL_CACHE_NAME, MODEL_ASSETS_CACHE_NAME } from "../sw/cache-config";

export type CacheReadiness = "checking" | "ready" | "not-ready";

export interface OfflineStatus {
  /** Live network state (navigator.onLine); informational only. */
  online: boolean;
  /** Whether both the app shell and model asset caches are present. */
  readiness: CacheReadiness;
}

/**
 * Reports whether this device already has everything cached for fully
 * offline use, independent of current connectivity — used to render the
 * "モデル準備完了・オフライン利用可" status banner.
 */
export function useOfflineStatus(): OfflineStatus {
  const [online, setOnline] = useState(navigator.onLine);
  const [readiness, setReadiness] = useState<CacheReadiness>("checking");

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!("caches" in window)) {
        if (!cancelled) setReadiness("not-ready");
        return;
      }
      try {
        const [hasShell, hasModel] = await Promise.all([
          caches.has(APP_SHELL_CACHE_NAME),
          caches.has(MODEL_ASSETS_CACHE_NAME),
        ]);
        if (!cancelled) setReadiness(hasShell && hasModel ? "ready" : "not-ready");
      } catch {
        if (!cancelled) setReadiness("not-ready");
      }
    }
    void check();
    navigator.serviceWorker?.ready.then(() => void check());
    return () => {
      cancelled = true;
    };
  }, []);

  return { online, readiness };
}
