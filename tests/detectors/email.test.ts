import { describe, expect, it } from "vitest";
import { detectEmail } from "../../src/lib/detectors/rules/email";

describe("detectEmail", () => {
  it("finds a plain email address", () => {
    const text = "連絡先は taro.yamada@example.co.jp です。";
    const spans = detectEmail(text);
    expect(spans).toHaveLength(1);
    expect(text.slice(spans[0].start, spans[0].end)).toBe("taro.yamada@example.co.jp");
    expect(spans[0].category).toBe("EMAIL");
  });

  it("finds multiple addresses", () => {
    const text = "a@example.com と b@example.org に送付";
    expect(detectEmail(text)).toHaveLength(2);
  });

  it("does not match text without an @", () => {
    expect(detectEmail("example.com はドメインです")).toHaveLength(0);
  });
});
