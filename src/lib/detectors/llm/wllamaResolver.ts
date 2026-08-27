import { Wllama } from "@wllama/wllama";
import wllamaWasmUrl from "@wllama/wllama/esm/wasm/wllama.wasm?url";
import type { EntityCategory } from "../types";
import type { LlmJudgement, LlmResolver } from "./resolver";

/**
 * EXPERIMENTAL / opt-in only (see docs/MODEL_SELECTION.md and the task plan's
 * "LLM layer scope" decision: this build ships Layer 1 + Layer 2 as the fully
 * hardened core, and Layer 3 as a pluggable scaffold behind this flag).
 *
 * Points at a same-origin GGUF file so the offline/CSP guarantees in
 * docs/CACHING_STRATEGY.md hold for this layer too. The model file itself is
 * NOT bundled by default — drop a quantized 0.5B-1B instruct GGUF (e.g.
 * Qwen2.5-0.5B-Instruct Q4_K_M) at public/models/llm-ja/model.gguf and it
 * will be picked up (and precached by the service worker) automatically.
 */
const LOCAL_GGUF_URL = "/models/llm-ja/model.gguf";

function buildPrompt(
  candidate: string,
  context: string,
  options: readonly EntityCategory[],
): string {
  return [
    "あなたは個人情報検出システムの補助判定器です。",
    "次の文字列がどの分類に該当するか、選択肢の中から1つだけ答えてください。",
    "文章を書き換えたり説明を加えたりせず、分類名のみを出力してください。",
    "",
    `文脈: ${context}`,
    `対象文字列: 「${candidate}」`,
    `選択肢: ${options.join(", ")}`,
    "",
    "分類名:",
  ].join("\n");
}

function parseCategory(
  output: string,
  options: readonly EntityCategory[],
): EntityCategory | null {
  const cleaned = output.trim();
  return options.find((opt) => cleaned.includes(opt)) ?? null;
}

export class WllamaResolver implements LlmResolver {
  isAvailable = true;
  private instance: Wllama | null = null;
  private loading: Promise<Wllama> | null = null;

  private async load(): Promise<Wllama> {
    if (this.instance) return this.instance;
    if (!this.loading) {
      this.loading = (async () => {
        const wllama = new Wllama({ default: wllamaWasmUrl });
        await wllama.loadModelFromUrl(LOCAL_GGUF_URL, { n_ctx: 1024 });
        this.instance = wllama;
        return wllama;
      })();
    }
    return this.loading;
  }

  async resolve(
    candidate: string,
    context: string,
    options: readonly EntityCategory[],
  ): Promise<LlmJudgement | null> {
    try {
      const wllama = await this.load();
      const prompt = buildPrompt(candidate, context, options);
      const response = await wllama.createCompletion({
        prompt,
        max_tokens: 8,
        temperature: 0,
        stream: false,
      });
      const category = parseCategory(response.choices[0]?.text ?? "", options);
      if (!category) return null;
      return { category, confidence: 0.6 };
    } catch (err) {
      console.error("[wllamaResolver] judgement failed, deferring to NER result", err);
      return null;
    }
  }
}
