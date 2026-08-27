import type { LlmResolver } from "./resolver";

/** Default resolver: Layer 3 is disabled, so every ambiguous NER hit is kept as-is. */
export const noopResolver: LlmResolver = {
  isAvailable: false,
  async resolve() {
    return null;
  },
};
