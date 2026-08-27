import { resolveOverlaps } from "../merge";
import type { Span } from "../types";

// 〒 prefixed form is unambiguous regardless of surrounding digits.
const POSTAL_WITH_MARK_RE = /〒\s?(\d{3}-?\d{4})/g;

// Bare "NNN-NNNN" form: require a hyphen and forbid any adjacent digit/hyphen so
// this never partially matches inside a longer hyphenated phone number.
const POSTAL_BARE_RE = /(?<![\d-])\d{3}-\d{4}(?![\d-])/g;

export function detectPostalCode(text: string): Span[] {
  const spans: Span[] = [];

  for (const match of text.matchAll(POSTAL_WITH_MARK_RE)) {
    const groupStart = match.index + (match[0].length - match[1].length);
    spans.push({
      start: groupStart,
      end: groupStart + match[1].length,
      category: "POSTAL_CODE",
      source: "rule",
      confidence: 1,
    });
  }

  for (const match of text.matchAll(POSTAL_BARE_RE)) {
    spans.push({
      start: match.index,
      end: match.index + match[0].length,
      category: "POSTAL_CODE",
      source: "rule",
      confidence: 1,
    });
  }

  // The bare pattern also matches the digits inside a 〒-marked postal code;
  // resolve that duplication, preferring the 〒-marked (earlier-pushed) span.
  return resolveOverlaps(spans);
}
