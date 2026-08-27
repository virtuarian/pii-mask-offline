import type { Span } from "../types";

// Individual Number (マイナンバー): exactly 12 digits, sometimes displayed as
// four groups of four separated by spaces or hyphens.
const PATTERNS: RegExp[] = [
  /(?<![\d-])\d{4}[- ]\d{4}[- ]\d{4}(?![\d-])/g,
  /(?<!\d)\d{12}(?!\d)/g,
];

export function detectMyNumber(text: string): Span[] {
  const spans: Span[] = [];
  for (const re of PATTERNS) {
    for (const match of text.matchAll(re)) {
      spans.push({
        start: match.index,
        end: match.index + match[0].length,
        category: "MY_NUMBER",
        source: "rule",
        confidence: 1,
      });
    }
  }
  return spans;
}
