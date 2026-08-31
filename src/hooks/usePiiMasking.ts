import { useCallback, useState } from "react";
import { detectByRules } from "../lib/detectors/rules";
import { resolveOverlaps } from "../lib/detectors/merge";
import { getLlmResolver } from "../lib/detectors/llm";
import type { Span } from "../lib/detectors/types";
import type { NerDetection } from "../lib/detectors/ner/pipeline";
import { useNerModel, type NerModelStatus } from "./useNerModel";

export interface UsePiiMaskingOptions {
  /** Opt-in flag for the experimental Layer 3 (LLM) disambiguation. Default: off. */
  llmEnabled?: boolean;
}

export interface UsePiiMasking {
  process: (text: string) => Promise<Span[]>;
  isProcessing: boolean;
  nerStatus: NerModelStatus;
  /** Set when nerStatus is "error"; the underlying failure message, for display. */
  nerError: string | null;
}

/**
 * Runs the full detection pipeline for one input: Layer 1 (rules, always),
 * Layer 2 (NER, once the model is ready), and — only for NER hits the model
 * itself flagged as ambiguous, and only if llmEnabled — Layer 3 as a final
 * tie-break. Overlapping spans are then resolved by source priority.
 *
 * Returns the resolved spans rather than a rendered MaskResult: the caller
 * keeps them as editable state (see ChatLayout/ResultBubble) so a user
 * correction -- reverting a false positive, recategorizing, or adding a
 * missed span -- can be applied and re-rendered without rerunning detection.
 */
export function usePiiMasking(options: UsePiiMaskingOptions = {}): UsePiiMasking {
  const { llmEnabled = false } = options;
  const { status: nerStatus, error: nerError, detect } = useNerModel();
  const [isProcessing, setIsProcessing] = useState(false);

  const process = useCallback(
    async (text: string): Promise<Span[]> => {
      setIsProcessing(true);
      try {
        const ruleSpans = detectByRules(text);
        const nerDetections: NerDetection[] = nerStatus === "ready" ? await detect(text) : [];

        const ambiguous = nerDetections.filter((d) => d.ambiguous);
        let nerSpans: Span[] = nerDetections;

        if (ambiguous.length > 0) {
          const resolver = await getLlmResolver(llmEnabled);
          if (resolver.isAvailable) {
            const resolved = await Promise.all(
              ambiguous.map(async (d) => {
                const judgement = await resolver.resolve(d.text, text, [d.category]);
                return judgement
                  ? { ...d, category: judgement.category, confidence: judgement.confidence, source: "llm" as const }
                  : d;
              }),
            );
            const byOriginal = new Map(ambiguous.map((d, i) => [d, resolved[i]] as const));
            nerSpans = nerDetections.map((d) => byOriginal.get(d) ?? d);
          }
        }

        return resolveOverlaps([...ruleSpans, ...nerSpans]);
      } finally {
        setIsProcessing(false);
      }
    },
    [nerStatus, detect, llmEnabled],
  );

  return { process, isProcessing, nerStatus, nerError };
}
