import { noopResolver } from "./noopResolver";
import type { LlmResolver } from "./resolver";

export type { LlmResolver, LlmJudgement } from "./resolver";
export { noopResolver } from "./noopResolver";

let wllamaResolverSingleton: LlmResolver | null = null;

/**
 * Returns the active Layer 3 resolver. Disabled (Noop) by default per the
 * "scaffold only" scope decision — pass `enabled: true` only in response to
 * an explicit user opt-in (e.g. a settings toggle), since it lazy-loads a
 * multi-hundred-MB WASM LLM runtime on first use.
 */
export async function getLlmResolver(enabled: boolean): Promise<LlmResolver> {
  if (!enabled) return noopResolver;
  if (!wllamaResolverSingleton) {
    const { WllamaResolver } = await import("./wllamaResolver");
    wllamaResolverSingleton = new WllamaResolver();
  }
  return wllamaResolverSingleton;
}
