import { describe, expect, it } from "vitest";
import { maskText } from "../src/lib/mask";
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
});
