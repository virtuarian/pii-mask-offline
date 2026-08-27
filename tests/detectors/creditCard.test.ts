import { describe, expect, it } from "vitest";
import { detectCreditCard } from "../../src/lib/detectors/rules/creditCard";

describe("detectCreditCard", () => {
  it("finds a Luhn-valid 16-digit number, hyphenated", () => {
    const spans = detectCreditCard("カード番号: 4111-1111-1111-1111 です");
    expect(spans).toHaveLength(1);
    expect(spans[0].category).toBe("CREDIT_CARD");
  });

  it("finds a Luhn-valid 16-digit number, bare", () => {
    const spans = detectCreditCard("4111111111111111");
    expect(spans).toHaveLength(1);
  });

  it("rejects a digit run that fails the Luhn checksum", () => {
    expect(detectCreditCard("1234567890123456")).toHaveLength(0);
  });
});
