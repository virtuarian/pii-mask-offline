import { CATEGORY_COLORS } from "../lib/categoryColors";
import { CATEGORY_LABEL_JA } from "../lib/detectors/types";
import type { MaskedSegment } from "../lib/mask";

interface ResultBubbleProps {
  segments: MaskedSegment[];
}

export function ResultBubble({ segments }: ResultBubbleProps) {
  const detectedCategories = [
    ...new Set(segments.filter((s) => s.masked && s.category).map((s) => s.category!)),
  ];

  return (
    <div className="bubble bubble--result">
      <div className="bubble__label">検出結果（決定論的置換）</div>
      <p className="bubble__text">
        {segments.map((segment, i) =>
          segment.masked && segment.category ? (
            <span
              key={i}
              className="pii-badge"
              style={{
                backgroundColor: CATEGORY_COLORS[segment.category].bg,
                color: CATEGORY_COLORS[segment.category].fg,
              }}
              title={`検出元: ${segment.source === "rule" ? "正規表現" : segment.source === "ner" ? "NER" : "LLM補助"}`}
            >
              {segment.text}
            </span>
          ) : (
            <span key={i}>{segment.text}</span>
          ),
        )}
      </p>
      {detectedCategories.length > 0 && (
        <div className="bubble__summary">
          検出: {detectedCategories.map((c) => CATEGORY_LABEL_JA[c]).join(" / ")}
        </div>
      )}
    </div>
  );
}
