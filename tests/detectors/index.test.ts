import { describe, expect, it } from "vitest";
import { detectByRules } from "../../src/lib/detectors/rules/index";

describe("detectByRules", () => {
  it("detects multiple distinct PII categories in one text", () => {
    const text =
      "山田太郎です。連絡先はtaro@example.comまたは090-1234-5678。〒100-0001に住んでいます。";
    const spans = detectByRules(text);
    const categories = spans.map((s) => s.category).sort();
    expect(categories).toEqual(["EMAIL", "PHONE", "POSTAL_CODE"].sort());
  });

  it("returns non-overlapping, position-sorted spans", () => {
    const text = "email: a@example.com tel: 090-1111-2222 zip: 〒150-0001";
    const spans = detectByRules(text);
    for (let i = 1; i < spans.length; i++) {
      expect(spans[i].start).toBeGreaterThanOrEqual(spans[i - 1].end);
      expect(spans[i].start).toBeGreaterThanOrEqual(spans[i - 1].start);
    }
  });
});
