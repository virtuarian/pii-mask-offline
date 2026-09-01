import type { NerModelStatus } from "../hooks/useNerModel";
import type { OfflineStatus } from "../hooks/useOfflineStatus";
import type { EntityCategory } from "../lib/detectors/types";
import { DEFAULT_NER_THRESHOLDS, type NerThresholds } from "../lib/detectors/ner/pipeline";
import { CategoryFilter } from "./CategoryFilter";
import { StatusBar } from "./StatusBar";

interface SettingsViewProps {
  nerStatus: NerModelStatus;
  nerError: string | null;
  offline: OfflineStatus;
  enabledCategories: Set<EntityCategory>;
  onEnabledCategoriesChange: (categories: Set<EntityCategory>) => void;
  llmEnabled: boolean;
  onLlmEnabledChange: (enabled: boolean) => void;
  mappingEnabled: boolean;
  onMappingEnabledChange: (enabled: boolean) => void;
  nerThresholds: NerThresholds;
  onNerThresholdsChange: (thresholds: NerThresholds) => void;
}

export function SettingsView({
  nerStatus,
  nerError,
  offline,
  enabledCategories,
  onEnabledCategoriesChange,
  llmEnabled,
  onLlmEnabledChange,
  mappingEnabled,
  onMappingEnabledChange,
  nerThresholds,
  onNerThresholdsChange,
}: SettingsViewProps) {
  // The floor must never exceed the confident line, or "ambiguous" (floor <=
  // score < confident) would become an empty, contradictory range -- so
  // dragging one handle past the other pushes both together.
  const handleFloorChange = (value: number) => {
    onNerThresholdsChange({
      floorThreshold: value,
      confidentThreshold: Math.max(value, nerThresholds.confidentThreshold),
    });
  };
  const handleConfidentChange = (value: number) => {
    onNerThresholdsChange({
      confidentThreshold: value,
      floorThreshold: Math.min(value, nerThresholds.floorThreshold),
    });
  };
  return (
    <div className="settings-view">
      <section className="settings-view__section">
        <h3>モデルの状態</h3>
        <StatusBar nerStatus={nerStatus} nerError={nerError} offline={offline} />
      </section>

      <section className="settings-view__section">
        <h3>検出する種類</h3>
        <CategoryFilter enabledCategories={enabledCategories} onChange={onEnabledCategoriesChange} />
      </section>

      <section className="settings-view__section">
        <div className="settings-view__section-header">
          <h3>AI検出（氏名・住所等）の感度</h3>
          <button
            type="button"
            className="settings-view__reset"
            onClick={() => onNerThresholdsChange(DEFAULT_NER_THRESHOLDS)}
          >
            既定値に戻す
          </button>
        </div>
        <p className="settings-view__hint">
          ルールで検出できるメール・電話番号等とは別に、氏名・住所などはAI（NERモデル）が推定します。
          下限を下げるほど見逃しは減りますが誤検出が増え、上限を上げるほど「あいまい」として扱われる件数が増えます。
        </p>
        <label className="settings-view__slider">
          <span>
            検出の下限（これ未満のスコアは無視） <strong>{nerThresholds.floorThreshold.toFixed(2)}</strong>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={nerThresholds.floorThreshold}
            onChange={(e) => handleFloorChange(Number(e.target.value))}
          />
        </label>
        <label className="settings-view__slider">
          <span>
            確信ライン（これ未満は「あいまい」扱い） <strong>{nerThresholds.confidentThreshold.toFixed(2)}</strong>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={nerThresholds.confidentThreshold}
            onChange={(e) => handleConfidentChange(Number(e.target.value))}
          />
        </label>
      </section>

      <section className="settings-view__section">
        <h3>オプション</h3>
        <label className="settings-view__toggle">
          <input
            type="checkbox"
            checked={llmEnabled}
            onChange={(e) => onLlmEnabledChange(e.target.checked)}
          />
          実験的機能: LLM補助判定を有効にする（曖昧な検出のみ対象・要ローカルモデル）
        </label>
        <label className="settings-view__toggle">
          <input
            type="checkbox"
            checked={mappingEnabled}
            onChange={(e) => onMappingEnabledChange(e.target.checked)}
          />
          マッピング表を作成する（同じ値は連番付きラベルに統一し、対応表をコピー可能にする）
        </label>
      </section>
    </div>
  );
}
