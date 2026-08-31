import { useRef, useState } from "react";
import { CATEGORY_LABEL_JA, type EntityCategory } from "../lib/detectors/types";

interface InputBubbleProps {
  text: string;
  onAddSpan: (start: number, end: number, category: EntityCategory) => void;
}

interface PendingSelection {
  start: number;
  end: number;
}

const CATEGORIES = Object.keys(CATEGORY_LABEL_JA) as EntityCategory[];

/**
 * Renders the original input text and lets the user select a substring the
 * automatic detectors missed, then tag it with a category to add it as a
 * manual span (see ChatLayout.handleAddSpan). Offset math relies on this
 * paragraph having exactly one text-node child (just `{text}`, no nested
 * elements), so a Range's startOffset/endOffset are plain character indices
 * into `text`.
 */
export function InputBubble({ text, onAddSpan }: InputBubbleProps) {
  const paragraphRef = useRef<HTMLParagraphElement>(null);
  const [pending, setPending] = useState<PendingSelection | null>(null);

  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      return;
    }
    const range = selection.getRangeAt(0);
    const container = paragraphRef.current;
    if (
      !container ||
      !container.contains(range.commonAncestorContainer) ||
      range.startContainer !== range.endContainer
    ) {
      return;
    }
    if (range.startOffset === range.endOffset) {
      setPending(null);
      return;
    }
    setPending({ start: range.startOffset, end: range.endOffset });
  };

  const addSpan = (category: EntityCategory) => {
    if (!pending) return;
    onAddSpan(pending.start, pending.end, category);
    setPending(null);
    window.getSelection()?.removeAllRanges();
  };

  return (
    <div className="bubble bubble--input">
      <p
        className="bubble__text"
        ref={paragraphRef}
        onMouseDown={() => setPending(null)}
        onMouseUp={handleMouseUp}
      >
        {text}
      </p>
      {pending && (
        <div className="manual-add-toolbar">
          <span className="manual-add-toolbar__label">
            「{text.slice(pending.start, pending.end)}」を追加:
          </span>
          {CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              className="copy-button"
              onClick={() => addSpan(category)}
            >
              {CATEGORY_LABEL_JA[category]}
            </button>
          ))}
          <button type="button" className="copy-button" onClick={() => setPending(null)}>
            キャンセル
          </button>
        </div>
      )}
    </div>
  );
}
