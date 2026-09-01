import { useEffect, useRef, useState } from "react";
import { CATEGORY_COLORS } from "../lib/categoryColors";
import { CATEGORY_LABEL_JA, type EntityCategory } from "../lib/detectors/types";
import { CloseIcon, PlusIcon } from "./icons";

interface InputBubbleProps {
  text: string;
  onAddSpan: (start: number, end: number, category: EntityCategory) => void;
}

interface PendingSelection {
  start: number;
  end: number;
  /** Trigger pill's anchor point, in px relative to the bubble container. */
  triggerTop: number;
  triggerLeft: number;
  /** Menu card's top-left, in px relative to the bubble container. */
  menuTop: number;
  menuLeft: number;
}

const CATEGORIES = Object.keys(CATEGORY_LABEL_JA) as EntityCategory[];
/** Must match `.manual-add-toolbar`'s `width` in index.css (15rem @ 16px root). */
const MENU_WIDTH_PX = 240;
/** Rough half-width of the "＋ 追加" pill (auto-sized; this is a safe overestimate for edge clamping). */
const TRIGGER_HALF_WIDTH_PX = 50;
const EDGE_MARGIN_PX = 8;

/**
 * Renders the original input text and lets the user select a substring the
 * automatic detectors missed, then tag it with a category to add it as a
 * manual span (see ChatLayout.handleAddSpan). Offset math relies on this
 * paragraph having exactly one text-node child (just `{text}`, no nested
 * elements), so a Range's startOffset/endOffset are plain character indices
 * into `text`.
 *
 * A finished selection first surfaces only a small floating "追加" pill,
 * not the full category list -- the full list used to open immediately and
 * reflowed the layout (it rendered inline, pushing content below it down),
 * which visibly shifted the paragraph out from under the cursor while a
 * user was still mid-drag adjusting their selection. The pill is
 * absolutely positioned from the selection's own bounding rect, so it
 * never affects layout and can't interrupt selecting; the full list opens
 * only once the pill itself is clicked.
 */
export function InputBubble({ text, onAddSpan }: InputBubbleProps) {
  const bubbleRef = useRef<HTMLDivElement>(null);
  const paragraphRef = useRef<HTMLParagraphElement>(null);
  const [pending, setPending] = useState<PendingSelection | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const dismiss = () => {
    setPending(null);
    setMenuOpen(false);
  };

  useEffect(() => {
    if (!pending) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (bubbleRef.current && !bubbleRef.current.contains(e.target as Node)) {
        dismiss();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [pending]);

  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      return;
    }
    const range = selection.getRangeAt(0);
    const container = paragraphRef.current;
    const bubble = bubbleRef.current;
    if (
      !container ||
      !bubble ||
      !container.contains(range.commonAncestorContainer) ||
      range.startContainer !== range.endContainer
    ) {
      return;
    }
    if (range.startOffset === range.endOffset) {
      dismiss();
      return;
    }
    const rangeRect = range.getBoundingClientRect();
    const bubbleRect = bubble.getBoundingClientRect();
    // Clamp against the actual browser window, not the bubble's own width:
    // a short message's bubble can be far narrower than the popover itself
    // (see e.g. a one-character message pinned to the chat's right edge),
    // so sizing the clamp off the bubble let the popover run straight off
    // the right side of the window instead of staying inside it.
    const viewportWidth = document.documentElement.clientWidth;
    const rawCenterX = rangeRect.left + rangeRect.width / 2;
    const triggerCenterX = Math.min(
      Math.max(rawCenterX, TRIGGER_HALF_WIDTH_PX + EDGE_MARGIN_PX),
      viewportWidth - TRIGGER_HALF_WIDTH_PX - EDGE_MARGIN_PX,
    );
    const menuLeftViewport = Math.min(
      Math.max(rawCenterX - MENU_WIDTH_PX / 2, EDGE_MARGIN_PX),
      viewportWidth - MENU_WIDTH_PX - EDGE_MARGIN_PX,
    );
    setPending({
      start: range.startOffset,
      end: range.endOffset,
      triggerTop: rangeRect.top - bubbleRect.top,
      triggerLeft: triggerCenterX - bubbleRect.left,
      menuTop: rangeRect.bottom - bubbleRect.top,
      menuLeft: menuLeftViewport - bubbleRect.left,
    });
    setMenuOpen(false);
  };

  const addSpan = (category: EntityCategory) => {
    if (!pending) return;
    onAddSpan(pending.start, pending.end, category);
    dismiss();
    window.getSelection()?.removeAllRanges();
  };

  return (
    <div className="bubble bubble--input" ref={bubbleRef}>
      <p
        className="bubble__text"
        ref={paragraphRef}
        onMouseDown={dismiss}
        onMouseUp={handleMouseUp}
      >
        {text}
      </p>
      {pending && !menuOpen && (
        <button
          type="button"
          className="selection-trigger"
          style={{ top: pending.triggerTop - 8, left: pending.triggerLeft }}
          onClick={() => setMenuOpen(true)}
        >
          <PlusIcon aria-hidden="true" />
          追加
        </button>
      )}
      {pending && menuOpen && (
        <div
          className="manual-add-toolbar"
          role="menu"
          style={{ top: pending.menuTop + 8, left: pending.menuLeft }}
        >
          <div className="manual-add-toolbar__header">
            <span className="manual-add-toolbar__header-icon" aria-hidden="true">
              <PlusIcon />
            </span>
            <span className="manual-add-toolbar__label">
              「{text.slice(pending.start, pending.end)}」を追加
            </span>
            <button
              type="button"
              className="manual-add-toolbar__close"
              onClick={dismiss}
              title="キャンセル"
            >
              <CloseIcon />
            </button>
          </div>
          <ul className="manual-add-toolbar__grid">
            {CATEGORIES.map((category) => (
              <li key={category}>
                <button
                  type="button"
                  className="manual-add-toolbar__item"
                  role="menuitem"
                  onClick={() => addSpan(category)}
                >
                  <span
                    className="manual-add-toolbar__dot"
                    style={{ background: CATEGORY_COLORS[category].fg }}
                    aria-hidden="true"
                  />
                  {CATEGORY_LABEL_JA[category]}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
