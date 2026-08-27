import { describe, expect, it } from "vitest";
import { detectMyNumber } from "../../src/lib/detectors/rules/myNumber";

describe("detectMyNumber", () => {
  it("finds a bare 12-digit number", () => {
    const spans = detectMyNumber("マイナンバーは123456789012です");
    expect(spans).toHaveLength(1);
    expect(spans[0].category).toBe("MY_NUMBER");
  });

  it("finds a grouped 4-4-4 number", () => {
    const spans = detectMyNumber("番号: 1234 5678 9012 です");
    expect(spans).toHaveLength(1);
  });

  it("does not match an 11-digit run", () => {
    expect(detectMyNumber("12345678901")).toHaveLength(0);
  });
});
