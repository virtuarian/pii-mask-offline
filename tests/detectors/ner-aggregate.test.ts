import { describe, expect, it } from "vitest";
import { aggregateEntities } from "../../src/lib/detectors/ner/pipeline";

describe("aggregateEntities", () => {
  it("merges consecutive B-/I- tokens of the same type into one span", () => {
    const tokens = [
      { entity: "O", score: 0.99, start: 0, end: 2 },
      { entity: "B-人名", score: 0.9, start: 2, end: 4 },
      { entity: "I-人名", score: 0.85, start: 4, end: 6 },
      { entity: "O", score: 0.99, start: 6, end: 8 },
    ];
    const groups = aggregateEntities(tokens);
    expect(groups).toEqual([{ label: "人名", start: 2, end: 6, score: 0.85 }]);
  });

  it("keeps a run's minimum score as the group's confidence", () => {
    const tokens = [
      { entity: "B-地名", score: 0.6, start: 0, end: 2 },
      { entity: "I-地名", score: 0.4, start: 2, end: 4 },
      { entity: "I-地名", score: 0.9, start: 4, end: 6 },
    ];
    expect(aggregateEntities(tokens)[0].score).toBe(0.4);
  });

  it("starts a new group when the entity type changes", () => {
    const tokens = [
      { entity: "B-人名", score: 0.9, start: 0, end: 2 },
      { entity: "B-地名", score: 0.9, start: 2, end: 4 },
    ];
    expect(aggregateEntities(tokens)).toHaveLength(2);
  });

  it("drops tokens without character offsets", () => {
    const tokens = [{ entity: "B-人名", score: 0.9, start: undefined, end: undefined }];
    expect(aggregateEntities(tokens)).toHaveLength(0);
  });

  it("ignores O tokens", () => {
    const tokens = [{ entity: "O", score: 0.99, start: 0, end: 5 }];
    expect(aggregateEntities(tokens)).toHaveLength(0);
  });
});
