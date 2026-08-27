import { SOURCE_PRIORITY, type Span } from "./types";

function overlaps(a: Span, b: Span): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Resolves overlapping spans into a non-overlapping, position-sorted list.
 *
 * Priority order: rule > ner > llm (see SOURCE_PRIORITY). Among spans of equal
 * priority, the one appearing earlier in the input array wins — callers that
 * care about a specific tie-break order (e.g. running the most specific rule
 * detector first) should rely on that by constructing `spans` accordingly.
 * `Array.prototype.sort` is stable, so equal-priority order is preserved.
 */
export function resolveOverlaps(spans: Span[]): Span[] {
  const bySourcePriority = [...spans].sort(
    (a, b) => SOURCE_PRIORITY[b.source] - SOURCE_PRIORITY[a.source],
  );

  const accepted: Span[] = [];
  for (const candidate of bySourcePriority) {
    if (!accepted.some((a) => overlaps(a, candidate))) {
      accepted.push(candidate);
    }
  }

  return accepted.sort((a, b) => a.start - b.start);
}
