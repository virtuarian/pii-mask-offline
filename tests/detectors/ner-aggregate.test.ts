import { describe, expect, it } from "vitest";
import {
  aggregateEntities,
  assignCharOffsets,
  bridgeAdjacentEntities,
  chunkText,
  extendKatakanaRuns,
} from "../../src/lib/detectors/ner/pipeline";

describe("aggregateEntities", () => {
  it("merges consecutive B-/I- tokens of the same type into one span", () => {
    const tokens = [
      { entity: "O", score: 0.99, start: 0, end: 2 },
      { entity: "B-人名", score: 0.9, start: 2, end: 4 },
      { entity: "I-人名", score: 0.85, start: 4, end: 6 },
      { entity: "O", score: 0.99, start: 6, end: 8 },
    ];
    const groups = aggregateEntities(tokens);
    expect(groups).toEqual([{ label: "人名", start: 2, end: 6, score: 0.85 }]);
  });

  it("keeps a run's minimum score as the group's confidence", () => {
    const tokens = [
      { entity: "B-地名", score: 0.6, start: 0, end: 2 },
      { entity: "I-地名", score: 0.4, start: 2, end: 4 },
      { entity: "I-地名", score: 0.9, start: 4, end: 6 },
    ];
    expect(aggregateEntities(tokens)[0].score).toBe(0.4);
  });

  it("starts a new group when the entity type changes", () => {
    const tokens = [
      { entity: "B-人名", score: 0.9, start: 0, end: 2 },
      { entity: "B-地名", score: 0.9, start: 2, end: 4 },
    ];
    expect(aggregateEntities(tokens)).toHaveLength(2);
  });

  it("drops tokens without character offsets", () => {
    const tokens = [{ entity: "B-人名", score: 0.9, start: undefined, end: undefined }];
    expect(aggregateEntities(tokens)).toHaveLength(0);
  });

  it("ignores O tokens", () => {
    const tokens = [{ entity: "O", score: 0.99, start: 0, end: 5 }];
    expect(aggregateEntities(tokens)).toHaveLength(0);
  });
});

describe("chunkText", () => {
  function expectValidChunking(text: string, chunks: Array<{ text: string; offset: number }>): void {
    // Chunks must reconstruct the original text exactly and each offset
    // must be that chunk's true position in it -- no data loss or drift.
    expect(chunks.map((c) => c.text).join("")).toBe(text);
    for (const chunk of chunks) {
      expect(text.slice(chunk.offset, chunk.offset + chunk.text.length)).toBe(chunk.text);
    }
  }

  it("returns the whole text as one chunk when it already fits", () => {
    const text = "山田太郎です。";
    expect(chunkText(text, 100)).toEqual([{ text, offset: 0 }]);
  });

  it("splits long text at sentence boundaries, preserving every character", () => {
    const text = "山田太郎です。".repeat(20) + "鈴木一郎です。".repeat(20);
    const chunks = chunkText(text, 50);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(50);
    }
    expectValidChunking(text, chunks);
  });

  it("hard-splits a single sentence that alone exceeds maxChars", () => {
    const text = "あ".repeat(30) + "。";
    const chunks = chunkText(text, 10);
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(10);
    }
    expectValidChunking(text, chunks);
  });
});

describe("assignCharOffsets", () => {
  it("locates per-character tokens, skipping over gaps left by stripped O tokens", () => {
    // transformers.js's TokenClassificationPipeline has no offset-mapping
    // support and already drops "O"-labeled tokens (see pipeline.ts), so a
    // real call only ever hands us the entity tokens with gaps in between.
    const text = "山田太郎です。東京都千代田区千代田1-1にお越しください。";
    const tokens = [
      { entity: "PER", score: 0.99, word: "山" },
      { entity: "PER", score: 0.99, word: "田" },
      { entity: "PER", score: 0.99, word: "太郎" },
      { entity: "LOC", score: 0.99, word: "東京都" },
      { entity: "LOC", score: 0.99, word: "1-1" },
    ];
    const offsets = assignCharOffsets(text, tokens);
    expect(offsets.map((t) => [t.start, t.end])).toEqual([
      [0, 1],
      [1, 2],
      [2, 4],
      [7, 10],
      [17, 20],
    ]);
  });

  it("leaves start/end undefined when a token's text can't be found from the cursor onward", () => {
    const offsets = assignCharOffsets("abc", [{ word: "xyz" }]);
    expect(offsets[0].start).toBeUndefined();
    expect(offsets[0].end).toBeUndefined();
  });

  it("feeds directly into aggregateEntities to produce a real span", () => {
    const text = "山田太郎です。";
    const tokens = [
      { entity: "PER", score: 0.99, word: "山" },
      { entity: "PER", score: 0.95, word: "田" },
      { entity: "PER", score: 0.97, word: "太郎" },
    ];
    const groups = aggregateEntities(assignCharOffsets(text, tokens));
    expect(groups).toEqual([{ label: "PER", start: 0, end: 4, score: 0.95 }]);
  });
});

