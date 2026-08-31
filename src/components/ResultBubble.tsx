import { useMemo, useState } from "react";
import { CATEGORY_COLORS } from "../lib/categoryColors";
import { CATEGORY_LABEL_JA, type EntityCategory, type Span } from "../lib/detectors/types";
import { filterVisibleSpans, maskText, type MappingEntry } from "../lib/mask";

interface ResultBubbleProps {
  text: string;
  spans: Span[];
  mappingEnabled: boolean;
  enabledCategories: ReadonlySet<EntityCategory>;
  onSpansChange: (spans: Span[]) => void;
}

const CATEGORIES = Object.keys(CATEGORY_LABEL_JA) as EntityCategory[];

const SOURCE_LABEL_JA: Record<Span["source"], string> = {
  rule: "正規表現",
  ner: "NER",
  llm: "LLM補助",
  manual: "手動修正",
};

/** Renders a mapping table as tab-separated text, pasteable straight into a spreadsheet. */
function mappingToTsv(mapping: MappingEntry[]): string {
  const header = ["カテゴリ", "元の値", "置換後"].join("\t");
  const rows = mapping.map((m) => [CATEGORY_LABEL_JA[m.category], m.original, m.replacement].join("\t"));
  return [header, ...rows].join("\n");
}

/** A copy-to-clipboard button that briefly confirms success in place of its label. */
function CopyButton({ label, getText }: { label: string; getText: () => string }) {
  const [copied, setCopied] = useState(false);

  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(getText());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("clipboard write failed", err);
    }
  };

  return (
    <button type="button" className="copy-button" onClick={handleClick}>
      {copied ? "コピーしました" : label}
    </button>
  );
}

export function ResultBubble({
  text,
  spans,
  mappingEnabled,
  enabledCategories,
  onSpansChange,
}: ResultBubbleProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Category filtering happens here, not on `spans` itself: `spans` stays
  // the full detected set so toggling the filter later can reveal a
  // category again without rerunning detection (see ChatLayout). `indexMap`
  // translates a position in the filtered (visible) array -- which is what
  // maskText's segment.spanIndex refers to below -- back to `spans`' real
  // index, needed so revert/recategorize edit the right span.
  const { visibleSpans, indexMap } = useMemo(
    () => filterVisibleSpans(spans, enabledCategories),
    [spans, enabledCategories],
  );
  const { segments, maskedText, mapping } = useMemo(
    () => maskText(text, visibleSpans, { useMapping: mappingEnabled }),
    [text, visibleSpans, mappingEnabled],
  );

  const detectedCategories = [
    ...new Set(segments.filter((s) => s.masked && s.category).map((s) => s.category!)),
  ];

  const revertSpan = (visibleIndex: number) => {
    const originalIndex = indexMap[visibleIndex];
    onSpansChange(spans.filter((_, i) => i !== originalIndex));
    setEditingIndex(null);
  };

  const recategorizeSpan = (visibleIndex: number, category: EntityCategory) => {
    const originalIndex = indexMap[visibleIndex];
    onSpansChange(spans.map((s, i) => (i === originalIndex ? { ...s, category, source: "manual" } : s)));
    setEditingIndex(null);
  };

  return (
    <div className="bubble bubble--result">
      <p className="bubble__text">
        {segments.map((segment, i) =>
          segment.masked && segment.category && segment.spanIndex !== undefined ? (
            <span key={i} className="pii-badge-wrap">
              <button
                type="button"
                className="pii-badge"
                style={{
                  backgroundColor: CATEGORY_COLORS[segment.category].bg,
                  color: CATEGORY_COLORS[segment.category].fg,
                }}
                title={`検出元: ${SOURCE_LABEL_JA[segment.source!]}（クリックで修正）`}
                onClick={() =>
                  setEditingIndex(editingIndex === segment.spanIndex ? null : segment.spanIndex!)
                }
              >
                {segment.text}
              </button>
              {editingIndex === segment.spanIndex && (
                <span className="pii-edit-menu">
                  <select
                    value={segment.category}
                    onChange={(e) =>
                      recategorizeSpan(segment.spanIndex!, e.target.value as EntityCategory)
                    }
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {CATEGORY_LABEL_JA[c]}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => revertSpan(segment.spanIndex!)}>
                    元に戻す
                  </button>
                </span>
              )}
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
      <div className="bubble__actions">
        <CopyButton label="本文をコピー" getText={() => maskedText} />
        {mapping && mapping.length > 0 && (
          <CopyButton label="マッピング表をコピー" getText={() => mappingToTsv(mapping)} />
        )}
      </div>
      {mapping && mapping.length > 0 && (
        <table className="mapping-table">
          <thead>
            <tr>
              <th>カテゴリ</th>
              <th>元の値</th>
              <th>置換後</th>
            </tr>
          </thead>
          <tbody>
            {mapping.map((m, i) => (
              <tr key={i}>
                <td>{CATEGORY_LABEL_JA[m.category]}</td>
                <td>{m.original}</td>
                <td>{m.replacement}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
