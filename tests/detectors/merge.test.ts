import { describe, expect, it } from "vitest";
import { resolveOverlaps } from "../../src/lib/detectors/merge";
import type { Span } from "../../src/lib/detectors/types";

function span(start: number, end: number, source: Span["source"]): Span {
  return { start, end, source, category: "PERSON", confidence: 1 };
}

describe("resolveOverlaps", () => {
  it("keeps non-overlapping spans untouched", () => {
    const spans = [span(0, 3, "rule"), span(5, 8, "ner")];
    expect(resolveOverlaps(spans)).toEqual(spans);
  });

  it("prefers rule over ner on overlap", () => {
    const rule = span(0, 5, "rule");
    const ner = span(2, 7, "ner");
    expect(resolveOverlaps([ner, rule])).toEqual([rule]);
  });

  it("prefers ner over llm on overlap", () => {
    const ner = span(0, 5, "ner");
    const llm = span(1, 4, "llm");
    expect(resolveOverlaps([llm, ner])).toEqual([ner]);
  });

  it("returns spans sorted by start position", () => {
    const a = span(10, 12, "rule");
    const b = span(0, 2, "rule");
    expect(resolveOverlaps([a, b])).toEqual([b, a]);
  });

  it("breaks equal-priority overlap ties by input order", () => {
    const first = span(0, 5, "rule");
    const second = span(2, 6, "rule");
    expect(resolveOverlaps([first, second])).toEqual([first]);
    expect(resolveOverlaps([second, first])).toEqual([second]);
  });
});
