import { describe, expect, it } from "vitest";
import { detectPhone } from "../../src/lib/detectors/rules/phone";

describe("detectPhone", () => {
  it("finds a hyphenated mobile number", () => {
    const text = "電話は090-1234-5678までお願いします";
    const spans = detectPhone(text);
    expect(spans).toHaveLength(1);
    expect(text.slice(spans[0].start, spans[0].end)).toBe("090-1234-5678");
  });

  it("finds a non-hyphenated fixed line number", () => {
    const spans = detectPhone("0312345678 に発信");
    expect(spans).toHaveLength(1);
    expect(spans[0].category).toBe("PHONE");
  });

  it("finds a free-dial number", () => {
    const spans = detectPhone("0120-123-456 まで");
    expect(spans).toHaveLength(1);
  });

  it("finds a +81 international form", () => {
    const spans = detectPhone("+81-90-1234-5678 に連絡");
    expect(spans).toHaveLength(1);
  });

  it("ignores unrelated digit runs", () => {
    expect(detectPhone("2026年8月27日")).toHaveLength(0);
  });
});
