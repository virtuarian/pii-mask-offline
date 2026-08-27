import type { Span } from "../types";

// Japanese domestic numbers (fixed line / mobile / free-dial), hyphenated or not,
// and the +81 international form. Boundary lookarounds keep this from partially
// matching inside a longer digit run (e.g. a credit card or My Number).
const PATTERNS: RegExp[] = [
  /(?<!\d)0\d{1,4}-\d{1,4}-\d{3,4}(?!\d)/g,
  /(?<!\d)0\d{9,10}(?!\d)/g,
  /\+81[- ]?\d{1,4}-?\d{1,4}-?\d{3,4}(?!\d)/g,
];

export function detectPhone(text: string): Span[] {
  const spans: Span[] = [];
  for (const re of PATTERNS) {
    for (const match of text.matchAll(re)) {
      spans.push({
        start: match.index,
        end: match.index + match[0].length,
        category: "PHONE",
        source: "rule",
        confidence: 1,
      });
    }
  }
  return spans;
}
