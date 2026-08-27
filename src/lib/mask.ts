import { CATEGORY_LABEL_JA, type Span } from "./detectors/types";

export interface MaskedSegment {
  text: string;
  masked: boolean;
  category?: Span["category"];
  source?: Span["source"];
}

export interface MaskResult {
  maskedText: string;
  segments: MaskedSegment[];
}

/**
 * Builds the masked output text and a segment list for highlighting.
 *
 * Deterministic by construction: `spans` must already be non-overlapping and
 * position-sorted (see `resolveOverlaps`). Every character outside a span is
 * copied verbatim from `text` via `slice` — no trimming, normalization, or
 * reordering is ever applied, so masking never touches non-PII content.
 */
export function maskText(text: string, spans: Span[]): MaskResult {
  const segments: MaskedSegment[] = [];
  let cursor = 0;

  for (const span of spans) {
    if (span.start > cursor) {
      segments.push({ text: text.slice(cursor, span.start), masked: false });
    }
    const label = `[${CATEGORY_LABEL_JA[span.category]}]`;
    segments.push({ text: label, masked: true, category: span.category, source: span.source });
    cursor = span.end;
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), masked: false });
  }

  return {
    maskedText: segments.map((s) => s.text).join(""),
    segments,
  };
}
