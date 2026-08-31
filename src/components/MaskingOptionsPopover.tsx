import { useEffect, useRef, useState } from "react";
import { CATEGORY_COLORS } from "../lib/categoryColors";
import { CATEGORY_LABEL_JA, type EntityCategory } from "../lib/detectors/types";
import { CheckIcon, GearIcon } from "./icons";

interface MaskingOptionsPopoverProps {
  enabledCategories: Set<EntityCategory>;
  onEnabledCategoriesChange: (categories: Set<EntityCategory>) => void;
  mappingEnabled: boolean;
  onMappingEnabledChange: (enabled: boolean) => void;
  llmEnabled: boolean;
  onLlmEnabledChange: (enabled: boolean) => void;
}

const CATEGORIES = Object.keys(CATEGORY_LABEL_JA) as EntityCategory[];

/**
 * A modern anchored dropdown (opens upward from the input bar's gear
 * button) for toggles that used to require leaving the chat screen:
 * which PII categories to detect, and the mapping-table/LLM options.
 * Everything here is a click-to-toggle row rather than a checkbox so it
 * reads as one consistent list, mapping/LLM included even though they're
 * booleans rather than a multi-select set.
 */
export function MaskingOptionsPopover({
  enabledCategories,
  onEnabledCategoriesChange,
  mappingEnabled,
  onMappingEnabledChange,
  llmEnabled,
  onLlmEnabledChange,
}: MaskingOptionsPopoverProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const toggleCategory = (category: EntityCategory) => {
    const next = new Set(enabledCategories);
    if (next.has(category)) next.delete(category);
    else next.add(category);
    onEnabledCategoriesChange(next);
  };

  return (
    <div className="masking-popover" ref={containerRef}>
      <button
        type="button"
        className="input-area__settings-button"
        onClick={() => setOpen((o) => !o)}
        title="マスキング設定"
        aria-expanded={open}
      >
        <GearIcon />
      </button>

      {open && (
        <div className="masking-popover__panel" role="menu">
          <div className="masking-popover__header">
            <span>検出する項目</span>
            <div className="masking-popover__quick-actions">
              <button type="button" onClick={() => onEnabledCategoriesChange(new Set(CATEGORIES))}>
                すべて
              </button>
              <button type="button" onClick={() => onEnabledCategoriesChange(new Set())}>
                解除
              </button>
            </div>
          </div>
          <ul className="masking-popover__list">
            {CATEGORIES.map((category) => {
              const active = enabledCategories.has(category);
              return (
                <li key={category}>
                  <button
                    type="button"
                    className={`masking-popover__item${active ? " masking-popover__item--active" : ""}`}
                    onClick={() => toggleCategory(category)}
                    role="menuitemcheckbox"
                    aria-checked={active}
                  >
                    <span
                      className="masking-popover__dot"
                      style={{ background: CATEGORY_COLORS[category].fg }}
                      aria-hidden="true"
                    />
                    <span className="masking-popover__item-label">{CATEGORY_LABEL_JA[category]}</span>
                    {active && <CheckIcon className="masking-popover__check" />}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="masking-popover__divider" />

          <ul className="masking-popover__list">
            <li>
              <button
                type="button"
                className={`masking-popover__item${mappingEnabled ? " masking-popover__item--active" : ""}`}
                onClick={() => onMappingEnabledChange(!mappingEnabled)}
                role="menuitemcheckbox"
                aria-checked={mappingEnabled}
              >
                <span className="masking-popover__item-text">
                  <span className="masking-popover__item-label">マッピング表を作成する</span>
                  <span className="masking-popover__item-desc">
                    同じ値を連番ラベルに統一し、対応表をコピー可能にする
                  </span>
                </span>
                {mappingEnabled && <CheckIcon className="masking-popover__check" />}
              </button>
            </li>
            <li>
              <button
                type="button"
                className={`masking-popover__item${llmEnabled ? " masking-popover__item--active" : ""}`}
                onClick={() => onLlmEnabledChange(!llmEnabled)}
                role="menuitemcheckbox"
                aria-checked={llmEnabled}
              >
                <span className="masking-popover__item-text">
                  <span className="masking-popover__item-label">LLM補助判定（実験的）</span>
                  <span className="masking-popover__item-desc">曖昧な検出のみ対象・要ローカルモデル</span>
                </span>
                {llmEnabled && <CheckIcon className="masking-popover__check" />}
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
