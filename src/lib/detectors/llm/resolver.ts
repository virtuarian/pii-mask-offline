import type { EntityCategory } from "../types";

export interface LlmJudgement {
  category: EntityCategory;
  confidence: number;
}

/**
 * Layer 3 (optional): a final judge for spans the NER layer flagged as
 * ambiguous (mid-confidence). It never rewrites or generates text — it only
 * answers "which category is this substring" (or "none") for one candidate
 * at a time, so it can never change non-PII content.
 */
export interface LlmResolver {
  readonly isAvailable: boolean;
  /**
   * @param candidate The exact substring the NER layer flagged as ambiguous.
   * @param context A short window of surrounding text, for disambiguation.
   * @param options The categories to choose between (the NER layer's own
   *   top guess should be included so the resolver can confirm it).
   * @returns The resolver's pick, or null to defer to the NER layer's guess.
   */
  resolve(
    candidate: string,
    context: string,
    options: readonly EntityCategory[],
  ): Promise<LlmJudgement | null>;
}
