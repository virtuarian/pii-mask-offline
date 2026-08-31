import { describe, expect, it } from "vitest";
import { aggregateEntities, assignCharOffsets, chunkText } from "../../src/lib/detectors/ner/pipeline";

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
