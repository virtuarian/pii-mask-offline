import { useEffect, useRef, useState } from "react";
import type { NerDetection, NerThresholds } from "../lib/detectors/ner/pipeline";
import type { NerWorkerResponse } from "../workers/ner.worker";

export type NerModelStatus = "idle" | "loading" | "ready" | "error";

interface PendingRequest {
  resolve: (detections: NerDetection[]) => void;
  reject: (err: Error) => void;
}

export interface UseNerModel {
  status: NerModelStatus;
  error: string | null;
  detect: (text: string, thresholds?: NerThresholds) => Promise<NerDetection[]>;
}

/** Owns the NER Web Worker's lifecycle and exposes a request/response API over it. */
export function useNerModel(): UseNerModel {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<Map<number, PendingRequest>>(new Map());
  const nextIdRef = useRef(0);
  const [status, setStatus] = useState<NerModelStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const worker = new Worker(new URL("../workers/ner.worker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = worker;
    setStatus("loading");

    worker.onmessage = (event: MessageEvent<NerWorkerResponse>) => {
      const msg = event.data;
      if (msg.type === "ready") {
        setStatus("ready");
      } else if (msg.type === "result") {
        pendingRef.current.get(msg.id)?.resolve(msg.detections);
        pendingRef.current.delete(msg.id);
      } else if (msg.type === "error") {
        if (msg.id !== undefined) {
          pendingRef.current.get(msg.id)?.reject(new Error(msg.message));
          pendingRef.current.delete(msg.id);
        } else {
          setStatus("error");
          setError(msg.message);
        }
      }
    };

    worker.postMessage({ type: "preload" });

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const detect = (text: string, thresholds?: NerThresholds): Promise<NerDetection[]> =>
    new Promise((resolve, reject) => {
      const worker = workerRef.current;
      if (!worker) {
        reject(new Error("NER worker is not initialized"));
        return;
      }
      const id = nextIdRef.current++;
      pendingRef.current.set(id, { resolve, reject });
      worker.postMessage({ type: "detect", id, text, thresholds });
    });

  return { status, error, detect };
}
