import type { Span } from "../types";

// Candidate digit runs (13-19 digits total, per ISO/IEC 7812), grouped in 4s or
// bare, separated by spaces/hyphens. Luhn validation below filters out
// coincidental digit runs (phone numbers, IDs, etc.) that match the shape.
const CANDIDATE_RE = /(?<![\d-])\d(?:[ -]?\d){12,18}(?!\d)/g;

function luhnValid(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

export function detectCreditCard(text: string): Span[] {
  const spans: Span[] = [];
  for (const match of text.matchAll(CANDIDATE_RE)) {
    const digits = match[0].replace(/[ -]/g, "");
    if (digits.length < 13 || digits.length > 19) continue;
    if (!luhnValid(digits)) continue;
    spans.push({
      start: match.index,
      end: match.index + match[0].length,
      category: "CREDIT_CARD",
      source: "rule",
      confidence: 1,
    });
  }
  return spans;
}
