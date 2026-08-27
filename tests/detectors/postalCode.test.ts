import { describe, expect, it } from "vitest";
import { detectPostalCode } from "../../src/lib/detectors/rules/postalCode";
import { detectPhone } from "../../src/lib/detectors/rules/phone";

describe("detectPostalCode", () => {
  it("finds a 〒-prefixed postal code", () => {
    const text = "〒100-0001 東京都千代田区千代田";
    const spans = detectPostalCode(text);
    expect(spans).toHaveLength(1);
    expect(text.slice(spans[0].start, spans[0].end)).toBe("100-0001");
  });

  it("finds a bare postal code in isolation", () => {
    const spans = detectPostalCode("郵便番号は150-0001です");
    expect(spans).toHaveLength(1);
    expect(spans[0].category).toBe("POSTAL_CODE");
  });

  it("does not match inside a hyphenated phone number", () => {
    const text = "090-1234-5678";
    expect(detectPostalCode(text)).toHaveLength(0);
    // sanity: the same string is still a valid phone match
    expect(detectPhone(text)).toHaveLength(1);
  });
});