describe("bridgeAdjacentEntities", () => {
  // Reproduces a real observed failure: the model tagged "カナモ" and "サナ"
  // as LOC but predicted "O" for the "リ" and "コ" in between/after, within
  // the single katakana name "カナモリサナコ". Without bridging, aggregation
  // alone leaves those two kana as unmasked plaintext in the final output --
  // a PII leak, not just a mislabel.
  it("merges two entities separated by a short run of plain kana into one span", () => {
    const text = "カナモリサナコ";
    // "カナモ"(0-3) LOC, gap "リ"(3-4), "サナ"(4-6) LOC, gap "コ"(6-7)
    const entities = [
      { label: "LOC", start: 0, end: 3, score: 0.6 },
      { label: "LOC", start: 4, end: 6, score: 0.5 },
    ];
    const merged = bridgeAdjacentEntities(text, entities);
    expect(merged).toEqual([{ label: "LOC", start: 0, end: 6, score: 0.5, bridged: true }]);
  });

  it("does not bridge across a tab (two distinct spreadsheet-style fields)", () => {
    const text = "田中\t太郎";
    const entities = [
      { label: "PER", start: 0, end: 2, score: 0.9 },
      { label: "PER", start: 3, end: 5, score: 0.9 },
    ];
    const merged = bridgeAdjacentEntities(text, entities);
    expect(merged).toHaveLength(2);
    expect(merged.every((e) => !e.bridged)).toBe(true);
  });

  it("does not bridge across a gap longer than the max bridge width", () => {
    const text = "山田ABC太郎";
    const entities = [
      { label: "PER", start: 0, end: 2, score: 0.9 },
      { label: "PER", start: 5, end: 7, score: 0.9 },
    ];
    const merged = bridgeAdjacentEntities(text, entities);
    expect(merged).toHaveLength(2);
  });

  it("leaves already-contiguous or non-adjacent entities alone", () => {
    const text = "山田太郎";
    const entities = [{ label: "PER", start: 0, end: 4, score: 0.9 }];
    expect(bridgeAdjacentEntities(text, entities)).toEqual([{ ...entities[0], bridged: false }]);
  });

  it("keeps the higher-confidence label when bridging spans with different labels", () => {
    const text = "カナモリ";
    const entities = [
      { label: "LOC", start: 0, end: 2, score: 0.4 },
      { label: "PER", start: 3, end: 4, score: 0.8 },
    ];
    const merged = bridgeAdjacentEntities(text, entities);
    expect(merged).toEqual([{ label: "PER", start: 0, end: 4, score: 0.4, bridged: true }]);
  });
});

describe("extendKatakanaRuns", () => {
  // The other reproduction of the same real failure: after bridging closes
  // the internal gap, the model's tagged span still stops one katakana
  // character short of the actual word's end ("カナモリサナ", not
  // "カナモリサナコ"), leaving a trailing "コ" unmasked.
  it("extends a span's end into a trailing run of katakana", () => {
    const text = "カナモリサナコ\t女";
    const entities = [{ label: "LOC", start: 0, end: 6, score: 0.5, bridged: true }];
    const extended = extendKatakanaRuns(text, entities);
    expect(extended).toEqual([{ label: "LOC", start: 0, end: 7, score: 0.5, bridged: true }]);
  });

  it("extends a span's start into a leading run of katakana", () => {
    const text = "カナモリ";
    // Model only recognized "モリ" (2-4); "カナ" (0-2) is the same katakana
    // word and should be pulled in too.
    const entities = [{ label: "PER", start: 2, end: 4, score: 0.5, bridged: false }];
    const extended = extendKatakanaRuns(text, entities);
    expect(extended).toEqual([{ label: "PER", start: 0, end: 4, score: 0.5, bridged: true }]);
  });

  it("does not extend across a kanji boundary on either edge", () => {
    const text = "田カナモリ様";
    const entities = [{ label: "PER", start: 1, end: 5, score: 0.5, bridged: false }];
    expect(extendKatakanaRuns(text, entities)).toEqual([{ ...entities[0] }]);
  });

  it("does not extend past a hiragana grammatical particle", () => {
    const text = "タロウです";
    const entities = [{ label: "PER", start: 0, end: 3, score: 0.9, bridged: false }];
    expect(extendKatakanaRuns(text, entities)).toEqual([{ ...entities[0] }]);
  });

  it("does not extend into a neighboring entity's own span", () => {
    const text = "カナモリサナコ";
    const entities = [
      { label: "LOC", start: 0, end: 3, score: 0.5, bridged: false },
      { label: "PER", start: 3, end: 7, score: 0.9, bridged: false },
    ];
    const extended = extendKatakanaRuns(text, entities);
    expect(extended).toEqual(entities);
  });

  it("leaves a span untouched when neither edge borders katakana", () => {
    const text = "山田太郎です";
    const entities = [{ label: "PER", start: 0, end: 4, score: 0.9, bridged: false }];
    expect(extendKatakanaRuns(text, entities)).toEqual([{ ...entities[0] }]);
  });
});
