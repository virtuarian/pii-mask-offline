import type { EntityCategory } from "../types";

/**
 * Maps a raw NER model label (BIO tag or aggregated entity-group name) to one
 * of our three NER-layer categories. Returns null for labels we intentionally
 * ignore (e.g. product/event names, or "O").
 *
 * Two label vocabularies are supported out of the box because the exact
 * label set depends on which fine-tuned checkpoint is wired in via
 * scripts/prepare-model (see docs/MODEL_SELECTION.md):
 *  - The Stockmark "ner-wikipedia-dataset" convention (Japanese label names),
 *    used by several tohoku-bert-base-japanese fine-tunes.
 *  - The generic CoNLL-style convention (PER/ORG/LOC/MISC).
 *
 * If a newly chosen checkpoint uses a different vocabulary, extend the two
 * maps below to match its `config.json` id2label values.
 */
const STOCKMARK_MAP: Record<string, EntityCategory> = {
  人名: "PERSON",
  法人名: "ORGANIZATION",
  政治的組織名: "ORGANIZATION",
  その他の組織名: "ORGANIZATION",
  地名: "ADDRESS",
  施設名: "ADDRESS",
};

const CONLL_STYLE_MAP: Record<string, EntityCategory> = {
  PER: "PERSON",
  PERSON: "PERSON",
  ORG: "ORGANIZATION",
  LOC: "ADDRESS",
  GPE: "ADDRESS",
};

/** Strips a leading BIO prefix ("B-", "I-") if present. */
function stripBioPrefix(label: string): string {
  return label.replace(/^[BI]-/, "");
}

export function mapNerLabel(rawLabel: string): EntityCategory | null {
  if (rawLabel === "O" || rawLabel.trim() === "") return null;
  const bare = stripBioPrefix(rawLabel);
  return STOCKMARK_MAP[bare] ?? CONLL_STYLE_MAP[bare.toUpperCase()] ?? null;
}
