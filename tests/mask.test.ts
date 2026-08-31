import { describe, expect, it } from "vitest";
import { filterVisibleSpans, maskText } from "../src/lib/mask";
import type { Span } from "../src/lib/detectors/types";

describe("maskText", () => {
  it("replaces only the flagged span, leaving everything else byte-identical", () => {
    const text = "連絡先はtaro@example.comです。";
    const spans: Span[] = [
      { start: 4, end: 20, category: "EMAIL", source: "rule", confidence: 1 },
    ];
    const { maskedText, segments } = maskText(text, spans);

    expect(maskedText).toBe("連絡先は[メールアドレス]です。");
    expect(segments[0]).toEqual({ text: "連絡先は", masked: false });
    expect(segments[2]).toEqual({ text: "です。", masked: false });
  });

  it("is a no-op when there are no spans", () => {
    const text = "個人情報は含まれていません。";
    expect(maskText(text, []).maskedText).toBe(text);
  });

  it("handles adjacent and back-to-back spans without altering surrounding text", () => {
    const text = "AAABBBCCC";
    const spans: Span[] = [
      { start: 3, end: 6, category: "PHONE", source: "rule", confidence: 1 },
    ];
    const { maskedText } = maskText(text, spans);
    expect(maskedText).toBe("AAA[電話番号]CCC");
  });

  it("masks multiple non-overlapping spans in order", () => {
    const text = "a@example.com 090-1234-5678";
    const spans: Span[] = [
      { start: 0, end: 13, category: "EMAIL", source: "rule", confidence: 1 },
      { start: 14, end: 27, category: "PHONE", source: "rule", confidence: 1 },
    ];
    const { maskedText } = maskText(text, spans);
    expect(maskedText).toBe("[メールアドレス] [電話番号]");
  });

  it("omits the mapping field entirely when useMapping is not requested", () => {
    const text = "a@example.com";
    const spans: Span[] = [{ start: 0, end: 13, category: "EMAIL", source: "rule", confidence: 1 }];
    expect(maskText(text, spans).mapping).toBeUndefined();
  });

  describe("useMapping", () => {
    it("assigns per-category sequential labels and records the mapping", () => {
      const text = "山田太郎と鈴木一郎が同じチームです。";
      const spans: Span[] = [
        { start: 0, end: 4, category: "PERSON", source: "ner", confidence: 0.9 },
        { start: 5, end: 9, category: "PERSON", source: "ner", confidence: 0.9 },
      ];
      const { maskedText, mapping } = maskText(text, spans, { useMapping: true });

      expect(maskedText).toBe("[氏名_1]と[氏名_2]が同じチームです。");
      expect(mapping).toEqual([
        { category: "PERSON", original: "山田太郎", replacement: "[氏名_1]" },
        { category: "PERSON", original: "鈴木一郎", replacement: "[氏名_2]" },
      ]);
    });

    it("reuses the same label for repeated occurrences of the same value", () => {
      const text = "山田太郎です。山田太郎さんによろしく。";
      const spans: Span[] = [
        { start: 0, end: 4, category: "PERSON", source: "ner", confidence: 0.9 },
        { start: 7, end: 11, category: "PERSON", source: "ner", confidence: 0.9 },
      ];
      const { maskedText, mapping } = maskText(text, spans, { useMapping: true });

      expect(maskedText).toBe("[氏名_1]です。[氏名_1]さんによろしく。");
      expect(mapping).toEqual([{ category: "PERSON", original: "山田太郎", replacement: "[氏名_1]" }]);
    });

    it("numbers each category independently", () => {
      const text = "山田太郎と株式会社サンプル。";
      const spans: Span[] = [
        { start: 0, end: 4, category: "PERSON", source: "ner", confidence: 0.9 },
        { start: 5, end: 13, category: "ORGANIZATION", source: "ner", confidence: 0.9 },
      ];
      const { mapping } = maskText(text, spans, { useMapping: true });

      expect(mapping).toEqual([
        { category: "PERSON", original: "山田太郎", replacement: "[氏名_1]" },
        { category: "ORGANIZATION", original: "株式会社サンプル", replacement: "[組織名_1]" },
      ]);
    });
  });
});

describe("filterVisibleSpans", () => {
  const spans: Span[] = [
    { start: 0, end: 4, category: "PERSON", source: "ner", confidence: 0.9 },
    { start: 5, end: 12, category: "EMAIL", source: "rule", confidence: 1 },
    { start: 13, end: 17, category: "ADDRESS", source: "ner", confidence: 0.9 },
  ];

  it("keeps only spans whose category is enabled, in original order", () => {
    const { visibleSpans } = filterVisibleSpans(spans, new Set(["PERSON", "ADDRESS"]));
    expect(visibleSpans).toEqual([spans[0], spans[2]]);
  });

  it("maps each visible span's position back to its index in the original array", () => {
    const { indexMap } = filterVisibleSpans(spans, new Set(["PERSON", "ADDRESS"]));
    expect(indexMap).toEqual([0, 2]);
  });

  it("returns everything when all categories are enabled", () => {
    const { visibleSpans, indexMap } = filterVisibleSpans(
      spans,
      new Set(["PERSON", "EMAIL", "ADDRESS"]),
    );
    expect(visibleSpans).toEqual(spans);
    expect(indexMap).toEqual([0, 1, 2]);
  });

  it("returns nothing when no categories are enabled", () => {
    const { visibleSpans, indexMap } = filterVisibleSpans(spans, new Set());
    expect(visibleSpans).toEqual([]);
    expect(indexMap).toEqual([]);
  });

  it("feeds directly into maskText to leave a disabled category's text unmasked", () => {
    const text = "山田太郎宛 a@example.com 東京都";
    const mixedSpans: Span[] = [
      { start: 0, end: 4, category: "PERSON", source: "ner", confidence: 0.9 },
      { start: 6, end: 19, category: "EMAIL", source: "rule", confidence: 1 },
      { start: 20, end: 23, category: "ADDRESS", source: "ner", confidence: 0.9 },
    ];
    const { visibleSpans } = filterVisibleSpans(mixedSpans, new Set(["EMAIL"]));
    const { maskedText } = maskText(text, visibleSpans);
    expect(maskedText).toBe("山田太郎宛 [メールアドレス] 東京都");
  });
});
