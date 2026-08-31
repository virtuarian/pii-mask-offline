export type EntityCategory =
  | "EMAIL"
  | "PHONE"
  | "CREDIT_CARD"
  | "MY_NUMBER"
  | "POSTAL_CODE"
  | "PERSON"
  | "ADDRESS"
  | "ORGANIZATION";

export type DetectionSource = "rule" | "ner" | "llm" | "manual";

/** A half-open character range [start, end) into the original input text. */
export interface Span {
  start: number;
  end: number;
  category: EntityCategory;
  source: DetectionSource;
  /** Detector-reported confidence in [0, 1]. Rule-based detectors are always 1. */
  confidence: number;
}

export const CATEGORY_LABEL_JA: Record<EntityCategory, string> = {
  EMAIL: "メールアドレス",
  PHONE: "電話番号",
  CREDIT_CARD: "クレジットカード番号",
  MY_NUMBER: "マイナンバー",
  POSTAL_CODE: "郵便番号",
  PERSON: "氏名",
  ADDRESS: "住所",
  ORGANIZATION: "組織名",
};

/** Priority used to resolve overlapping spans: higher wins. */
export const SOURCE_PRIORITY: Record<DetectionSource, number> = {
  manual: 4,
  rule: 3,
  ner: 2,
  llm: 1,
};
