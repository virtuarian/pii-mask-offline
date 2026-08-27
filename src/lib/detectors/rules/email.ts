import type { Span } from "../types";

// Practical (non-exhaustive) RFC 5322-ish pattern: good enough for real-world PII scanning
// without matching arbitrary punctuation soup as an address.
const EMAIL_RE = /[a-zA-Z0-9][a-zA-Z0-9._%+-]*@[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}/g;

export function detectEmail(text: string): Span[] {
  const spans: Span[] = [];
  for (const match of text.matchAll(EMAIL_RE)) {
    spans.push({
      start: match.index,
      end: match.index + match[0].length,
      category: "EMAIL",
      source: "rule",
      confidence: 1,
    });
  }
  return spans;
}
