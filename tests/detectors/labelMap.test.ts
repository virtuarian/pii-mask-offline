import { describe, expect, it } from "vitest";
import { mapNerLabel } from "../../src/lib/detectors/ner/labelMap";

describe("mapNerLabel", () => {
  it("maps Stockmark-style Japanese labels, with or without BIO prefix", () => {
    expect(mapNerLabel("人名")).toBe("PERSON");
    expect(mapNerLabel("B-人名")).toBe("PERSON");
    expect(mapNerLabel("I-法人名")).toBe("ORGANIZATION");
    expect(mapNerLabel("地名")).toBe("ADDRESS");
    expect(mapNerLabel("施設名")).toBe("ADDRESS");
  });

  it("maps CoNLL-style labels case-insensitively", () => {
    expect(mapNerLabel("B-PER")).toBe("PERSON");
    expect(mapNerLabel("I-ORG")).toBe("ORGANIZATION");
    expect(mapNerLabel("B-LOC")).toBe("ADDRESS");
  });

  it("maps tsmatz/xlm-roberta-ner-japanese's suffixed org/institution tags", () => {
    expect(mapNerLabel("ORG-P")).toBe("ORGANIZATION");
    expect(mapNerLabel("ORG-O")).toBe("ORGANIZATION");
    expect(mapNerLabel("INS")).toBe("ADDRESS");
  });

  it("returns null for O and unmapped labels", () => {
    expect(mapNerLabel("O")).toBeNull();
    expect(mapNerLabel("B-製品名")).toBeNull();
    expect(mapNerLabel("PRD")).toBeNull();
    expect(mapNerLabel("EVT")).toBeNull();
    expect(mapNerLabel("")).toBeNull();
  });
});
