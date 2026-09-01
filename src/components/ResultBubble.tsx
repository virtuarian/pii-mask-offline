import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORY_COLORS } from "../lib/categoryColors";
import { CATEGORY_LABEL_JA, type EntityCategory, type Span } from "../lib/detectors/types";
import { filterVisibleSpans, maskText, type MappingEntry } from "../lib/mask";
import { CheckIcon, UndoIcon } from "./icons";

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
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editingIndex === null) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (textRef.current && !textRef.current.contains(e.target as Node)) {
        setEditingIndex(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEditingIndex(null);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [editingIndex]);

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
      <div className="bubble__text" ref={textRef}>
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
                aria-expanded={editingIndex === segment.spanIndex}
                onClick={() =>
                  setEditingIndex(editingIndex === segment.spanIndex ? null : segment.spanIndex!)
                }
              >
                {segment.text}
              </button>
              {editingIndex === segment.spanIndex && (
                <div className="pii-edit-menu" role="menu">
                  <div className="pii-edit-menu__header">カテゴリを変更</div>
                  <ul className="pii-edit-menu__list">
                    {CATEGORIES.map((c) => {
                      const active = c === segment.category;
                      return (
                        <li key={c}>
                          <button
                            type="button"
                            className={`pii-edit-menu__item${active ? " pii-edit-menu__item--active" : ""}`}
                            role="menuitemradio"
                            aria-checked={active}
                            onClick={() => recategorizeSpan(segment.spanIndex!, c)}
                          >
                            <span
                              className="pii-edit-menu__dot"
                              style={{ background: CATEGORY_COLORS[c].fg }}
                              aria-hidden="true"
                            />
                            <span className="pii-edit-menu__label">{CATEGORY_LABEL_JA[c]}</span>
                            {active && <CheckIcon className="pii-edit-menu__check" />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="pii-edit-menu__divider" />
                  <button
                    type="button"
                    className="pii-edit-menu__item pii-edit-menu__item--revert"
                    onClick={() => revertSpan(segment.spanIndex!)}
                  >
                    <UndoIcon className="pii-edit-menu__revert-icon" />
                    <span className="pii-edit-menu__label">検出前に戻す</span>
                  </button>
                </div>
              )}
            </span>
          ) : (
            <span key={i}>{segment.text}</span>
          ),
        )}
      </div>
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
