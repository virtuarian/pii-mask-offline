import { CATEGORY_LABEL_JA, type EntityCategory } from "../lib/detectors/types";

interface CategoryFilterProps {
  enabledCategories: ReadonlySet<EntityCategory>;
  onChange: (categories: Set<EntityCategory>) => void;
}

const CATEGORIES = Object.keys(CATEGORY_LABEL_JA) as EntityCategory[];

/**
 * Lets the user restrict masking to a subset of categories (e.g. names
 * only). Applied live at render time against already-processed messages
 * too (see ResultBubble), not just future ones, so toggling a category
 * immediately shows/hides it everywhere -- consistent with how
 * mappingEnabled already behaves.
 */
export function CategoryFilter({ enabledCategories, onChange }: CategoryFilterProps) {
  const toggle = (category: EntityCategory) => {
    const next = new Set(enabledCategories);
    if (next.has(category)) {
      next.delete(category);
    } else {
      next.add(category);
    }
    onChange(next);
  };

  return (
    <details className="category-filter">
      <summary>マスキングする種類を設定（{enabledCategories.size}/{CATEGORIES.length}）</summary>
      <div className="category-filter__grid">
        {CATEGORIES.map((category) => (
          <label key={category} className="category-filter__item">
            <input
              type="checkbox"
              checked={enabledCategories.has(category)}
              onChange={() => toggle(category)}
            />
            {CATEGORY_LABEL_JA[category]}
          </label>
        ))}
      </div>
      <div className="category-filter__actions">
        <button type="button" onClick={() => onChange(new Set(CATEGORIES))}>
          すべて選択
        </button>
        <button type="button" onClick={() => onChange(new Set())}>
          すべて解除
        </button>
      </div>
    </details>
  );
}
